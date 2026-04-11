#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * Pre-deploy health checks — runs during Netlify build (no browser required).
 *
 * Checks:
 *   1. Required environment variables are present
 *   2. External APIs (setlist.fm, Spotify auth) are reachable
 *   3. Netlify function files exist and have no obvious syntax errors
 *
 * Exit code 0 = all checks passed (deploy proceeds)
 * Exit code 1 = one or more checks failed (deploy is blocked)
 *
 * Add to netlify.toml:
 *   command = "npm run build && node tests/utils/pre-deploy-checks.js"
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(name) {
  console.log(`  ✓ ${name}`);
  passed++;
}

function fail(name, reason) {
  console.error(`  ✗ ${name}: ${reason}`);
  failed++;
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'MySetlists-PreDeployChecks/1.0 (contact@mysetlists.net)',
          ...headers,
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode, body: data })
        );
      }
    );
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timed out')));
  });
}

// ── Check 1: Required environment variables ──────────────────────────────────

function checkEnvVars() {
  console.log('\n1. Environment Variables');

  // Variables required for the build
  const required = ['REACT_APP_FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID'];
  for (const v of required) {
    if (process.env[v]) {
      pass(v);
    } else {
      fail(v, 'not set');
    }
  }

  // Variables that are important but optional — warn only
  const recommended = [
    'SETLISTFM_API_KEY',
    'RESEND_API_KEY',
    'FIREBASE_SERVICE_ACCOUNT_JSON',
    'ANTHROPIC_API_KEY',
  ];
  for (const v of recommended) {
    if (process.env[v]) {
      pass(`${v} (optional)`);
    } else {
      console.warn(`  ⚠  ${v} not set (optional — some features may be limited)`);
    }
  }
}

// ── Check 2: Netlify function files exist ─────────────────────────────────────

function checkFunctionFiles() {
  console.log('\n2. Netlify Function Files');

  const functionsDir = path.join(process.cwd(), 'netlify', 'functions');
  const required = [
    'send-email.js',
    'search-setlists.js',
    'search-artists.js',
    'enrich-artist.js',
    'get-entity-info.js',
    'analyze-tickets.js',
    'spotify-token.js',
    'apple-music-token.js',
    'create-shared-collection.js',
    'get-shared-collection.js',
  ];

  for (const file of required) {
    const fullPath = path.join(functionsDir, file);
    if (fs.existsSync(fullPath)) {
      // Basic syntax check — require() will throw on parse errors
      try {
        // Clear cache to re-parse
        delete require.cache[require.resolve(fullPath)];
        require(fullPath);
        pass(file);
      } catch (e) {
        // Module load failures due to missing env vars are OK at build time
        if (
          e.message.includes('Cannot find module') &&
          !e.message.includes(fullPath)
        ) {
          pass(`${file} (loaded, missing optional dep: ${e.message})`);
        } else if (
          e.code === 'MODULE_NOT_FOUND' ||
          e.message.includes('firebase')
        ) {
          pass(`${file} (file exists, runtime dep missing — OK at build time)`);
        } else {
          fail(file, `syntax/load error: ${e.message}`);
        }
      }
    } else {
      fail(file, 'file not found');
    }
  }
}

// ── Check 3: External API reachability ───────────────────────────────────────

async function checkExternalApis() {
  console.log('\n3. External API Reachability');

  // setlist.fm
  try {
    const apiKey =
      process.env.SETLISTFM_API_KEY || 'VmDr8STg4UbyNE7Jgiubx2D_ojbliDuoYMgQ';
    const { statusCode } = await httpsGet(
      'https://api.setlist.fm/rest/1.0/artist/a74b1b7f-71a5-4011-9441-d0b5e4122711',
      { Accept: 'application/json', 'x-api-key': apiKey }
    );
    if (statusCode === 200 || statusCode === 403) {
      // 403 = key problem but API is reachable
      pass(`setlist.fm API (${statusCode})`);
    } else {
      fail('setlist.fm API', `unexpected status ${statusCode}`);
    }
  } catch (e) {
    fail('setlist.fm API', e.message);
  }

  // Spotify accounts (just check the domain resolves)
  try {
    const { statusCode } = await httpsGet(
      'https://accounts.spotify.com/api/token'
    );
    // 400/401 = reachable but missing auth; 405 = GET not allowed (POST-only endpoint) — all fine
    if ([200, 400, 401, 405].includes(statusCode)) {
      pass(`Spotify accounts API (${statusCode})`);
    } else {
      fail('Spotify accounts API', `unexpected status ${statusCode}`);
    }
  } catch (e) {
    fail('Spotify accounts API', e.message);
  }

  // Notion API (if configured)
  if (process.env.NOTION_API_KEY) {
    try {
      const { statusCode } = await httpsGet('https://api.notion.com/v1/users/me', {
        Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
      });
      if ([200, 401, 403].includes(statusCode)) {
        pass(`Notion API (${statusCode})`);
      } else {
        fail('Notion API', `unexpected status ${statusCode}`);
      }
    } catch (e) {
      fail('Notion API', e.message);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 MySetlists Pre-Deploy Checks\n');
  console.log(`   Environment: ${process.env.ENVIRONMENT || 'production'}`);
  console.log(`   Node.js:     ${process.version}`);

  checkEnvVars();
  checkFunctionFiles();
  await checkExternalApis();

  console.log('\n─────────────────────────────────────');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log('─────────────────────────────────────');

  if (failed > 0) {
    console.error('\n❌ Pre-deploy checks FAILED — deploy blocked.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All pre-deploy checks passed.\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Pre-deploy checks crashed:', err);
  process.exit(1);
});
