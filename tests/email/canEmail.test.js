/**
 * canEmail: the one opt-out decision every send path goes through.
 * Every flag × every category, then the lookups around it.
 *
 *   node tests/email/canEmail.test.js
 */

const { test, run } = require('./harness');
const assert = require('node:assert');
const { createFakeDb } = require('./fakeFirestore');
const { decideCanEmail, canEmail } = require('../../netlify/functions/lib/emailPolicy');
const { hashEmail } = require('../../netlify/functions/lib/unsubscribeToken');

const CATEGORIES = ['transactional', 'notification', 'announcement'];

// Expected: may we email? Keyed by state name, then category.
const TABLE = [
  { name: 'no flags, no suppression', profile: {}, sup: null, want: { transactional: true, notification: true, announcement: true } },
  { name: 'no account, no suppression', profile: null, sup: null, want: { transactional: true, notification: true, announcement: true } },
  { name: 'emailOptOut', profile: { emailOptOut: true }, sup: null, want: { transactional: false, notification: false, announcement: false } },
  { name: 'announcementsOptOut', profile: { announcementsOptOut: true }, sup: null, want: { transactional: true, notification: true, announcement: false } },
  { name: 'both flags', profile: { emailOptOut: true, announcementsOptOut: true }, sup: null, want: { transactional: false, notification: false, announcement: false } },
  { name: 'emailOptOut: false explicitly', profile: { emailOptOut: false, announcementsOptOut: false }, sup: null, want: { transactional: true, notification: true, announcement: true } },
  { name: 'suppression all (no account)', profile: null, sup: 'all', want: { transactional: false, notification: false, announcement: false } },
  { name: 'suppression announcements (no account)', profile: null, sup: 'announcements', want: { transactional: true, notification: true, announcement: false } },
  { name: 'suppression all (account, no flags)', profile: {}, sup: 'all', want: { transactional: false, notification: false, announcement: false } },
  { name: 'suppression announcements (account, no flags)', profile: {}, sup: 'announcements', want: { transactional: true, notification: true, announcement: false } },
  { name: 'announcementsOptOut + suppression all', profile: { announcementsOptOut: true }, sup: 'all', want: { transactional: false, notification: false, announcement: false } },
];

for (const row of TABLE) {
  for (const category of CATEGORIES) {
    test(`decideCanEmail: ${row.name} × ${category} → ${row.want[category]}`, () => {
      assert.strictEqual(decideCanEmail({ profile: row.profile, suppressionScope: row.sup, category }), row.want[category]);
    });
  }
}

test('decideCanEmail rejects an unknown category', () => {
  assert.throws(() => decideCanEmail({ profile: null, suppressionScope: null, category: 'marketing' }));
});

// The same table through the real canEmail, reading a fake Firestore,
// once by uid and once by email only.
for (const row of TABLE) {
  for (const category of CATEGORIES) {
    test(`canEmail (Firestore): ${row.name} × ${category}`, async () => {
      const db = createFakeDb();
      const email = 'person@example.com';
      if (row.profile) db._put('userProfiles/uid_person_1', { email, ...row.profile });
      if (row.sup) db._put(`emailSuppressions/${hashEmail(email)}`, { email, scope: row.sup });
      if (row.profile) {
        assert.strictEqual(await canEmail({ uid: 'uid_person_1', category }, { db }), row.want[category], 'by uid');
      }
      assert.strictEqual(await canEmail({ email: 'Person@Example.com ', category }, { db }), row.want[category], 'by email');
    });
  }
}

test('someone who unsubscribed before having an account stays unsubscribed after signing up', async () => {
  const db = createFakeDb();
  db._put(`emailSuppressions/${hashEmail('new@example.com')}`, { email: 'new@example.com', scope: 'all' });
  db._put('userProfiles/newUser123', { email: 'new@example.com' }); // signs up later, no flags
  assert.strictEqual(await canEmail({ uid: 'newUser123', category: 'notification' }, { db }), false);
  assert.strictEqual(await canEmail({ uid: 'newUser123', email: 'new@example.com', category: 'announcement' }, { db }), false);
});

test('announcement-only unsubscribe leaves notifications flowing', async () => {
  const db = createFakeDb();
  db._put('userProfiles/u1', { email: 'u1@example.com', announcementsOptOut: true });
  assert.strictEqual(await canEmail({ uid: 'u1', category: 'notification' }, { db }), true);
  assert.strictEqual(await canEmail({ uid: 'u1', category: 'announcement' }, { db }), false);
});

test('canEmail fails closed when Firestore errors', async () => {
  const broken = { doc() { return { get: async () => { throw new Error('boom'); } }; }, collection() { throw new Error('boom'); } };
  const orig = console.error; console.error = () => {};
  try {
    assert.strictEqual(await canEmail({ uid: 'x', category: 'notification' }, { db: broken }), false);
  } finally { console.error = orig; }
});

run('canEmail');
