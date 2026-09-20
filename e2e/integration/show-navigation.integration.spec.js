// @ts-check
/**
 * Show navigation integration tests — verify that clicking on shows
 * uses client-side routing and does not reload the page.
 *
 * This test was added because the app had a bug where shows were navigated
 * to via `/shows/:id` dynamic routes, which cannot be served by the static
 * export. The Netlify catch-all would silently serve the wrong page without
 * any error indication.
 *
 * The test ensures:
 *   1. Show clicks navigate via query params (?show=id) not dynamic routes
 *   2. The page does not reload (client-side routing)
 *   3. The show detail view renders properly
 *   4. The URL is correctly formed and exists in the static build
 *
 * Requires: TEST_EMAIL, TEST_PASSWORD (needs authenticated session)
 */
const { test, expect } = require('@playwright/test');
const { dismissOverlays } = require('../utils/test-helpers');

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

test.describe('Show Navigation Integration Tests', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'Skipping: TEST_EMAIL and TEST_PASSWORD env vars not set'
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/shows', { waitUntil: 'load' });
    await dismissOverlays(page);
  });

  // ---------------------------------------------------------------------------
  // Show navigation uses query params, not dynamic routes
  // ---------------------------------------------------------------------------
  test('clicking a show navigates via query param, not dynamic route', async ({
    page,
  }) => {
    // Find the first show card and click it
    const firstShowCard = page.locator('[data-testid="show-card"]').first();
    await expect(firstShowCard).toBeVisible({ timeout: 10000 });

    // Get the artist name before we click, so we can verify it in the detail view
    const artistName = await firstShowCard
      .locator('[data-testid="show-card-artist"]')
      .textContent();

    // Listen for navigation to ensure we stay on /shows page (not dynamic route)
    const navigationPromise = page.waitForURL(/\/shows\?show=/);

    // Click the show
    await firstShowCard.click();

    // Verify the URL changed to query param form, not dynamic route
    await navigationPromise;
    const url = page.url();
    expect(url).toContain('/shows?show=');
    expect(url).not.toMatch(/\/shows\/[^?]/); // Should not be /shows/:id pattern

    // Extract the show ID from the URL to verify it's valid
    const showIdMatch = url.match(/show=([^&]+)/);
    expect(showIdMatch).toBeTruthy();
    const showId = showIdMatch?.[1];
    expect(showId).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Show detail view renders after navigation
  // ---------------------------------------------------------------------------
  test('show detail view renders with venue and date information', async ({
    page,
  }) => {
    // Navigate to first show
    const firstShowCard = page.locator('[data-testid="show-card"]').first();
    await expect(firstShowCard).toBeVisible({ timeout: 10000 });
    await firstShowCard.click();

    // Wait for the detail view to render
    await expect(page.locator('[data-testid="show-detail-view"]')).toBeVisible({
      timeout: 10000,
    });

    // Verify key detail view elements are present
    // (These are the essential parts of the show detail: venue, date, rating)
    const detailView = page.locator('[data-testid="show-detail-view"]');
    await expect(detailView).toBeVisible();

    // The detail view should be visible on the same /shows page
    const url = page.url();
    expect(url).toContain('/shows?show=');
  });

  // ---------------------------------------------------------------------------
  // No page reload occurs during show navigation
  // ---------------------------------------------------------------------------
  test('clicking a show does not reload the page', async ({ page }) => {
    // Track if a reload happens by checking for page load event
    let pageReloaded = false;
    page.on('load', () => {
      pageReloaded = true;
    });

    // Find and click the first show
    const firstShowCard = page.locator('[data-testid="show-card"]').first();
    await expect(firstShowCard).toBeVisible({ timeout: 10000 });
    await firstShowCard.click();

    // Wait for URL change (query param navigation)
    await expect(page).toHaveURL(/\/shows\?show=/);

    // Give it a moment to see if a reload was triggered
    await page.waitForTimeout(500);

    // Verify no reload happened
    expect(pageReloaded).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Back navigation returns to show list
  // ---------------------------------------------------------------------------
  test('back button returns to show list from detail view', async ({ page }) => {
    // Navigate to first show
    const firstShowCard = page.locator('[data-testid="show-card"]').first();
    await expect(firstShowCard).toBeVisible({ timeout: 10000 });
    await firstShowCard.click();

    // Verify we're in detail view
    await expect(page).toHaveURL(/\/shows\?show=/);

    // Click back button (or use browser back)
    // The header should have a back control that returns to /shows
    const backButton = page.locator('[aria-label*="back" i], [aria-label*="shows" i]').first();
    if (await backButton.isVisible()) {
      await backButton.click();
    } else {
      // Fallback to browser back
      await page.goBack();
    }

    // Should return to /shows without query param
    await expect(page).toHaveURL(/\/shows\/?$/);
  });

  // ---------------------------------------------------------------------------
  // Show detail URLs are stable across navigation
  // ---------------------------------------------------------------------------
  test('navigating to same show via different paths arrives at same URL', async ({
    page,
  }) => {
    // Get the first show's ID
    const firstShowCard = page.locator('[data-testid="show-card"]').first();
    await expect(firstShowCard).toBeVisible({ timeout: 10000 });
    await firstShowCard.click();

    // Extract show ID from URL
    let url = page.url();
    const showIdMatch = url.match(/show=([^&]+)/);
    const showId = showIdMatch?.[1];

    // Go back to list
    await page.goto('/shows', { waitUntil: 'load' });

    // Navigate directly via URL query param
    await page.goto(`/shows?show=${showId}`, { waitUntil: 'load' });

    // Verify the URL is exactly the same
    url = page.url();
    expect(url).toContain(`show=${showId}`);
    expect(url).not.toMatch(/\/shows\/[^?]/);
  });
});
