#!/usr/bin/env node
'use strict';

/**
 * Verify the App Review demo account reads back the way the app reads it.
 *
 * seed-review-account.js proves documents were written. This proves they can
 * be *queried* — which is a different thing, and the difference is where a
 * reviewer ends up staring at an empty screen. A missing composite index
 * throws FAILED_PRECONDITION on the exact query the app runs, and Firestore
 * hands back a console URL to create it. Better to find that here than in
 * App Review.
 *
 * Every query below is copied from the shape the app actually issues.
 *
 *   node scripts/verify-review-account.js
 */

(function loadDotEnv() {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
})();

const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const REVIEW_EMAIL = process.env.REVIEW_EMAIL || 'appreview@mysetlists.net';
const FRIEND_EMAIL = process.env.REVIEW_FRIEND_EMAIL || 'reviewfriend@mysetlists.net';

if (!getApps().length) {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  initializeApp({
    credential: cert({
      privateKey,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      projectId: process.env.FIREBASE_PROJECT_ID,
    }),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}
const db = getFirestore();
const auth = getAuth();

let ok = 0;
const problems = [];
const indexUrls = [];

function pass(label, detail) { ok++; console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`); }
function fail(label, why) { problems.push(`${label}: ${why}`); console.log(`  FAIL  ${label} — ${why}`); }

async function guarded(label, fn) {
  try { return await fn(); }
  catch (e) {
    const msg = e.message || String(e);
    const url = (msg.match(/https:\/\/console\.firebase\.google\.com\S+/) || [])[0];
    if (url) { indexUrls.push(`${label}\n      ${url}`); fail(label, 'missing composite index'); }
    else fail(label, msg.split('\n')[0]);
    return null;
  }
}

(async () => {
  console.log('\nReview account readback\n');

  // ── accounts ──
  let reviewUid, friendUid;
  for (const [who, email] of [['reviewer', REVIEW_EMAIL], ['friend', FRIEND_EMAIL]]) {
    try {
      const u = await auth.getUserByEmail(email);
      if (who === 'reviewer') reviewUid = u.uid; else friendUid = u.uid;
      if (u.disabled) fail(`${who} account enabled`, 'the account is DISABLED and cannot sign in');
      else pass(`${who} account`, `${u.uid}${u.emailVerified ? '' : ' (email not verified)'}`);
    } catch (e) { fail(`${who} account`, e.message); }
  }
  if (!reviewUid) { console.log('\nCannot continue without the reviewer account.\n'); process.exit(1); }

  // ── sign-in provider ──
  await guarded('email/password sign-in enabled', async () => {
    // A password can only be set if the provider is on; a user created with one
    // will list it in providerData.
    const u = await auth.getUser(reviewUid);
    const providers = u.providerData.map(p => p.providerId);
    if (providers.includes('password')) pass('email/password provider', providers.join(', '));
    else fail('email/password provider', `only ${providers.join(', ') || 'none'} — a reviewer cannot sign in with the credentials you give Apple`);
  });

  // ── profiles and handles ──
  for (const [who, uid] of [['reviewer', reviewUid], ['friend', friendUid]]) {
    if (!uid) continue;
    const snap = await db.doc(`userProfiles/${uid}`).get();
    if (!snap.exists) { fail(`${who} profile`, 'userProfiles document missing'); continue; }
    const d = snap.data();
    pass(`${who} profile`, `${d.displayName} @${d.handle} · ${d.showCount} shows`);
    if (d.publicProfile !== true) fail(`${who} public profile`, 'publicProfile is not true; /u/handle will 404');
    const h = await db.doc(`handles/${(d.handleLower || '')}`).get();
    if (h.exists && h.data().uid === uid) pass(`${who} handle mapping`);
    else fail(`${who} handle mapping`, `handles/${d.handleLower} missing or points elsewhere`);
  }

  // ── shows ──
  const reviewShows = await db.collection(`users/${reviewUid}/shows`).get();
  reviewShows.size >= 10
    ? pass('reviewer shows', `${reviewShows.size} documents`)
    : fail('reviewer shows', `only ${reviewShows.size}`);

  const friendShows = friendUid ? await db.collection(`users/${friendUid}/shows`).get() : { size: 0, docs: [] };
  pass('friend shows', `${friendShows.size} documents`);

  // Shows Together: the app intersects normalized show keys.
  const keyOf = s => s.setlistfmId || `${(s.artist || '').trim().toLowerCase()}|${(s.venue || '').trim().toLowerCase()}|${(s.date || '').trim().toLowerCase()}`;
  const friendKeys = new Set(friendShows.docs.map(d => keyOf(d.data())));
  const shared = reviewShows.docs.map(d => keyOf(d.data())).filter(k => friendKeys.has(k));
  shared.length >= 3
    ? pass('shows together', `${shared.length} shared shows`)
    : fail('shows together', `only ${shared.length} overlap — the friends screen will look empty`);

  // ── friend edges, both directions ──
  const fwd = await db.doc(`users/${reviewUid}/friends/${friendUid}`).get();
  const rev = friendUid ? await db.doc(`users/${friendUid}/friends/${reviewUid}`).get() : { exists: false };
  fwd.exists && rev.exists
    ? pass('friend edges', 'both directions')
    : fail('friend edges', `forward ${fwd.exists}, reverse ${rev.exists} — friendship must be written both ways`);

  // ── comments: the app's exact query, composite index included ──
  const sampleKey = shared[0] || keyOf(reviewShows.docs[0].data());
  await guarded('comments query', async () => {
    const snap = await db.collection('showComments')
      .where('concertKey', '==', sampleKey).orderBy('createdAt', 'asc').get();
    snap.size > 0 ? pass('comments query', `${snap.size} on the sample show`)
                  : fail('comments query', 'returned nothing for a show that should have comments');
  });

  const allComments = await db.collection('showComments').where('authorUid', 'in', [reviewUid, friendUid].filter(Boolean)).get();
  pass('comments seeded', `${allComments.size} total across both accounts`);

  // ── media ──
  await guarded('media query', async () => {
    const keys = [...new Set(reviewShows.docs.map(d => keyOf(d.data())))].slice(0, 10);
    let found = 0;
    for (const k of keys) {
      const snap = await db.collection('showPhotos').where('concertKey', '==', k).get();
      found += snap.size;
    }
    found > 0 ? pass('media query', `${found} item(s) reachable from the reviewer's shows`)
              : fail('media query', 'no media found on any of the reviewer\'s shows');
  });

  // ── activity feed: friends only, ordered ──
  await guarded('activity feed query', async () => {
    const snap = await db.collection('userActivity')
      .where('userId', 'in', [friendUid]).orderBy('timestamp', 'desc').limit(20).get();
    snap.size > 0 ? pass('activity feed query', `${snap.size} item(s) from the friend`)
                  : fail('activity feed query', 'empty — the activity tab will show nothing');
  });

  // ── pending tag, lists ──
  const tags = await db.collection('showTags').where('toUid', '==', reviewUid).get();
  const pending = tags.docs.filter(d => d.data().status === 'pending');
  pending.length > 0 ? pass('pending friend tag', `${pending.length}`) : fail('pending friend tag', 'none');

  const wl = await db.collection('wishlists').where('userId', '==', reviewUid).get();
  const wlSongs = wl.docs.reduce((n, d) => n + Object.keys(d.data().songs || {}).length, 0);
  wlSongs > 0 ? pass('wishlist', `${wlSongs} song(s)`) : fail('wishlist', 'empty (docs with no songs are hidden by the app)');

  const bl = await db.collection('bucketList').where('userId', '==', reviewUid).get();
  bl.size > 0 ? pass('bucket list', `${bl.size} item(s)`) : fail('bucket list', 'empty');

  const blocks = await db.doc(`userBlocks/${reviewUid}`).get();
  blocks.exists ? pass('blocked accounts screen', 'userBlocks document present') : fail('blocked accounts', 'missing');

  // ── summary ──
  console.log(`\n${ok} checks passed, ${problems.length} problem(s).`);
  if (indexUrls.length) {
    console.log('\nMissing Firestore indexes — open each URL to create it, then re-run:\n');
    for (const u of indexUrls) console.log(`   ${u}`);
    console.log('\nAdd them to firestore.indexes.json too, or the next `npm run deploy:rules` drops them.');
  }
  if (problems.length) { console.log(''); process.exit(1); }
  console.log('\nThe review account reads back cleanly. Next: sign in on a device and look at it.\n');
})().catch(e => { console.error(e); process.exit(1); });
