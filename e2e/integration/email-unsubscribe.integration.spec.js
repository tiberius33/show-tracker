// @ts-check
/**
 * Email unsubscribe + announcements, against a deployed site (v5.38.0).
 *
 * Needs TEST_EMAIL / TEST_PASSWORD (a NON-admin account) for the auth
 * checks. The signed-link tests also need UNSUBSCRIBE_SECRET — the same
 * value the deployed site uses — to mint a token for the test account;
 * they skip without it. They touch only the test account's own
 * announcements preference and put it back at the end.
 */
const { test, expect } = require('@playwright/test');
const { getIdToken } = require('../utils/firebaseIdToken');

const BASE = process.env.TEST_BASE_URL || 'https://mysetlists.net';
const HAVE_ACCOUNT = !!(process.env.TEST_EMAIL && process.env.TEST_PASSWORD);
const HAVE_SECRET = !!process.env.UNSUBSCRIBE_SECRET;

async function prefs(request, idToken) {
  const res = await request.get(`${BASE}/api/email-preferences`, { headers: { Authorization: `Bearer ${idToken}` } });
  expect(res.status()).toBe(200);
  return res.json();
}

async function setPrefs(request, idToken, body) {
  const res = await request.post(`${BASE}/api/email-preferences`, {
    headers: { Authorization: `Bearer ${idToken}` }, data: body,
  });
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe('Email unsubscribe & announcements', () => {
  test('admin-list-unsubscribes: 401 without a token', async ({ request }) => {
    const res = await request.get(`${BASE}/.netlify/functions/admin-list-unsubscribes`);
    expect(res.status()).toBe(401);
  });

  test('admin-list-unsubscribes: 403 for a non-admin', async ({ request }) => {
    test.skip(!HAVE_ACCOUNT, 'TEST_EMAIL / TEST_PASSWORD not set');
    const { idToken } = await getIdToken(request);
    const res = await request.get(`${BASE}/.netlify/functions/admin-list-unsubscribes`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('admin-send-announcement: 403 for a non-admin, sends nothing', async ({ request }) => {
    test.skip(!HAVE_ACCOUNT, 'TEST_EMAIL / TEST_PASSWORD not set');
    const { idToken } = await getIdToken(request);
    for (const mode of ['preview', 'test', 'send']) {
      const res = await request.post(`${BASE}/.netlify/functions/admin-send-announcement`, {
        headers: { Authorization: `Bearer ${idToken}` },
        data: { mode, subject: 'x', html: '<p>x</p>', extraEmails: [] },
      });
      expect(res.status(), mode).toBe(403);
    }
  });

  test('send-email: 401 without a token', async ({ request }) => {
    const res = await request.post(`${BASE}/.netlify/functions/send-email`, {
      data: { to: 'nobody@example.com', subject: 'x', html: '<p>x</p>' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET shows a confirmation page and does not unsubscribe; one-click POST does', async ({ request, page }) => {
    test.skip(!HAVE_ACCOUNT || !HAVE_SECRET, 'Needs TEST_EMAIL / TEST_PASSWORD and UNSUBSCRIBE_SECRET');
    const { sign } = require('../../netlify/functions/lib/unsubscribeToken');
    const { idToken, uid } = await getIdToken(request);

    const start = await prefs(request, idToken);
    test.skip(start.emailOptOut, 'Test account has all email turned off; nothing to observe');
    if (start.announcementsOptOut) await setPrefs(request, idToken, { announcementsOptOut: false });

    const token = sign({ kind: 'uid', id: uid, scope: 'announcements', source: 'announcement:e2e' });
    const url = `${BASE}/api/unsubscribe?token=${encodeURIComponent(token)}`;

    try {
      // GET: a page with buttons, and nothing changes.
      await page.goto(url, { waitUntil: 'load' });
      await expect(page.locator('h1')).toHaveText('Unsubscribe');
      await expect(page.getByRole('button', { name: 'Unsubscribe from announcements' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Unsubscribe from all MySetlists emails' })).toBeVisible();
      expect((await prefs(request, idToken)).announcementsOptOut).toBe(false);

      // One-click POST: 200, empty body, flag set.
      const res = await request.post(url, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: 'List-Unsubscribe=One-Click',
        maxRedirects: 0,
      });
      expect(res.status()).toBe(200);
      expect(await res.text()).toBe('');
      const after = await prefs(request, idToken);
      expect(after.announcementsOptOut).toBe(true);
      expect(after.emailOptOut).toBe(false);
    } finally {
      await setPrefs(request, idToken, { announcementsOptOut: start.announcementsOptOut });
    }
  });
});
