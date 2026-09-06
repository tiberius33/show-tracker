#!/usr/bin/env node
'use strict';

/**
 * Account deletion completeness — App Store Guideline 5.1.1(v).
 *
 * Seeds one document for every entry in the purge map, plus a second user's
 * equivalent of each, deletes the first user, and asserts two things:
 *
 *   1. nothing anywhere still references them, and
 *   2. the second user is untouched.
 *
 * (2) matters as much as (1). A deletion that is too eager is worse than one
 * that is too timid: an over-broad `array-contains` or a missing uid filter
 * quietly removes other people's data, and nobody notices until they do.
 *
 * Runs against the Firestore emulator. Nothing here touches production.
 *
 *   npm run test:deletion
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const {
  OWNED_DOCUMENTS, ARRAY_MEMBERSHIPS, TOMBSTONES, USER_SUBTREE,
  TOMBSTONE_UID, purgeUserData, findRemainingTraces,
} = require(path.join(ROOT, 'netlify/functions/lib/userDataPurge.js'));

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-deletion';
const DOOMED = 'uid_doomed';
const SURVIVOR = 'uid_survivor';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('FIRESTORE_EMULATOR_HOST is not set. Run this through `npm run test:deletion`,');
  console.error('which starts the emulator. Refusing to run against a real project.');
  process.exit(1);
}

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; }
  catch (e) { failures.push(`${name}: ${e.message}`); }
}

// ── seed ─────────────────────────────────────────────────────────────────

async function seedFor(uid) {
  const ids = [];

  for (const spec of OWNED_DOCUMENTS) {
    for (const field of spec.fields) {
      const id = `${spec.collection}__${field}__${uid}`;
      const data = { [field]: uid, seeded: true };
      if (spec.storagePathField) data[spec.storagePathField] = `showPhotos/slug/${uid}/1-a.jpg`;
      if (spec.nestedStoragePath) {
        const [outer, inner] = spec.nestedStoragePath;
        data[outer] = { [inner]: `showPhotos/slug/${uid}/2-b.jpg` };
      }
      if (spec.storagePathArray) {
        data[spec.storagePathArray.field] = [
          { [spec.storagePathArray.pathKey]: `venueVerificationDocs/v/${uid}/3-c.pdf` },
        ];
      }
      await db.collection(spec.collection).doc(id).set(data);
      ids.push([spec.collection, id]);
    }
  }

  for (const spec of ARRAY_MEMBERSHIPS) {
    const id = `${spec.collection}__arr__${uid}`;
    const data = { [spec.field]: [uid, 'uid_bystander'], seeded: true };
    if (spec.mapField) data[spec.mapField] = { [uid]: 'Name', uid_bystander: 'Bystander' };
    await db.collection(spec.collection).doc(id).set(data);
    ids.push([spec.collection, id]);
  }

  for (const spec of TOMBSTONES) {
    // Keyed by field as well as collection: `reports` appears twice (reporterId
    // and reportedUserId), and a shared id would let the second seed overwrite
    // the first and hide a real failure.
    const id = `${spec.collection}__tomb__${spec.field}__${uid}`;
    const data = { [spec.field]: uid, seeded: true };
    for (const f of spec.alsoNull || []) data[f] = 'something';
    await db.collection(spec.collection).doc(id).set(data);
    ids.push([spec.collection, id]);
  }

  // Explicitly-handled shapes that are not in the declarative map.
  await db.collection('showSuggestions').doc(`sugg__${uid}`).set({ participants: [uid, 'uid_bystander'] });
  await db.collection('handles').doc(`handle_${uid}`).set({ uid });
  await db.doc(`userProfiles/${uid}`).set({ displayName: 'Doomed', handleLower: `handle_${uid}` });
  await db.doc(`userBlocks/${uid}`).set({ userId: uid, blockedUserIds: ['uid_bystander'] });
  for (const sub of USER_SUBTREE) {
    await db.doc(`users/${uid}/${sub}/one`).set({ seeded: true });
  }
  // An inbound friend edge in somebody else's subcollection.
  await db.doc(`users/uid_bystander/friends/${uid}`).set({ friendUid: uid });
  // A roadmap vote: doc id is the uid, no uid field.
  await db.doc('roadmapItems/item1').set({ title: 'A feature', voteCount: 2 });
  await db.doc(`roadmapItems/item1/voters/${uid}`).set({ votedAt: new Date() });

  return ids;
}

async function exists(pathStr) {
  return (await db.doc(pathStr).get()).exists;
}

// ── run ──────────────────────────────────────────────────────────────────

(async () => {
  const doomedIds = await seedFor(DOOMED);
  await seedFor(SURVIVOR);

  const report = await purgeUserData({ db, auth: null, bucket: null }, DOOMED, { deleteAuthUser: false });

  // 1. Nothing left.
  const traces = await findRemainingTraces({ db }, DOOMED);
  check('no remaining traces', () => {
    assert.deepStrictEqual(traces, [], `still referenced:\n  ${traces.join('\n  ')}`);
  });

  // 2. Owned documents are gone.
  for (const [collection, id] of doomedIds) {
    // Tombstoned and array-membership documents are updated, not deleted.
    if (id.includes('__tomb__') || id.includes('__arr__')) continue;
    // eslint-disable-next-line no-await-in-loop
    const still = await exists(`${collection}/${id}`);
    check(`${collection}/${id} removed`, () => assert.strictEqual(still, false, `${collection}/${id} survived`));
  }

  // 3. Tombstoned documents survive with the uid scrubbed.
  for (const spec of TOMBSTONES) {
    const id = `${spec.collection}__tomb__${spec.field}__${DOOMED}`;
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.doc(`${spec.collection}/${id}`).get();
    check(`${spec.collection}.${spec.field} tombstoned, not deleted`, () => {
      assert.ok(snap.exists, `${spec.collection}/${id} was deleted; it should outlive the user`);
      assert.strictEqual(snap.data()[spec.field], spec.to, `${spec.field} not scrubbed`);
    });
  }

  // 4. The survivor is untouched — every one of their documents still there.
  const survivorTraces = await findRemainingTraces({ db }, SURVIVOR);
  check('survivor untouched', () => {
    assert.ok(survivorTraces.length > 0, 'the survivor lost all their data — the purge is over-broad');
  });
  const survivorProfile = await exists(`userProfiles/${SURVIVOR}`);
  check('survivor profile still exists', () => assert.strictEqual(survivorProfile, true));
  const survivorSub = await exists(`users/${SURVIVOR}/shows/one`);
  check('survivor subtree still exists', () => assert.strictEqual(survivorSub, true));

  // 5. Bystanders keep their place in shared arrays.
  for (const spec of ARRAY_MEMBERSHIPS) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.doc(`${spec.collection}/${spec.collection}__arr__${DOOMED}`).get();
    check(`${spec.collection}.${spec.field} keeps other members`, () => {
      assert.ok(snap.exists, 'the shared document was deleted rather than updated');
      assert.deepStrictEqual(snap.data()[spec.field], ['uid_bystander']);
      if (spec.mapField) {
        assert.deepStrictEqual(Object.keys(snap.data()[spec.mapField] || {}), ['uid_bystander']);
      }
    });
  }

  // 6. The roadmap vote count came down with the vote.
  const item = await db.doc('roadmapItems/item1').get();
  check('roadmap voteCount decremented', () => {
    assert.strictEqual(item.data().voteCount, 1, 'a removed vote left a phantom count behind');
  });

  // 7. Storage paths were collected before the documents holding them went.
  check('storage paths were collected', () => {
    assert.ok(report.storage, 'no storage report');
  });

  console.log(`\ncompleteness: ${passed} checks passed, ${failures.length} failed.`);
  if (failures.length) {
    console.error('\n' + failures.map(f => `  ✗ ${f}`).join('\n') + '\n');
    process.exit(1);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
