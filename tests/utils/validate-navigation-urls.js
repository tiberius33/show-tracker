#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * Navigation URL validation — runs after the build to ensure all navigation
 * targets actually exist in the static export.
 *
 * This test was created because the app had dynamic routes (/shows/:id) that
 * could not be served by the static export. Netlify's catch-all silently served
 * the wrong page (the SPA root at /index.html), so the bug was undetectable
 * without checking the build output.
 *
 * The test catches two types of mistakes:
 *   1. Interpolated path segments like `/shows/${id}` — these cannot work in a
 *      static export and must use query parameters instead
 *   2. Navigation to paths that don't exist in `out/` — these would be silently
 *      served the wrong page by Netlify's catch-all
 *
 * Exit code 0 = all navigation targets exist in build output
 * Exit code 1 = one or more targets missing or interpolated
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

// ── Configuration ────────────────────────────────────────────────────────────

// Navigation patterns to search for:
//   - router.push|replace('<path>') or (pathname)
//   - href='<path>' or href={<path>}
//   - href="<path>"
const NAVIGATION_PATTERNS = [
  // router.push("...") or router.replace("...")
  /router\.(push|replace)\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  // href="..." or href='...'
  /href\s*=\s*["']([^"']+)["']/g,
  // href={variableName} — skip these, they're runtime values
  /href\s*=\s*\{(?![^}]*\$\{)([^}]+)\}/g,
];

const INTERPOLATION_PATTERNS = [
  // Template literals: ${...}
  /\$\{[^}]+\}/,
  // Template string backticks: `...`
  /`[^`]*\$\{/,
];

// Paths that should be skipped:
//   - External URLs (http://, https://, mailto:, etc.)
//   - Protocol-relative URLs (//)
//   - anchor links (#)
const SKIP_PREFIXES = [
  'http://', 'https://', 'mailto:', 'tel:', 'ftp://',
  '//', '#'
];

// Dynamic routes that ARE pre-generated in the static export with placeholders.
// These use Next.js [param] pattern which generates _/index.html files, so
// dynamic path segments are safe (Next.js serves the placeholder route for any ID).
// Check the build output: routes marked with ● /path/[param] → /path/_
const KNOWN_DYNAMIC_ROUTES = [
  '/year-in-review/:userId/:year',
  '/venues/:venueKey',
  '/venue-dashboard/:venueKey',
];

// Routes that are real and pre-generated (check navRoutes.js for completeness)
const KNOWN_ROUTES = [
  '/',
  '/shows',
  '/shows/',
  '/search',
  '/search/',
  '/stats',
  '/stats/',
  '/stats/runs',
  '/stats/runs/',
  '/stats/songs',
  '/stats/songs/',
  '/stats/top-artists',
  '/stats/top-artists/',
  '/stats/top-venues',
  '/stats/top-venues/',
  '/upcoming',
  '/upcoming/',
  '/profile',
  '/profile/',
  '/friends',
  '/friends/',
  '/invite',
  '/invite/',
  '/activity',
  '/activity/',
  '/notifications',
  '/notifications/',
  '/meetups',
  '/meetups/',
  '/community',
  '/community/',
  '/roadmap',
  '/roadmap/',
  '/feedback',
  '/feedback/',
  '/how-to-use',
  '/how-to-use/',
  '/release-notes',
  '/release-notes/',
  '/songs',
  '/songs/',
  '/runs',
  '/runs/',
  '/tours',
  '/tours/',
  '/festivals',
  '/festivals/',
  '/wishlist',
  '/wishlist/',
  '/bucket-list',
  '/bucket-list/',
  '/setlist-photos',
  '/setlist-photos/',
  '/scan-import',
  '/scan-import/',
  '/advanced-search',
  '/advanced-search/',
  '/admin',
  '/admin/',
  '/admin/venue-verifications',
  '/admin/venue-verifications/',
];

