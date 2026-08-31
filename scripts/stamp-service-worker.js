#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * Stamps public/service-worker.js's CACHE_NAME with the current
 * package.json version, so every release actually invalidates the
 * previous cache instead of silently reusing it.
 *
 * Why this exists: CACHE_NAME was hardcoded to 'mysetlists-v3' from the
 * commit that introduced the service worker and was never bumped again.
 * Because the service worker's own script bytes never changed across
 * releases, browsers never detected a new version to install — the
 * activate handler's cache cleanup (which deletes any cache name other
 * than CACHE_NAME) never ran, and clients kept being served whatever
 * app shell they first cached, weeks of feature releases behind. Tying
 * the constant to the version means the file's bytes change on every
 * version bump, which is exactly what makes the browser's service worker
 * update algorithm notice, install, skipWaiting, and clients.claim.
 *
 * Runs automatically before every build via the `prebuild` npm script.
 */

const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const swPath = path.join(__dirname, '..', 'public', 'service-worker.js');

const source = fs.readFileSync(swPath, 'utf8');
const pattern = /^const CACHE_NAME = '.*';$/m;

if (!pattern.test(source)) {
  console.error(`[stamp-service-worker] Could not find a CACHE_NAME line to replace in ${swPath}`);
  process.exit(1);
}

const stamped = source.replace(pattern, `const CACHE_NAME = 'mysetlists-v${pkg.version}';`);
fs.writeFileSync(swPath, stamped);
console.log(`[stamp-service-worker] CACHE_NAME set to mysetlists-v${pkg.version}`);
