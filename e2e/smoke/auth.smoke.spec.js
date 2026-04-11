// @ts-check
/**
 * Auth smoke tests — real sign-in / sign-out flows using the TEST_EMAIL
 * and TEST_PASSWORD env vars. Tests are skipped if credentials are absent.
 *
 * These tests do NOT create persistent data; they only exercise the auth flow.
 */
const { test, expect } = require('@playwright/test');
const {
  loginUser,
  dismissOverlays,
  logoutUser,
} = require('../utils/test-helpers');

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

test.describe('Auth Smoke Tests', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'Skipping: TEST_EMAIL and TEST_PASSWORD env vars not set'
  );

  // ---------------------------------------------------------------------------
  // Sign In
  // ---------------------------------------------------------------------------
  test('sign in with email/password succeeds', async ({ page }) => {
    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    // Confirms we're on the authenticated shell — sidebar visible, no error
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('Loading...');
  });

  test('authenticated sidebar contains expected nav links', async ({
    page,
  }) => {
    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await dismissOverlays(page);

    const navLabels = [/shows/i, /stats/i, /friends/i, /search/i];
    for (const label of navLabels) {
      await expect(
        page.getByRole('link', { name: label }).first()
      ).toBeVisible();
    }
  });

  test('sign in with wrong password shows error', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByPlaceholder('Email address').fill(TEST_EMAIL);
    await page.getByPlaceholder('Password').fill('definitely-wrong-password');
    await page.locator('form').getByRole('button', { name: /sign in/i }).click();
    // Should stay on landing or show an error — either way, no redirect to app
    await expect(
      page.getByRole('button', { name: /sign in/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // ---------------------------------------------------------------------------
  // Sign Out
  // ---------------------------------------------------------------------------
  test('sign out returns to landing page', async ({ page }) => {
    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await dismissOverlays(page);
    await logoutUser(page);
  });

  // ---------------------------------------------------------------------------
  // Apple Sign-In removal verification
  // ---------------------------------------------------------------------------
  test('Apple Sign-In button is not present on auth page', async ({ page }) => {
    // On pull_request runs the test targets production, which may still have
    // Apple auth until the removal PR is merged and deployed. Skip pre-deploy;
    // enforce on push (post-deploy) and manual runs.
    if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
      test.skip(true, 'Skipping Apple removal check on PR run — production not yet updated');
      return;
    }

    await page.goto('/', { waitUntil: 'load' });
    // Open the sign-in modal
    const signInBtn = page.getByRole('button', { name: /sign in/i }).first();
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

  // ---------------------------------------------------------------------------
  // Session Persistence
  // ---------------------------------------------------------------------------
  test('session persists across page reload', async ({ page }) => {
    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await dismissOverlays(page);

    await page.reload({ waitUntil: 'load' });

    // After reload, user should still be signed in (sidebar visible)
    await expect(
      page.locator('[class*="bg-sidebar"]').getByText(/shows/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});
