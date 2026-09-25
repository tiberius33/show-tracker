/**
 * unsubscribeToken — signed, non-expiring unsubscribe tokens. Server only.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload part))
 * keyed with UNSUBSCRIBE_SECRET.
 *
 * WHY SIGNED. The old token was base64url(uid) and nothing else, and uids
 * appear in public URLs, so anyone could unsubscribe anyone. A token is now
 * only valid if this server minted it, for exactly the recipient and scope
 * it names.
 *
 * WHY NO EXPIRY. An unsubscribe link in an email from last year still has
 * to work — that is a CAN-SPAM requirement, not a nicety. Rotating
 * UNSUBSCRIBE_SECRET invalidates every link ever sent, so don't.
 *
 * LEGACY TOKENS. A pre-5.38 token has no "." (base64url never contains
 * one). isLegacyToken() lets the endpoint show a "manage it from your
 * Profile" page for those instead of honouring them — honouring them is
 * the exploit.
 */

const crypto = require('crypto');

const KINDS = ['uid', 'email'];
const SCOPES = ['all', 'announcements'];

function getSecret() {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (!s) throw new Error('UNSUBSCRIBE_SECRET is not configured');
  return s;
}

function hmac(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashEmail(email) {
  return crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

// Deliberately modest: one @, something before it, a dotted domain after,
// no whitespace. Resend rejects the rest anyway; this just stops a typo
// from costing a batch.
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;
function isValidEmail(email) {
  const e = normalizeEmail(email);
  return e.length <= 254 && EMAIL_RE.test(e);
}

function sanitizeSource(source) {
  const s = String(source || '');
  return /^(announcement|notification):[A-Za-z0-9_\-]{1,64}$/.test(s) ? s : 'notification:unknown';
}

function sign({ kind, id, scope, source }) {
  if (!KINDS.includes(kind)) throw new Error(`Invalid token kind: ${kind}`);
  if (!SCOPES.includes(scope)) throw new Error(`Invalid token scope: ${scope}`);
  if (!id) throw new Error('Token id is required');
  const payload = {
    v: 1,
    k: kind,
    i: kind === 'email' ? normalizeEmail(id) : String(id),
    s: scope,
    src: sanitizeSource(source),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmac(body, getSecret())}`;
}

/** Returns { kind, id, scope, source } for a genuine token, otherwise null. */
function verify(token) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, sig] = parts;
  let secret;
  try { secret = getSecret(); } catch { return null; }
  const expected = Buffer.from(hmac(body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (p.v !== 1 || !KINDS.includes(p.k) || !SCOPES.includes(p.s) || !p.i) return null;
    return { kind: p.k, id: p.i, scope: p.s, source: sanitizeSource(p.src) };
  } catch {
    return null;
  }
}

function isLegacyToken(token) {
  return typeof token === 'string' && token.length > 0 && !token.includes('.') && /^[A-Za-z0-9_\-=]+$/.test(token);
}

const SITE_URL = 'https://mysetlists.net';

function unsubscribeUrl(tokenFields) {
  return `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(sign(tokenFields))}`;
}

module.exports = {
  sign, verify, isLegacyToken, unsubscribeUrl,
  normalizeEmail, hashEmail, isValidEmail, sanitizeSource,
  KINDS, SCOPES, SITE_URL,
};
