// @ts-check
const { defineConfig } = require('@playwright/test');

// Specs that need a signed-in session. They run in their own project so a
// sign-in outage costs only these — see the `smoke-auth` project below.
const AUTHENTICATED_SPECS = ['**/shows.smoke.spec.js', '**/session.smoke.spec.js'];
const AUTH_FILE = 'e2e/.auth/user.json';


module.exports = defineConfig({
  // Default directory for legacy e2e tests (smoke.spec.js, popup.spec.js)
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://mysetlists.net',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  reporter: [
    ['list'],
    // Notion reporter runs whenever NOTION_API_KEY + NOTION_TEST_DATABASE_ID are set.
    // It silently no-ops when the env vars are absent.
    ['./tests/utils/notion-reporter.js'],
  ],

  projects: [
    // ── Setup: one sign-in per run, shared by the authenticated tests ─────
    // Deliberately outside ./e2e/smoke so the smoke project doesn't also
    // collect it as an ordinary test.
    {
      name: 'setup',
      testDir: './e2e',
      testMatch: /auth\.setup\.js/,
      use: {
        baseURL: process.env.TEST_BASE_URL || 'https://mysetlists.net',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        browserName: 'chromium',
      },
    },

    // ── Smoke: fast, critical-path, run on every push ─────────────────────
    // Everything that does NOT need a session: API health, email endpoints,
    // legal pages, guest mode, and the sign-in flow itself.
    //
    // Deliberately has NO dependency on `setup`. When the whole smoke
    // project depended on it, a throttled test account failed setup and
    // took all 36 tests with it, including the two dozen that never touch
    // auth — worse signal than the problem being fixed. These keep
    // reporting whether or not signing in is possible.
    {
      name: 'smoke',
      testDir: './e2e/smoke',
      testIgnore: AUTHENTICATED_SPECS,
      timeout: 30000,
      use: {
        baseURL: process.env.TEST_BASE_URL || 'https://mysetlists.net',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        browserName: 'chromium',
      },
    },

    // ── Smoke (authenticated): reuses the one session from `setup` ────────
    // The single place the signed-in storage state is configured, so no
    // spec has to remember to opt in. If setup cannot sign in, only these
    // are skipped.
    {
      name: 'smoke-auth',
      testDir: './e2e/smoke',
      testMatch: AUTHENTICATED_SPECS,
      timeout: 30000,
      dependencies: ['setup'],
      use: {
        baseURL: process.env.TEST_BASE_URL || 'https://mysetlists.net',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        browserName: 'chromium',
        storageState: AUTH_FILE,
      },
    },

    // ── Integration: feature-level, run on main branch deploys ────────────
    {
      name: 'integration',
      testDir: './e2e/integration',
      timeout: 60000,
      use: {
        baseURL: process.env.TEST_BASE_URL || 'https://mysetlists.net',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        browserName: 'chromium',
      },
    },

    // ── Legacy: existing smoke.spec.js + popup.spec.js ────────────────────
    {
      name: 'legacy-smoke',
      testMatch: ['smoke.spec.js', 'popup.spec.js'],
      use: {
        baseURL: process.env.TEST_BASE_URL || 'https://mysetlists.net',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        browserName: 'chromium',
      },
    },
  ],
});