// Paths with dynamic segments should NEVER be navigated to directly
// They must use query parameters instead
const FORBIDDEN_DYNAMIC_PATTERNS = [
  /\/shows\/\$\{/,
  /\/venues\/\$\{/,
  /\/venue-dashboard\/\$\{/,
  /\/year-in-review\/\$\{/,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let findings = [];

function pass(name) {
  console.log(`  ✓ ${name}`);
  passed++;
}

function fail(name, details) {
  console.error(`  ✗ ${name}`);
  for (const line of details) {
    console.error(`    ${line}`);
  }
  failed++;
}

function extractNavigationUrls(content, filePath) {
  const urls = [];

  for (const pattern of NAVIGATION_PATTERNS) {
    let match;
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      // match[0] is the full match, last group is the URL
      const url = match[match.length - 1];
      const line = content.substring(0, match.index).split('\n').length;

      urls.push({ url, line, filePath, fullMatch: match[0] });
    }
  }

  return urls;
}

function hasInterpolation(url) {
  for (const pattern of INTERPOLATION_PATTERNS) {
    if (pattern.test(url)) {
      return true;
    }
  }
  return false;
}

function shouldSkip(url) {
  return SKIP_PREFIXES.some(prefix => url.startsWith(prefix));
}

function matchesDynamicRoute(urlWithInterpolation) {
  // Convert template literal path like /year-in-review/${user.uid}/${year}/
  // into a pattern like /year-in-review/*/*/
  const pattern = urlWithInterpolation.replace(/\$\{[^}]+\}/g, '*').replace(/\/$/, '');

  for (const dynamicRoute of KNOWN_DYNAMIC_ROUTES) {
    const routePattern = dynamicRoute.replace(/:[a-zA-Z]+/g, '*');
    if (pattern === routePattern || pattern + '/' === dynamicRoute.replace(/:[a-zA-Z]+/g, '*') + '/') {
      return true;
    }
  }
  return false;
}

function normalizePathForFileCheck(urlPath) {
  // Strip query params and fragments
  let normalized = urlPath.split('?')[0].split('#')[0];

  // Remove trailing slash for consistency
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function fileExistsInBuild(urlPath) {
  // Check if the path exists in out/ directory
  // Paths can be:
  //   - /shows → out/shows/index.html
  //   - /shows/ → out/shows/index.html (same)
  //   - /shows/?show=x → out/shows/index.html (query stripped)

  const normalized = normalizePathForFileCheck(urlPath);

  // Root path is always valid
  if (normalized === '') {
    return fs.existsSync(path.join('out', 'index.html'));
  }

  // Try both: /path/index.html and /path (as file)
  const withIndex = path.join('out', normalized, 'index.html');
  const asFile = path.join('out', normalized + '.html');

  return fs.existsSync(withIndex) || fs.existsSync(asFile);
}

// ── Validation Logic ────────────────────────────────────────────────────────

function checkNavigationUrls() {
  console.log('\n5. Navigation URL Validation\n');

  // Only check client-side source files (components, app, lib)
  // Skip: netlify/functions (server-side), tests, node_modules, build artifacts
  const sourceFiles = globSync('{components,app,lib}/**/*.{jsx,js,tsx,ts}', {
    ignore: [
      '**/node_modules/**',
      '**/__tests__/**',
      '**/*.test.{js,jsx,ts,tsx}',
      '**/lib/emailTemplates.js', // Email URLs are server-side
      '**/lib/__tests__/**',
    ],
  });

  if (sourceFiles.length === 0) {
    console.warn('  ⚠  No source files found — skipping navigation validation');
    return;
  }

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const urls = extractNavigationUrls(content, file);

    for (const { url, line, filePath, fullMatch } of urls) {
      // Skip external URLs and variable references
      if (shouldSkip(url) || url.startsWith('app-settings:') || !url.startsWith('/')) {
        continue;
      }

      const relPath = path.relative(process.cwd(), filePath);

      // Check for interpolated segments in paths that start with / — these are errors
      if (url.startsWith('/') && hasInterpolation(url)) {
        // BUT: allow known dynamic routes that ARE pre-generated (have [param] support)
        if (matchesDynamicRoute(url)) {
          continue; // This is OK — the route is pre-generated
        }

        findings.push({
          type: 'interpolated',
          file: relPath,
          line,
          url,
          message: `Interpolated path segment — must use query params instead: "${url.substring(0, 60)}"`,
        });
        continue;
      }

      // Check for forbidden dynamic patterns (e.g., /shows/${id})
      let isForbidden = false;
      for (const pattern of FORBIDDEN_DYNAMIC_PATTERNS) {
        if (pattern.test(url)) {
          isForbidden = true;
          findings.push({
            type: 'forbidden-dynamic',
            file: relPath,
            line,
            url,
            message: `Dynamic route — must use query params: "${url}"`,
          });
          break;
        }
      }
      if (isForbidden) continue;

      // Check if path exists in build output
      if (!KNOWN_ROUTES.includes(url) && !KNOWN_ROUTES.includes(url + '/')) {
        // Not in known routes list, check if file exists
        if (!fileExistsInBuild(url)) {
          findings.push({
            type: 'missing-file',
            file: relPath,
            line,
            url,
            message: `Path does not exist in build: "out/${normalizePathForFileCheck(url)}/index.html"`,
          });
        }
      }
    }
  }

  // Report findings
  if (findings.length === 0) {
    pass('All navigation URLs exist in build output');
  } else {
    const interpolated = findings.filter(f => f.type === 'interpolated');
    const forbidden = findings.filter(f => f.type === 'forbidden-dynamic');
    const missing = findings.filter(f => f.type === 'missing-file');

    if (interpolated.length > 0) {
      fail(
        `${interpolated.length} interpolated path segments found`,
        [
          'These cannot work in a static export — use query parameters instead.',
          'Example: instead of `/shows/${id}`, navigate to `/shows/?show=${id}`',
          '',
          ...interpolated.map(f => `  ${f.file}:${f.line} — ${f.url}`),
        ]
      );
    }

    if (forbidden.length > 0) {
      fail(
        `${forbidden.length} dynamic route patterns found`,
        [
          'Dynamic routes like /shows/:id cannot be served by static export.',
          'Use the query-param pattern defined in lib/navRoutes.js instead.',
          '',
          ...forbidden.map(f => `  ${f.file}:${f.line} — ${f.url}`),
        ]
      );
    }

    if (missing.length > 0) {
      fail(
        `${missing.length} navigation URLs not found in build output`,
        [
          'These URLs would be silently served Netlify\'s SPA catch-all (/index.html).',
          'Verify the path is correct and the route is in ROUTES in lib/navRoutes.js.',
          '',
          ...missing.map(f => `  ${f.file}:${f.line} → ${f.url}`),
        ]
      );
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('🔍 Navigation URL Validation\n');

  // Only run if `out/` directory exists (after build)
  if (!fs.existsSync('out')) {
    console.warn('⚠  Build output (out/) not found — skipping validation');
    return;
  }

  checkNavigationUrls();

  console.log('\n─────────────────────────────────────');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log('─────────────────────────────────────');

  if (failed > 0) {
    console.error('\n❌ Navigation validation FAILED.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All navigation URLs are valid.\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Navigation validation crashed:', err);
  process.exit(1);
});
