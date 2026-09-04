// @ts-check
const { defineConfig } = require('@playwright/test');


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
    // The saved session is opted INTO per file (see shows.smoke.spec.js and
    // the signed-in block of auth.smoke.spec.js) rather than applied as a
    // project default, because the guest-mode and sign-in tests have to
    // start logged out.
    {
      name: 'smoke',
      testDir: './e2e/smoke',
      timeout: 30000,
      dependencies: ['setup'],
      use: {
        baseURL: process.env.TEST_BASE_URL || 'https://mysetlists.net',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        browserName: 'chromium',
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
