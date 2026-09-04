// @ts-check
/**
 * Tests that need to BE signed in but do not exercise signing in.
 *
 * These reuse the single session captured by e2e/auth.setup.js and cost no
 * Firebase sign-in of their own. They live in their own file, apart from
 * auth.smoke.spec.js, because Playwright selects projects by FILE: the
 * `smoke-auth` project depends on the setup project and this file belongs
 * to it, while auth.smoke.spec.js's signed-out tests belong to `smoke`,
 * which has no such dependency.
 *
 * That split is deliberate and was learned the hard way. When the whole
 * smoke project depended on setup, a throttled test account failed setup
 * and took all 36 tests down with it — including the two dozen that never
 * touch authentication at all (API health, email endpoints, legal pages).
 * That is strictly worse signal than the problem it was fixing. Now a
 * sign-in outage costs exactly the tests that genuinely need a session.
 *
 * The signed-in storage state comes from the project config, not a
 * `test.use()` here, so there is one place that decides it.
 */
const { test, expect } = require('@playwright/test');
const { dismissOverlays, logoutUser } = require('../utils/test-helpers');

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

test.describe('Restored Session Smoke Tests', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'Skipping: TEST_EMAIL and TEST_PASSWORD env vars not set'
  );

  test('authenticated sidebar contains expected nav links', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await dismissOverlays(page);

    const navLabels = [/shows/i, /stats/i, /friends/i, /search/i];
    for (const label of navLabels) {
      await expect(
        page.getByRole('link', { name: label }).first()
      ).toBeVisible();
    }
  });

  test('sign out returns to landing page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await dismissOverlays(page);
    await logoutUser(page);
  });

  test('session persists across page reload', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await dismissOverlays(page);

    await page.reload({ waitUntil: 'load' });

    // Restoring from storage state and surviving a reload are the same
    // property this always asserted: that the session lives somewhere
    // durable rather than only in memory.
    await expect(
      page.locator('[class*="bg-sidebar"]').getByText(/shows/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});
