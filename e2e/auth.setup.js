// @ts-check
/**
 * Signs in ONCE per run and saves the session for every authenticated smoke
 * test to reuse.
 *
 * WHY THIS EXISTS. Every authenticated test used to sign in for itself:
 * four standalone calls in auth.smoke.spec.js plus a beforeEach across the
 * five tests in shows.smoke.spec.js, and a wrong-password test on top —
 * ten Firebase sign-in attempts per run, doubled to twenty by `retries: 1`,
 * all from one CI IP against one account. Firebase throttles exactly that
 * pattern, and the block outlives the run, so the whole suite failed with
 * `auth/too-many-requests` — "Too many attempts. Please try again later."
 * The tests were rate-limiting themselves, and because the failure
 * surfaced as a locator timeout it read for a long time like broken
 * credentials or a broken app.
 *
 * With this, a run performs ONE real sign-in here, plus the two in
 * auth.smoke.spec.js that genuinely exercise the sign-in flow itself.
 *
 * `indexedDB: true` IS LOAD-BEARING. Firebase Auth stores its session in
 * IndexedDB, not cookies or localStorage, so a storage state captured
 * without it restores nothing and every dependent test silently starts
 * logged out. Playwright's own docs call out Firebase for this option.
 * Requires Playwright >= 1.51 (this repo is on 1.58).
 */
const { test: setup } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { AUTH_FILE, loginUser, dismissOverlays } = require('./utils/test-helpers');
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

const HAVE_CREDENTIALS = !!(TEST_EMAIL && TEST_PASSWORD);

// Done at module load, not inside the test. Projects referencing this file
// fail to start if it does not exist, but a test that requests the `page`
// or `context` fixture launches a browser *before* its body runs — so
// skipping from inside the body would still pay for a browser just to
// write a placeholder. The authenticated tests skip themselves on the same
// condition, so an empty state is never used to assert anything.
fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
if (!HAVE_CREDENTIALS) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
}

setup.skip(
  !HAVE_CREDENTIALS,
  'TEST_EMAIL / TEST_PASSWORD not set — authenticated tests will skip'
);

setup('authenticate once for the whole run', async ({ page, context }) => {
  await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
  // Clear the What's New / cookie overlays before snapshotting, so every
  // test inheriting this state starts from the same clean shell.
  await dismissOverlays(page);

  await context.storageState({ path: AUTH_FILE, indexedDB: true });
});
