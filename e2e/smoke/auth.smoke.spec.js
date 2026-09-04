// @ts-check
/**
 * Auth smoke tests — sign-in / sign-out flows using the TEST_EMAIL and
 * TEST_PASSWORD env vars. Tests are skipped if credentials are absent.
 *
 * These tests do NOT create persistent data; they only exercise the auth flow.
 *
 * SPLIT INTO TWO HALVES ON PURPOSE. Only the tests that exercise signing in
 * actually sign in; everything that merely needs to *be* signed in reuses
 * the one session captured by e2e/auth.setup.js. This file used to perform
 * four sign-ins plus a deliberate failed one, and shows.smoke.spec.js added
 * five more via a beforeEach — ten attempts a run, twenty with retries, one
 * account, one CI IP. Firebase throttled it, and the resulting
 * `auth/too-many-requests` failed the entire suite. See e2e/auth.setup.js.
 */
const { test, expect } = require('@playwright/test');
const { loginUser } = require('../utils/test-helpers');

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

test.describe('Auth Smoke Tests', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'Skipping: TEST_EMAIL and TEST_PASSWORD env vars not set'
  );

  // ═══════════════════════════════════════════════════════════════════
  // Signed out — these must start from a clean, logged-out context, so
  // they deliberately do NOT load the saved session.
  // ═══════════════════════════════════════════════════════════════════

  test('sign in with email/password succeeds', async ({ page }) => {
    // The one test whose entire point is the sign-in flow, so it is the one
    // place outside auth.setup.js that authenticates for real.
    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    // Confirms we're on the authenticated shell — sidebar visible, no error
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('Loading...');
  });

  test('sign in with wrong password shows error', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    // Landing page uses "Log in" in v2 design; the modal submit button still says "Sign In"
    await page.getByRole('button', { name: /log in/i }).click();
    // Deliberately NOT TEST_EMAIL. Firebase's throttle weighs *failed*
    // attempts most heavily, so spending one every run against the same
    // account every other test signs in with is precisely what tipped the
    // suite into auth/too-many-requests. An address that cannot exist
    // exercises the same "credentials rejected" path and costs the real
    // account nothing.
    await page.getByPlaceholder('Email address').fill('no-such-account@example.invalid');
    await page.getByPlaceholder('Password').fill('definitely-wrong-password');
    await page.locator('form').getByRole('button', { name: /sign in/i }).click();
    // Should stay on landing or show an error — either way, no redirect to app
    await expect(
      page.getByRole('button', { name: /sign in/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // ---------------------------------------------------------------------------
  // Apple Sign-In removal verification
  // ---------------------------------------------------------------------------
  test('Apple Sign-In button is not present on auth page', async ({ page }) => {
    // On pull_request runs this used to target production, which may still
    // have Apple auth until the removal PR is merged and deployed. PR runs
    // now target the branch's own deploy preview, but the skip is kept
    // until the removal has shipped to production so the two runs agree.
    if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
      test.skip(true, 'Skipping Apple removal check on PR run — production not yet updated');
      return;
    }

    await page.goto('/', { waitUntil: 'load' });
    // Open the sign-in modal — v2 landing page uses "Log in"
    const signInBtn = page.getByRole('button', { name: /log in/i }).first();
    if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await signInBtn.click();
    }
    // Apple button must not appear
    await expect(
      page.getByRole('button', { name: /sign in with apple|sign up with apple/i })
    ).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Sign in with Apple');
    await expect(page.locator('body')).not.toContainText('Sign up with Apple');
  });
});
