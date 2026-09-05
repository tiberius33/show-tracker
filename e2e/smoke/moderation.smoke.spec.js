// @ts-check
/**
 * Moderation smoke tests — the App Store Guideline 1.2 surfaces.
 *
 * These run UNAUTHENTICATED and write nothing. That is deliberate: the
 * smoke suite runs against production on every push to main (see
 * .github/workflows/smoke-tests.yml), and a suite that filed real reports
 * against real comments would be hiding real users' content every time CI
 * ran. The destructive half of the flow — report, auto-hide, admin
 * dismiss — is in e2e/integration/moderation.integration.spec.js, which
 * needs its own throwaway accounts and skips itself without them.
 *
 * What is checked here is exactly what an App Store reviewer checks first:
 * that the published contact information and the Community Guidelines
 * exist and say what they need to say, on pages reachable without an
 * account.
 */
const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Published contact information (Guideline 1.2, requirement 4)
// ---------------------------------------------------------------------------
test.describe('Guideline 1.2 — published contact information', () => {
  test('the support address is reachable without an account', async ({ page }) => {
    // The footer is on the signed-out landing page, which is the point:
    // Apple wants this findable by someone who has not signed up.
    await page.goto('/', { waitUntil: 'load' });
    const supportLink = page.locator('a[href="mailto:support@mysetlists.net"]').first();
    await expect(supportLink).toBeVisible();
  });

  test('the footer points at the Community Guidelines', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    // Matched on the fragment rather than the whole href: next.config.js
    // sets trailingSlash, so `/terms#community-guidelines` is rendered as
    // `/terms/#community-guidelines`, and pinning the exact string means
    // this test breaks the day that setting changes.
    await expect(
      page.locator('a[href*="#community-guidelines"]').first()
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Community Guidelines (Guideline 1.2, and the 24-hour commitment)
// ---------------------------------------------------------------------------
test.describe('Guideline 1.2 — Community Guidelines', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/terms', { waitUntil: 'load' });
  });

  test('the Terms carry a Community Guidelines section', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /community guidelines/i })
    ).toBeVisible();
  });

  test('it states the 24-hour review commitment', async ({ page }) => {
    // The commitment is the part Guideline 1.2 actually asks for ("with
    // the developer removing the offending content and ejecting the user
    // ... in a timely manner"). If this text ever goes away, the feature
    // has quietly stopped promising the thing it was built to promise.
    await expect(page.getByText(/within 24 hours/i).first()).toBeVisible();
  });

  test('it names the report and block mechanisms', async ({ page }) => {
    const body = page.locator('#community-guidelines');
    await expect(body).toContainText(/report/i);
    await expect(body).toContainText(/block/i);
    await expect(body).toContainText(/blocked accounts/i);
  });

  test('it commits to filtering before publication', async ({ page }) => {
    await expect(
      page.locator('#community-guidelines')
    ).toContainText(/before they are published/i);
  });

  test('the footer link actually lands on the section', async ({ page }) => {
    // Followed for real from the landing page rather than navigated to
    // directly: the thing worth testing is that a signed-out visitor can
    // GET to the guidelines, which was not true before v5.32.0 — every
    // route rendered the landing page when logged out, so following this
    // link put you back where you started.
    await page.goto('/', { waitUntil: 'load' });
    await page.locator('a[href*="#community-guidelines"]').first().click();
    await expect(page.locator('#community-guidelines')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /community guidelines/i })
    ).toBeVisible();
  });
});
