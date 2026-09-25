/**
 * Signed unsubscribe tokens, and the email normalisation/hashing the
 * suppression list is keyed on.
 *
 *   node tests/email/unsubscribeToken.test.js
 */

const { test, run } = require('./harness');
const assert = require('node:assert');
const {
  sign, verify, isLegacyToken, normalizeEmail, hashEmail, isValidEmail, unsubscribeUrl,
} = require('../../netlify/functions/lib/unsubscribeToken');

test('sign → verify round trip (uid)', () => {
  const t = sign({ kind: 'uid', id: 'abcDEF1234567890', scope: 'all', source: 'notification:tag' });
  assert.deepStrictEqual(verify(t), { kind: 'uid', id: 'abcDEF1234567890', scope: 'all', source: 'notification:tag' });
});

test('sign → verify round trip (email, normalised)', () => {
  const t = sign({ kind: 'email', id: '  Friend@Example.COM ', scope: 'announcements', source: 'announcement:abc123' });
  assert.deepStrictEqual(verify(t), { kind: 'email', id: 'friend@example.com', scope: 'announcements', source: 'announcement:abc123' });
});

test('tampered signature is rejected', () => {
  const t = sign({ kind: 'uid', id: 'user1234567890', scope: 'all', source: 'notification:tag' });
  const [body, sig] = t.split('.');
  const flipped = sig[0] === 'A' ? `B${sig.slice(1)}` : `A${sig.slice(1)}`;
  assert.strictEqual(verify(`${body}.${flipped}`), null);
});

test('tampered payload is rejected (swapping the uid)', () => {
  const t = sign({ kind: 'uid', id: 'victim123456789', scope: 'all', source: 'notification:tag' });
  const sig = t.split('.')[1];
  const forged = Buffer.from(JSON.stringify({ v: 1, k: 'uid', i: 'someoneElse1234', s: 'all', src: 'notification:tag' })).toString('base64url');
  assert.strictEqual(verify(`${forged}.${sig}`), null);
});

test('token signed with a different secret is rejected', () => {
  const t = sign({ kind: 'uid', id: 'user1234567890', scope: 'all', source: 'notification:tag' });
  const saved = process.env.UNSUBSCRIBE_SECRET;
  process.env.UNSUBSCRIBE_SECRET = 'a-completely-different-secret-value-xyz';
  try { assert.strictEqual(verify(t), null); } finally { process.env.UNSUBSCRIBE_SECRET = saved; }
});

test('legacy base64-uid token is rejected by verify and recognised as legacy', () => {
  const legacy = Buffer.from('AbCdEfGhIjKlMnOpQrStUvWxYz12').toString('base64url');
  assert.strictEqual(verify(legacy), null);
  assert.strictEqual(isLegacyToken(legacy), true);
});

test('garbage and signed tokens are not legacy', () => {
  assert.strictEqual(isLegacyToken(''), false);
  assert.strictEqual(isLegacyToken('<script>'), false);
  assert.strictEqual(isLegacyToken(sign({ kind: 'uid', id: 'u1234567890', scope: 'all', source: 'notification:x' })), false);
  assert.strictEqual(verify('not.a.token'), null);
  assert.strictEqual(verify(''), null);
  assert.strictEqual(verify(null), null);
});

test('tokens do not expire (no time in the payload)', () => {
  const t = sign({ kind: 'uid', id: 'u1234567890', scope: 'all', source: 'notification:x' });
  const payload = JSON.parse(Buffer.from(t.split('.')[0], 'base64url').toString());
  assert.deepStrictEqual(Object.keys(payload).sort(), ['i', 'k', 's', 'src', 'v']);
});

test('invalid kind/scope cannot be signed', () => {
  assert.throws(() => sign({ kind: 'nope', id: 'x', scope: 'all', source: 'notification:x' }));
  assert.throws(() => sign({ kind: 'uid', id: 'x', scope: 'some', source: 'notification:x' }));
});

test('unknown source is sanitised, not trusted', () => {
  const t = sign({ kind: 'uid', id: 'u1234567890', scope: 'all', source: 'javascript:alert(1)' });
  assert.strictEqual(verify(t).source, 'notification:unknown');
});

test('verify fails closed without a secret', () => {
  const t = sign({ kind: 'uid', id: 'u1234567890', scope: 'all', source: 'notification:x' });
  const saved = process.env.UNSUBSCRIBE_SECRET;
  delete process.env.UNSUBSCRIBE_SECRET;
  try {
    assert.strictEqual(verify(t), null);
    assert.throws(() => sign({ kind: 'uid', id: 'u1', scope: 'all', source: 'notification:x' }));
  } finally { process.env.UNSUBSCRIBE_SECRET = saved; }
});

test('unsubscribeUrl points at /api/unsubscribe with an encoded token', () => {
  const u = unsubscribeUrl({ kind: 'email', id: 'a@b.co', scope: 'all', source: 'notification:invite' });
  assert.match(u, /^https:\/\/mysetlists\.net\/api\/unsubscribe\?token=[A-Za-z0-9_\-.%]+$/);
  assert.ok(verify(decodeURIComponent(u.split('token=')[1])));
});

test('email normalisation: trim + lowercase', () => {
  assert.strictEqual(normalizeEmail('  Foo.Bar@Example.COM\n'), 'foo.bar@example.com');
  assert.strictEqual(normalizeEmail(null), '');
});

test('hashEmail is sha256 of the normalised address', () => {
  const expected = require('crypto').createHash('sha256').update('foo@example.com').digest('hex');
  assert.strictEqual(hashEmail(' FOO@example.com '), expected);
  assert.strictEqual(hashEmail('foo@example.com'), hashEmail('Foo@Example.com'));
});

test('isValidEmail', () => {
  for (const ok of ['a@b.co', 'first.last+tag@sub.example.org', ' Caps@Example.COM ']) assert.ok(isValidEmail(ok), ok);
  for (const bad of ['', 'nope', 'a@b', '@b.co', 'a@@b.co', 'a b@c.co', 'a@b.c', 'a@b.co,c@d.co']) assert.ok(!isValidEmail(bad), bad);
});

run('unsubscribeToken');
