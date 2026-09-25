/**
 * send-email — the app's one browser-initiated email path (tags, invites,
 * friend-joined, replies/likes, venue verification, admin messages).
 *
 * POST body:   { to, subject, html, type }
 *              type — short notification name for the unsubscribe log,
 *                     e.g. 'tag', 'invite' (becomes 'notification:<type>')
 * Auth header: Authorization: Bearer {idToken}   (any signed-in user)
 *
 * WHY IT'S LOCKED DOWN. Until 5.38 this took any to/subject/html from
 * anyone, from any origin, and sent it as phillip@mysetlists.net — an
 * open relay. Now it:
 *   - requires a Firebase ID token (401 without one)
 *   - only answers CORS for the site and the iOS app's origin
 *   - rate-limits each sender (RATE_LIMIT_PER_HOUR; admins exempt)
 *   - decides opt-out on the server (canEmail), and resolves the
 *     recipient's account from `to` itself — never from a client-supplied
 *     uid, or a caller could mint a signed unsubscribe link for someone else
 *   - stamps every message with the recipient's signed unsubscribe footer
 *     and List-Unsubscribe headers
 *
 * A signed-in user can still send arbitrary HTML to an arbitrary address
 * (tag-by-email and invites need that). The rate limit bounds it; moving
 * templating server-side would remove it.
 */

const { getDb, getAdminAuth, verifyUser, isAdminClaims } = require('./lib/firebaseAdmin');
const { canEmail, resolveRecipient } = require('./lib/emailPolicy');
const { buildEmail, sendOne } = require('./lib/outgoingEmail');
const { isValidEmail, normalizeEmail } = require('./lib/unsubscribeToken');

const RATE_LIMIT_PER_HOUR = 30;
const WINDOW_MS = 60 * 60 * 1000;

const ALLOWED_ORIGINS = [
  'https://mysetlists.net',
  'https://www.mysetlists.net',
  'capacitor://localhost', // the iOS app (capacitor.config.ts sets no iosScheme)
];

function corsHeaders(event) {
  const origin = (event.headers || {}).origin || (event.headers || {}).Origin || '';
  const h = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGINS.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

/** Fixed hourly window per sender, in emailRateLimits/{uid}. */
async function takeRateLimit(db, uid, now = Date.now()) {
  const ref = db.doc(`emailRateLimits/${uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : null;
    const fresh = !d || now - (d.windowStart || 0) >= WINDOW_MS;
    const count = fresh ? 0 : d.count || 0;
    if (count >= RATE_LIMIT_PER_HOUR) return false;
    tx.set(ref, { uid, windowStart: fresh ? now : d.windowStart, count: count + 1, updatedAt: new Date(now) });
    return true;
  });
}

exports.handler = async function (event) {
  const headers = corsHeaders(event);
  const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  const decoded = await verifyUser(event);
  if (!decoded) return reply(401, { error: 'Sign in required' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid JSON body' }); }

  const { to, subject, html, type } = body;
  if (!to || !subject || !html) return reply(400, { error: 'Missing required fields: to, subject, html' });
  if (typeof to !== 'string' || !isValidEmail(to)) return reply(400, { error: 'to must be a single valid email address' });
  if (String(subject).length > 300 || String(html).length > 200_000) return reply(400, { error: 'Email too large' });

  if (!process.env.RESEND_API_KEY) return reply(500, { error: 'RESEND_API_KEY not configured' });
  if (!process.env.UNSUBSCRIBE_SECRET) return reply(500, { error: 'UNSUBSCRIBE_SECRET not configured' });

  const db = getDb();
  const admin = isAdminClaims(decoded);

  try {
    if (!admin && !(await takeRateLimit(db, decoded.uid))) {
      return reply(429, { error: `Too many emails — the limit is ${RATE_LIMIT_PER_HOUR} per hour.` });
    }
  } catch (e) {
    console.error('[send-email] rate limit check failed:', e.message);
    return reply(500, { error: 'Could not send right now' });
  }

  const email = normalizeEmail(to);
  const recipient = await resolveRecipient(db, getAdminAuth(), email);
  if (!(await canEmail({ uid: recipient.uid, email, category: 'notification' }, { db }))) {
    return reply(200, { success: true, skipped: true, reason: 'recipient opted out' });
  }

  const cleanType = String(type || 'general').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 40) || 'general';
  const payload = buildEmail({
    recipient: { email, uid: recipient.uid },
    subject: String(subject),
    html: String(html),
    scope: 'all',
    source: `notification:${cleanType}`,
  });

  const result = await sendOne(payload);
  if (result.ok) return reply(200, { success: true });
  return reply(502, { error: 'Email send failed', status: result.status });
};

exports.takeRateLimit = takeRateLimit;
exports.RATE_LIMIT_PER_HOUR = RATE_LIMIT_PER_HOUR;
exports.ALLOWED_ORIGINS = ALLOWED_ORIGINS;
