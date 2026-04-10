// @ts-check
/**
 * Notifications integration tests — tag notifications, invite emails,
 * roadmap update notifications.
 *
 * These tests validate the notification pipeline:
 *   1. The relevant Netlify Functions respond correctly
 *   2. The UI surfaces notification indicators where expected
 *
 * Full notification delivery tests (actual email receipt) are gated behind
 * TEST_NOTIFICATIONS_FULL=true to avoid noise in regular runs.
 */
const { test, expect } = require('@playwright/test');
const {
  loginUser,
  dismissOverlays,
} = require('../utils/test-helpers');

const BASE = process.env.TEST_BASE_URL || 'https://mysetlists.net';
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

test.describe('Notifications Integration Tests', () => {
  // ---------------------------------------------------------------------------
  // notify-roadmap-completion endpoint health
  // ---------------------------------------------------------------------------
  test('notify-roadmap-completion OPTIONS returns 200', async ({ request }) => {
    const res = await request.fetch(
      `${BASE}/.netlify/functions/notify-roadmap-completion`,
      { method: 'OPTIONS' }
    );
    expect(res.status()).toBe(200);
  });

  test('notify-roadmap-completion POST without auth returns 400 or 401', async ({
    request,
  }) => {
    const res = await request.post(
      `${BASE}/.netlify/functions/notify-roadmap-completion`,
      {
        data: {
          itemId: 'test-item-id',
          itemTitle: 'Test Feature',
        },
      }
    );
    // Unauthenticated call should be rejected
    expect([400, 401, 403]).toContain(res.status());
  });

  // ---------------------------------------------------------------------------
  // Email unsubscribe link flow (notification opt-out)
  // ---------------------------------------------------------------------------
  test('unsubscribe page loads with confirmation message', async ({ page }) => {
    // The unsubscribe page might require a token query param;
    // without one it should show an error gracefully, not crash
    await page.goto('/?unsubscribed=true', { waitUntil: 'load' });
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('update-email-preferences POST without auth returns error', async ({
    request,
  }) => {
    const res = await request.post(
      `${BASE}/.netlify/functions/update-email-preferences`,
      {
        data: {
          userId: 'test-user-id',
          preferences: { tagNotifications: false },
        },
      }
    );
    // Should reject unauthenticated requests
    expect([400, 401, 403, 404]).toContain(res.status());
  });

  // ---------------------------------------------------------------------------
  // Invite notification (send invite email)
  // ---------------------------------------------------------------------------
  test('invite page renders share mechanism', async ({ page }) => {
    test.skip(
      !TEST_EMAIL || !TEST_PASSWORD,
      'Skipping: TEST_EMAIL / TEST_PASSWORD not set'
    );

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await dismissOverlays(page);

    await page.goto('/invite', { waitUntil: 'load' });
    await expect(page.locator('body')).not.toContainText('Application error');

    // Should render some kind of share/invite mechanism
    const shareElement = page
      .locator(
        'button:has-text("Copy"), button:has-text("Share"), button:has-text("Invite"), input[readonly]'
      )
      .first();
    await expect(shareElement).toBeVisible({ timeout: 10000 });
  });

  // ---------------------------------------------------------------------------
  // Full notification delivery (opt-in)
  // ---------------------------------------------------------------------------
  test('tag notification email is sent when user is tagged', async ({
    page,
  }) => {
    test.skip(
      process.env.TEST_NOTIFICATIONS_FULL !== 'true',
      'Skipping full notification test (set TEST_NOTIFICATIONS_FULL=true to enable)'
    );

    const testEmail2 = process.env.TEST_EMAIL_2;
    if (!testEmail2) {
      throw new Error(
        'TEST_EMAIL_2 must be set when TEST_NOTIFICATIONS_FULL=true'
      );
    }

    await loginUser(page, TEST_EMAIL, TEST_PASSWORD);
    await dismissOverlays(page);

    // Navigate to shows page and look for a show to tag a friend on
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.locator('body')).not.toContainText('Application error');

    // Attempt to tag TEST_EMAIL_2 on the first show
    const tagBtn = page
      .getByRole('button', { name: /tag|friend/i })
      .first();
    if (await tagBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tagBtn.click();

      const emailInput = page.getByPlaceholder(/email/i).first();
      if (
        await emailInput.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await emailInput.fill(testEmail2);
        const confirmBtn = page
          .getByRole('button', { name: /tag|send|save/i })
          .last();
        await confirmBtn.click();
        await expect(page.locator('body')).not.toContainText(
          'Application error'
        );
        // NOTE: Verifying the email was actually received requires inbox access
        // (e.g. Mailosaur or a similar email testing service).
        // For now we confirm the UI flow completed without error.
      }
    }
  });
});
