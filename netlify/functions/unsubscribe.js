/**
 * unsubscribe — the endpoint every unsubscribe link and List-Unsubscribe
 * header points at.
 *
 *   GET  /api/unsubscribe?token=…   Confirmation page with a button. Does
 *        NOT unsubscribe: corporate link scanners and mail previewers
 *        fetch every link in an email, and a GET that unsubscribed would
 *        silently remove people who never clicked anything.
 *   POST /api/unsubscribe?token=…   body "List-Unsubscribe=One-Click"
 *        RFC 8058 one-click, sent by Gmail/Apple Mail's own Unsubscribe
 *        button. Unsubscribes and returns 200 with no page and no redirect.
 *   POST /api/unsubscribe?token=…   body "scope=all|announcements"
 *        The confirmation page's button. Unsubscribes and shows a
 *        "You're unsubscribed" page.
 *
 * Tokens are signed (lib/unsubscribeToken.js). A pre-5.38 token — just a
 * base64 uid — unsubscribes nobody; it gets a page pointing at Profile.
 * Every real unsubscribe, repeat or not, is logged to unsubscribeEvents.
 */

const { getDb, getAdminAuth } = require('./lib/firebaseAdmin');
const { verify, isLegacyToken } = require('./lib/unsubscribeToken');
const { applyUnsubscribe, resolveEmailForUid } = require('./lib/emailPolicy');
const { escapeHtml } = require('./lib/emailLayout');

const APP_URL = 'https://mysetlists.net';
const PROFILE_URL = `${APP_URL}/profile/`;

const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
  // The token is in the URL; don't hand it to anything we link to.
  'Referrer-Policy': 'no-referrer',
};

