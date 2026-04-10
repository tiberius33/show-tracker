// @ts-check
/**
 * Core smoke tests — page loads, navigation, and guest mode.
 * These run unauthenticated and should complete in < 60 seconds.
 * No test credentials required.
 */
const { test, expect } = require('@playwright/test');

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
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /get started/i }).first()
    ).toBeVisible();
  });

  test('shows guest mode button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /try it first/i })
    ).toBeVisible();
  });

  test('renders feature grid', async ({ page }) => {
    const features = [
      'Track Every Show',
      'Scan Ticket Stubs',
      'Import Your History',
      'Create Playlists',
      'Discover Your Stats',
      'Connect with Friends',
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
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Welcome Back')).toBeVisible();
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
  });

  test('get started opens signup form', async ({ page }) => {
    await page.getByRole('button', { name: /get started/i }).first().click();
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
  });

  test('can switch between login and signup', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();
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
    await expect(page.getByText('Guest').first()).toBeVisible({
      timeout: 15000,
    });

    for (const label of [/stats/i, 'Search for a Show', /roadmap/i]) {
      const locator =
        typeof label === 'string'
          ? page.getByRole('link', { name: label })
          : page.getByRole('link', { name: label });
      await locator.click();
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('exit guest mode returns to landing', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.getByRole('button', { name: /try it first/i }).click();
    await expect(page.getByText('Guest').first()).toBeVisible({
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
    await expect(
      page.getByRole('button', { name: /get started/i }).first()
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
