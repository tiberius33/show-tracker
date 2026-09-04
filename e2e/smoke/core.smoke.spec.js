// @ts-check
/**
 * Core smoke tests — page loads, navigation, and guest mode.
 * These run unauthenticated and should complete in < 60 seconds.
 * No test credentials required.
 */
const { test, expect } = require('@playwright/test');
const { dismissOverlays } = require('../utils/test-helpers');

const BASE = process.env.TEST_BASE_URL || 'https://mysetlists.net';

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------
test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
  });

  test('loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/MySetlists/i);
  });

  test('shows sign-in and get started buttons', async ({ page }) => {
    // v2 landing page uses "Log in" and "Start tracking"
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /start tracking/i }).first()
    ).toBeVisible();
  });

  test('shows guest mode button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /try it first/i })
    ).toBeVisible();
  });

  test('renders feature grid', async ({ page }) => {
    // Feature headings updated in v2 landing page redesign
    const features = [
      'Auto-import your shows',
      'Rate & remember',
      'Stats that actually matter',
      'Follow friends & bands',
      'One-click Spotify playlists',
      'Wishlist the ones you missed',
    ];
    for (const feature of features) {
      await expect(page.getByRole('heading', { name: feature })).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Legal & Public Pages
// ---------------------------------------------------------------------------
test.describe('Legal Pages', () => {
  test('/privacy loads', async ({ page }) => {
    await page.goto('/privacy', { waitUntil: 'load' });
    await expect(page.getByText(/privacy/i).first()).toBeVisible();
  });

  test('/terms loads', async ({ page }) => {
    await page.goto('/terms', { waitUntil: 'load' });
    await expect(page.getByText(/terms/i).first()).toBeVisible();
  });

  test('/cookies loads', async ({ page }) => {
    await page.goto('/cookies', { waitUntil: 'load' });
    await expect(page.getByText(/cookie/i).first()).toBeVisible();
  });

  test('/roadmap loads without error', async ({ page }) => {
    await page.goto('/roadmap', { waitUntil: 'load' });
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page).toHaveTitle(/MySetlists/i);
  });

  test('/release-notes loads without error', async ({ page }) => {
    await page.goto('/release-notes', { waitUntil: 'load' });
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page).toHaveTitle(/MySetlists/i);
  });
});

// ---------------------------------------------------------------------------
// Auth Modal UI (unauthenticated, no credentials needed)
// ---------------------------------------------------------------------------
test.describe('Auth Modal UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
  });

  test('sign in opens login form', async ({ page }) => {
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page.getByText('Welcome Back')).toBeVisible();
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
  });

  test('get started opens signup form', async ({ page }) => {
    // v2 landing page uses "Start tracking" as the primary CTA
    await page.getByRole('button', { name: /start tracking/i }).first().click();
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
  });

  test('can switch between login and signup', async ({ page }) => {
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page.getByText('Welcome Back')).toBeVisible();
    await page.getByText('Sign up').click();
    await expect(page.getByPlaceholder(/name/i).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Guest Mode
// ---------------------------------------------------------------------------
test.describe('Guest Mode', () => {
  test('enter guest mode and navigate pages', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.getByRole('button', { name: /try it first/i }).click();
    // Guest sidebar shows "Create Account" and "Exit Guest Mode" — not a "Guest" label
    await expect(page.getByText('Exit Guest Mode').first()).toBeVisible({
      timeout: 15000,
    });

    // The cookie consent banner is `fixed bottom-0 left-0 right-0 z-50`, so
    // it sits over the lower part of the viewport and intercepts pointer
    // events for anything under it — including "How to Use", which is near
    // the bottom of the sidebar. Playwright reports that as the click
    // retrying forever against
    //   <div class="fixed bottom-0 ..."> intercepts pointer events
    // rather than as a missing element, which is easy to misread.
    // dismissOverlays already knows how to clear this (and the What's New
    // modal); the guest test simply never called it.
    await dismissOverlays(page);

    // Only links a GUEST actually has. components/layout/Sidebar.jsx hides
    // Tours, Wishlist, Bucket List, Festivals, Profile and Setlist Photos
    // behind `!isGuest`, leaving My Shows, Stats, Upcoming, "Search for a
    // show" and "How to Use".
    //
    // This list used to end with /roadmap/i, which is not in the sidebar at
    // all — not for a guest, not for anyone (it exists only as
    // app/roadmap/page.jsx and some cards). The test had been failing on a
    // link that never existed. "Support" is deliberately excluded: it is an
    // external <a> to buymeacoffee.com, and clicking it would navigate the
    // test off the site.
    for (const label of [/stats/i, /search for a show/i, /upcoming/i, /how to use/i]) {
      await page.getByRole('link', { name: label }).first().click();
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('exit guest mode returns to landing', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.getByRole('button', { name: /try it first/i }).click();
    await expect(page.getByText('Exit Guest Mode').first()).toBeVisible({
      timeout: 15000,
    });

    const cookieBanner = page
      .locator('[class*="fixed bottom-0"]')
      .filter({ hasText: /cookie|accept/i });
    if (await cookieBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cookieBanner.getByRole('button').first().click();
      await cookieBanner
        .waitFor({ state: 'hidden', timeout: 3000 })
        .catch(() => {});
    }

    await page.getByText('Exit Guest Mode').click({ force: true });
    // v2 landing page uses "Start tracking" instead of "Get started"
    await expect(
      page.getByRole('button', { name: /start tracking/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// API Health Checks (Netlify Functions)
// ---------------------------------------------------------------------------
test.describe('API Health', () => {
  test('get-entity-info returns data for Radiohead', async ({ request }) => {
    const res = await request.get(
      `${BASE}/.netlify/functions/get-entity-info?name=Radiohead&type=artist`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
  });

  test('enrich-artist returns data for Radiohead', async ({ request }) => {
    const res = await request.get(
      `${BASE}/.netlify/functions/enrich-artist?name=Radiohead`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
  });

  test('search-artists returns results', async ({ request }) => {
    const res = await request.get(
      `${BASE}/.netlify/functions/search-artists?artistName=Radiohead`
    );
    expect(res.status()).toBe(200);
  });

  test('search-setlists returns results for known artist', async ({
    request,
  }) => {
    const res = await request.get(
      `${BASE}/.netlify/functions/search-setlists?artistName=Radiohead`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.setlist).toBeDefined();
  });
});