function page(title, bodyHtml, { tone = 'ok' } = {}) {
  const accent = tone === 'error' ? '#ef6b6b' : '#34D399';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)} · MySetlists</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; }
    body {
      min-height: 100vh; min-height: 100dvh;
      background: #2a2a4e; color: #f1f1f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      padding: max(24px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
               max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      -webkit-text-size-adjust: 100%;
    }
    .card {
      width: 100%; max-width: 440px; background: #1f1f3a;
      border: 1px solid rgba(255,255,255,0.08); border-radius: 20px;
      padding: 36px 24px; text-align: center;
      box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    }
    .brand { font-weight: 800; font-size: 18px; letter-spacing: -0.02em; margin: 0 0 24px; color: #fff; }
    .brand span { color: #34D399; }
    h1 { color: ${accent}; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 12px; }
    p { color: #b8b8d0; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
    .email { color: #fff; font-weight: 600; word-break: break-all; }
    form { margin: 0; display: flex; flex-direction: column; gap: 12px; }
    button, .btn {
      display: block; width: 100%; min-height: 48px; padding: 14px 20px;
      border-radius: 12px; border: 0; cursor: pointer;
      font: 700 16px/1.2 'Plus Jakarta Sans', -apple-system, sans-serif;
      text-decoration: none; -webkit-appearance: none; appearance: none;
    }
    .primary { background: #34D399; color: #2a2a4e; }
    .primary:active { background: #059669; }
    .secondary { background: transparent; color: #f1f1f7; border: 1px solid rgba(255,255,255,0.22); }
    a { color: #34D399; font-weight: 600; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .links { margin-top: 20px; font-size: 14px; color: #8e8eab; }
  </style>
</head>
<body>
  <main class="card">
    <p class="brand">my<span>setlists</span></p>
    <h1>${escapeHtml(title)}</h1>
    ${bodyHtml}
  </main>
</body>
</html>`;
}

function html(statusCode, title, bodyHtml, opts) {
  return { statusCode, headers: PAGE_HEADERS, body: page(title, bodyHtml, opts) };
}

const invalidPage = () => html(400, 'Link not recognised',
  `<p>This unsubscribe link isn't valid. You can manage your email settings from your Profile.</p>
   <a class="btn primary" href="${PROFILE_URL}">Open email settings</a>`, { tone: 'error' });

const legacyPage = () => html(200, 'This link has expired',
  `<p>This link has expired. Manage your email settings from your Profile.</p>
   <a class="btn primary" href="${PROFILE_URL}">Open MySetlists</a>`);

const errorPage = () => html(500, 'Something went wrong',
  `<p>We couldn't update your email settings just now. Please try again in a minute, or turn emails off from your Profile.</p>
   <a class="btn secondary" href="${PROFILE_URL}">Open email settings</a>`, { tone: 'error' });

function successPage(scope) {
  const what = scope === 'announcements'
    ? "You won't get MySetlists announcements any more. You'll still get emails about your own activity, like tags and replies."
    : "You won't get any more emails from MySetlists.";
  return html(200, "You're unsubscribed",
    `<p>${what}</p>
     <p class="links">Changed your mind? <a href="${PROFILE_URL}">Update your email settings</a></p>`);
}

function parseBody(event) {
  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  let params;
  try { params = new URLSearchParams(raw); } catch { params = new URLSearchParams(); }
  // RFC 8058 allows multipart/form-data too; the one field that matters is
  // unmistakable in either encoding.
  const oneClick = params.get('List-Unsubscribe') === 'One-Click'
    || /name="List-Unsubscribe"[\s\S]*?One-Click/i.test(raw);
  return { oneClick, scope: params.get('scope') };
}

async function recipientEmail(db, auth, payload) {
  if (payload.kind === 'email') return payload.id;
  try {
    const snap = await db.doc(`userProfiles/${payload.id}`).get();
    return await resolveEmailForUid(db, auth, payload.id, snap.exists ? snap.data() : null);
  } catch {
    return null;
  }
}

exports.handler = async function (event) {
  const method = event.httpMethod;
  if (method !== 'GET' && method !== 'POST') {
    return { statusCode: 405, headers: { ...PAGE_HEADERS, Allow: 'GET, POST' }, body: page('Not allowed', '<p>Method not allowed.</p>', { tone: 'error' }) };
  }

  const token = event.queryStringParameters?.token || '';
  const payload = verify(token);

  if (!payload) {
    if (method === 'POST' && parseBody(event).oneClick) {
      return { statusCode: 400, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, body: '' };
    }
    return isLegacyToken(token) ? legacyPage() : invalidPage();
  }

  let db, auth;
  try {
    db = getDb();
    auth = getAdminAuth();
  } catch (e) {
    console.error('[unsubscribe] firebase init failed:', e.message);
    return errorPage();
  }

  if (method === 'GET') {
    const email = await recipientEmail(db, auth, payload);
    const who = email ? `<span class="email">${escapeHtml(email)}</span>` : 'this address';
    const action = `/api/unsubscribe?token=${encodeURIComponent(token)}`;
    const buttons = payload.scope === 'announcements'
      ? `<button class="primary" type="submit" name="scope" value="announcements">Unsubscribe from announcements</button>
         <button class="secondary" type="submit" name="scope" value="all">Unsubscribe from all MySetlists emails</button>`
      : `<button class="primary" type="submit" name="scope" value="all">Unsubscribe from all MySetlists emails</button>`;
    const lead = payload.scope === 'announcements'
      ? `Stop sending product news and announcements to ${who}?`
      : `Stop sending MySetlists emails to ${who}?`;
    return html(200, 'Unsubscribe', `<p>${lead}</p>
      <form method="POST" action="${action}">${buttons}</form>
      <p class="links" style="margin-bottom:0">Or <a href="${PROFILE_URL}">manage email settings</a> in the app.</p>`);
  }

  // POST
  const { oneClick, scope: requested } = parseBody(event);
  // The page may broaden an announcements link to "all"; nothing narrows.
  const scope = oneClick ? payload.scope
    : (requested === 'all' || requested === payload.scope ? requested : payload.scope);
  try {
    await applyUnsubscribe(db, auth, { payload, scope, method: oneClick ? 'one-click' : 'link' });
  } catch (e) {
    console.error('[unsubscribe] write failed:', e);
    if (oneClick) return { statusCode: 500, headers: { 'Content-Type': 'text/plain' }, body: '' };
    return errorPage();
  }
  if (oneClick) {
    return { statusCode: 200, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, body: '' };
  }
  return successPage(scope);
};
