// @ts-check
/**
 * Email smoke tests — the send-email and unsubscribe functions are alive
 * and hold their security properties. Never sends real email during normal
 * runs.
 *
 * Since 5.38 send-email requires a Firebase ID token (it was an open relay)
 * and unsubscribe links are signed, so these check:
 *   - send-email: 401 without a token, CORS only for the site/iOS origins
 *   - unsubscribe: an old base64-uid link shows the "expired" page and a
 *     one-click POST with one is refused; a bad token is a 400 page
 *
 * A full delivery test is gated behind TEST_SEND_REAL_EMAIL=true.
 */
const { test, expect } = require('@playwright/test');
const { getIdToken } = require('../utils/firebaseIdToken');

const BASE = process.env.TEST_BASE_URL || 'https://mysetlists.net';
const SEND_EMAIL_URL = `${BASE}/.netlify/functions/send-email`;
const UNSUBSCRIBE_URL = `${BASE}/.netlify/functions/unsubscribe`;

test.describe('Email Smoke Tests', () => {
  // ---------------------------------------------------------------------------
  // send-email: auth + CORS
  // ---------------------------------------------------------------------------
  test('send-email CORS preflight answers the site origin', async ({ request }) => {
    const res = await request.fetch(SEND_EMAIL_URL, {
      method: 'OPTIONS',
      headers: { Origin: 'https://mysetlists.net' },
    });
    expect([200, 204]).toContain(res.status());
    expect(res.headers()['access-control-allow-origin']).toBe('https://mysetlists.net');
  });

  test('send-email CORS preflight does not answer other origins', async ({ request }) => {
    const res = await request.fetch(SEND_EMAIL_URL, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.headers()['access-control-allow-origin']).toBeUndefined();
  });

  test('send-email without a token returns 401 and sends nothing', async ({ request }) => {
    const res = await request.post(SEND_EMAIL_URL, {
      data: { to: 'nobody@example.com', subject: 'x', html: '<p>x</p>' },
    });
    expect(res.status()).toBe(401);
  });

  test('send-email with an empty body and no token is still 401', async ({ request }) => {
    const res = await request.post(SEND_EMAIL_URL, { data: {} });
    expect(res.status()).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // Unsubscribe endpoint
  // ---------------------------------------------------------------------------
  test('unsubscribe with no token shows an error page, not a crash', async ({ request }) => {
    const res = await request.get(UNSUBSCRIBE_URL);
    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('Link not recognised');
  });

  test('legacy base64-uid unsubscribe link shows the "expired" page', async ({ request }) => {
    const legacy = Buffer.from('legacyUidForSmokeTest0001').toString('base64url');
    const res = await request.get(`${BASE}/api/unsubscribe?token=${legacy}`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('This link has expired');
    expect(html).toContain('/profile/');
  });

  test('legacy link cannot unsubscribe via one-click POST', async ({ request }) => {
    const legacy = Buffer.from('legacyUidForSmokeTest0001').toString('base64url');
    const res = await request.post(`${BASE}/api/unsubscribe?token=${legacy}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: 'List-Unsubscribe=One-Click',
    });
    expect(res.status()).toBe(400);
  });

  test('tampered signed token is rejected', async ({ request }) => {
    const res = await request.get(`${BASE}/api/unsubscribe?token=eyJ2IjoxfQ.not-a-real-signature`);
    expect(res.status()).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // Email preferences endpoint health
  // ---------------------------------------------------------------------------
  test('update-email-preferences endpoint is reachable', async ({ request }) => {
    const res = await request.fetch(
      `${BASE}/.netlify/functions/update-email-preferences`,
      { method: 'OPTIONS' }
    );
    expect([200, 204, 405]).toContain(res.status());
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
    if (!testAddress || !process.env.TEST_PASSWORD) {
      throw new Error('TEST_EMAIL and TEST_PASSWORD must be set when TEST_SEND_REAL_EMAIL=true');
    }
    const { idToken } = await getIdToken(request);

    const res = await request.post(SEND_EMAIL_URL, {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        to: testAddress,
        subject: `[MySetlists Test] Smoke test — ${new Date().toISOString()}`,
        html: '<p>This is an automated smoke test email. You can safely ignore it.</p>',
        type: 'smoke_test',
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
