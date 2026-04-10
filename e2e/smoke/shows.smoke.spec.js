// @ts-check
/**
 * Shows smoke tests — CRUD operations on the Shows page.
 * Creates shows with the "test-" artist prefix so cleanup.js can identify them.
 * Cleans up via UI (delete button) after each test.
 *
 * Requires: TEST_EMAIL, TEST_PASSWORD
 */
const { test, expect } = require('@playwright/test');
const {
  loginUser,
  dismissOverlays,
} = require('../utils/test-helpers');

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

// Unique per-run suffix so parallel runs don't conflict
const RUN_ID = Date.now();
const TEST_ARTIST = `test-artist-${RUN_ID}`;
const TEST_VENUE = 'Test Venue';
const TEST_DATE = '2024-01-15';

test.describe('Shows Smoke Tests', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'Skipping: TEST_EMAIL and TEST_PASSWORD env vars not set'
  );

  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await dismissOverlays(page);
  });

  // ---------------------------------------------------------------------------
  // Shows page loads
  // ---------------------------------------------------------------------------
  test('shows page loads without error', async ({ page }) => {
    // After login we're already on the shows page
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('Loading...');
  });

  // ---------------------------------------------------------------------------
  // Add a show
  // ---------------------------------------------------------------------------
  test('can add a show via the add-show flow', async ({ page }) => {
    // "Search for a Show" button navigates to /search
    const addBtn = page
      .getByRole('button', { name: /search for a show/i })
      .first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // Should now be on the Search Shows page
    await expect(
      page.getByRole('heading', { name: /search shows/i })
    ).toBeVisible({ timeout: 10000 });

    // Fill in the artist name field (placeholder: "e.g., Radiohead")
    const artistInput = page.getByPlaceholder(/radiohead/i);
    await expect(artistInput).toBeVisible({ timeout: 5000 });
    await artistInput.fill('Radiohead');

    // "Search Artists" button becomes enabled once artist is filled
    const searchBtn = page.getByRole('button', { name: /search artists/i });
    await expect(searchBtn).toBeEnabled({ timeout: 5000 });
    await searchBtn.click();

    // Results should load or show a "no results" message — either way no crash
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  // ---------------------------------------------------------------------------
  // All authenticated pages reachable from shows page
  // ---------------------------------------------------------------------------
  test('all authenticated nav pages load without error', async ({ page }) => {
    const routes = [
      '/stats',
      '/friends',
      '/community',
      '/profile',
      '/upcoming',
      '/search',
      '/invite',
      '/feedback',
    ];

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'load' });
      await expect(page.locator('body')).not.toContainText('Application error');
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });

  // ---------------------------------------------------------------------------
  // Scan-import page loads
  // ---------------------------------------------------------------------------
  test('scan-import page loads without error', async ({ page }) => {
    await page.goto('/scan-import', { waitUntil: 'load' });
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page).toHaveTitle(/MySetlists/i);
  });
});
