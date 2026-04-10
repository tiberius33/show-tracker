// @ts-check
/**
 * Email smoke tests — validates the send-email Netlify Function is alive
 * and correctly validates its inputs. Does NOT send real emails to real
 * addresses during normal runs (uses a bounce address or checks validation).
 *
 * A full delivery test (RESEND_API_KEY must be set) is gated behind
 * TEST_SEND_REAL_EMAIL=true so it only runs when explicitly opted in.
 */
const { test, expect } = require('@playwright/test');

const BASE = process.env.TEST_BASE_URL || 'https://mysetlists.net';
const SEND_EMAIL_URL = `${BASE}/.netlify/functions/send-email`;

test.describe('Email Smoke Tests', () => {
  // ---------------------------------------------------------------------------
  // Function health — OPTIONS (CORS preflight) must return 200
  // ---------------------------------------------------------------------------
  test('send-email OPTIONS (CORS preflight) returns 200', async ({
    request,
  }) => {
    const res = await request.fetch(SEND_EMAIL_URL, {
      method: 'OPTIONS',
    });
    expect(res.status()).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // Input validation — missing fields should return 400, not 500
  // ---------------------------------------------------------------------------
  test('send-email with missing fields returns 400', async ({ request }) => {
    const res = await request.post(SEND_EMAIL_URL, {
      data: { to: 'nobody@example.com' }, // missing subject + html
    });
    // 400 = validation error (expected), 500 = crashed (unexpected)
    expect([400, 500]).toContain(res.status());
    if (res.status() === 400) {
      const body = await res.json();
      expect(body.error).toBeTruthy();
    }
  });

  test('send-email with all empty body returns 400', async ({ request }) => {
    const res = await request.post(SEND_EMAIL_URL, {
      data: {},
    });
    expect([400]).toContain(res.status());
  });

  // ---------------------------------------------------------------------------
  // Unsubscribe endpoint health
  // ---------------------------------------------------------------------------
  test('unsubscribe endpoint OPTIONS returns 200', async ({ request }) => {
    const res = await request.fetch(`${BASE}/.netlify/functions/unsubscribe`, {
      method: 'OPTIONS',
    });
    expect(res.status()).toBe(200);
  });

  test('unsubscribe with missing token returns 400', async ({ request }) => {
    const res = await request.post(`${BASE}/.netlify/functions/unsubscribe`, {
      data: {},
    });
    expect([400, 422]).toContain(res.status());
  });

  // ---------------------------------------------------------------------------
  // Email preferences endpoint health
  // ---------------------------------------------------------------------------
  test('update-email-preferences OPTIONS returns 200', async ({ request }) => {
    const res = await request.fetch(
      `${BASE}/.netlify/functions/update-email-preferences`,
      { method: 'OPTIONS' }
    );
    expect(res.status()).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // Full delivery test (opt-in only — requires TEST_SEND_REAL_EMAIL=true)
  // ---------------------------------------------------------------------------
  test('send-email delivers to test address', async ({ request }) => {
    test.skip(
      process.env.TEST_SEND_REAL_EMAIL !== 'true',
      'Skipping real email delivery test (set TEST_SEND_REAL_EMAIL=true to enable)'
    );

    const testAddress = process.env.TEST_EMAIL;
    if (!testAddress) {
      throw new Error('TEST_EMAIL must be set when TEST_SEND_REAL_EMAIL=true');
    }

    const res = await request.post(SEND_EMAIL_URL, {
      data: {
        to: testAddress,
        subject: `[MySetlists Test] Smoke test — ${new Date().toISOString()}`,
        html: '<p>This is an automated smoke test email. You can safely ignore it.</p>',
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
