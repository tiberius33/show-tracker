/**
 * Firestore rules tests for the moderation changes in v5.32.0.
 *
 * Run with:
 *   npm run test:rules
 *
 * which starts the Firestore emulator, loads firestore.rules, and runs
 * this file against it. Nothing here touches production.
 *
 * WHY THESE EXIST. Every other guarantee in the moderation feature is
 * enforced by application code, and application code is what an attacker
 * skips: the whole point of closing `allow create` on the comment
 * collections is that someone with the Firebase SDK and a browser console
 * cannot do what the app refuses to do. A rule that is wrong fails
 * silently and permissively, so the only way to know it is right is to
 * try the attack.
 *
 * The five that matter, and all five are here:
 *   - a banned user cannot write
 *   - a banned user cannot un-ban themselves
 *   - a non-admin cannot read `reports`
 *   - hidden content is not readable by third parties
 *   - one user cannot read or overwrite another's block list
 */

const assert = require('assert');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'demo-moderation-rules';
const ADMIN_EMAIL = 'phillip.leonard@gmail.com';

const ALICE = 'uid_alice';
const BANNED = 'uid_banned';
const ADMIN = 'uid_admin';

let testEnv;
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

// Contexts. `admin` here means the app's admin ACCOUNT (an ordinary
// signed-in user whose token carries the admin email), not the Admin SDK
// — the rules identify an admin by token email, and that is what these
// tests need to exercise.
const alice = () => testEnv.authenticatedContext(ALICE).firestore();
const banned = () => testEnv.authenticatedContext(BANNED).firestore();
const admin = () => testEnv.authenticatedContext(ADMIN, { email: ADMIN_EMAIL }).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  await testEnv.clearFirestore();

  // Seed through withSecurityRulesDisabled — this is the state of the
  // world the rules are then tested against, not something a client
  // should be able to create.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(`userProfiles/${ALICE}`).set({ displayName: 'Alice' });
    await db.doc(`userProfiles/${BANNED}`).set({ displayName: 'Banned', banned: true });
    await db.doc(`userProfiles/${ADMIN}`).set({ displayName: 'Admin' });

    await db.doc('showComments/c1').set({
      concertKey: 'k1', parentId: null, authorUid: ALICE,
      authorName: 'Alice', text: 'great show', likedBy: [],
    });
    await db.doc('showPhotos/p1').set({
      concertKey: 'k1', uploadedBy: ALICE, uploaderName: 'Alice',
      caption: 'the encore', url: 'https://example.test/p.jpg', likedBy: [],
    });
    await db.doc('meetupComments/m1').set({
      meetupId: 'meet1', authorUid: ALICE, authorName: 'Alice', text: 'see you there',
    });

    await db.doc('reports/c1_uid_bob').set({
      contentType: 'showComment', contentId: 'c1', contentPath: 'showComments/c1',
      reporterId: 'uid_bob', reportedUserId: ALICE, reason: 'spam', status: 'open',
    });
    await db.doc('moderationHidden/showComments_c9').set({
      collectionName: 'showComments', docId: 'c9', hidden: true,
      authorUid: ALICE, data: { text: 'something reported three times' },
    });
    await db.doc('moderationCounters/c9').set({ contentId: 'c9', openReports: 3 });
    await db.doc(`userBlocks/${ALICE}`).set({ userId: ALICE, blockedUserIds: ['uid_bob'] });
  });

  console.log('\nthe write path is closed to clients');

  await test('nobody can create a comment directly, not even its author', async () => {
    // The filter in netlify/functions/moderate-content.js is only a gate
    // if this is the sole way in. Before v5.32.0 this call succeeded.
    await assertFails(alice().doc('showComments/new1').set({
      concertKey: 'k1', parentId: null, authorUid: ALICE,
      authorName: 'Alice', text: 'straight past the filter', likedBy: [],
    }));
  });

  await test('nobody can create photo metadata directly', async () => {
    await assertFails(alice().doc('showPhotos/new1').set({
      concertKey: 'k1', uploadedBy: ALICE, uploaderName: 'Alice',
      caption: 'straight past the filter', url: 'https://example.test/x.jpg', likedBy: [],
    }));
  });

  await test('nobody can create a meetup message directly', async () => {
    await assertFails(alice().doc('meetupComments/new1').set({
      meetupId: 'meet1', authorUid: ALICE, authorName: 'Alice', text: 'past the filter',
    }));
  });

  console.log('\na banned user cannot write');

  await test('a banned user cannot like a comment', async () => {
    await assertFails(banned().doc('showComments/c1').update({ likedBy: [BANNED] }));
  });

  await test('a banned user cannot like a photo', async () => {
    await assertFails(banned().doc('showPhotos/p1').update({ likedBy: [BANNED] }));
  });

  await test('a banned user cannot create or join a meetup', async () => {
    await assertFails(banned().doc('meetups/meet2').set({
      concertKey: 'k2', createdBy: BANNED, attendeeUids: [BANNED], attendeeNames: {},
    }));
  });

  await test('an ordinary user can still do all three', async () => {
    // The ban check must not be a blanket denial — if this fails, the
    // feature has broken commenting for everyone.
    await assertSucceeds(alice().doc('showComments/c1').update({ likedBy: [ALICE] }));
    await assertSucceeds(alice().doc('showPhotos/p1').update({ likedBy: [ALICE] }));
    await assertSucceeds(alice().doc('meetups/meet3').set({
      concertKey: 'k3', createdBy: ALICE, attendeeUids: [ALICE], attendeeNames: {},
    }));
  });

  await test('a banned user cannot lift their own ban', async () => {
    // Without this, the ban is decorative: `banned` sits on the user's own
    // profile document, which they can otherwise write freely.
    await assertFails(banned().doc(`userProfiles/${BANNED}`).update({ banned: false }));
    await assertFails(banned().doc(`userProfiles/${BANNED}`).set({
      displayName: 'Banned', banned: false,
    }));
  });

  await test('a user cannot ban someone else, or themselves', async () => {
    await assertFails(alice().doc(`userProfiles/${BANNED}`).update({ banned: false }));
    await assertFails(alice().doc(`userProfiles/${ALICE}`).update({ banned: true }));
  });

  await test('an ordinary profile edit still works', async () => {
    // Profiles predating the `banned` field must keep working — a bare
    // field read in the rule would fail evaluation on every one of them.
    await assertSucceeds(alice().doc(`userProfiles/${ALICE}`).update({ displayName: 'Alice B' }));
  });

  console.log('\nreports are admin-only to read');

  await test('a signed-in non-admin cannot read reports', async () => {
    await assertFails(alice().doc('reports/c1_uid_bob').get());
    await assertFails(alice().collection('reports').get());
  });

  await test('an anonymous visitor cannot read reports', async () => {
    await assertFails(anon().doc('reports/c1_uid_bob').get());
  });

  await test('the admin can read and resolve reports', async () => {
    await assertSucceeds(admin().doc('reports/c1_uid_bob').get());
    await assertSucceeds(admin().doc('reports/c1_uid_bob').update({ status: 'dismissed' }));
  });

  await test('a user can file a report, but only as themselves', async () => {
    await assertSucceeds(alice().doc('reports/c1_uid_alice').set({
      contentType: 'showComment', contentId: 'c1', contentPath: 'showComments/c1',
      reporterId: ALICE, reportedUserId: 'uid_bob', reason: 'spam', status: 'open',
    }));
    await assertFails(alice().doc('reports/c1_uid_mallory').set({
      contentType: 'showComment', contentId: 'c1', contentPath: 'showComments/c1',
      reporterId: 'uid_mallory', reportedUserId: 'uid_bob', reason: 'spam', status: 'open',
    }));
  });

  console.log('\nhidden content is not readable by third parties');

  await test('a third party cannot read auto-hidden content', async () => {
    await assertFails(alice().doc('moderationHidden/showComments_c9').get());
    await assertFails(alice().collection('moderationHidden').get());
    await assertFails(anon().doc('moderationHidden/showComments_c9').get());
  });

  await test('nobody can hide or un-hide content by hand', async () => {
    await assertFails(alice().doc('moderationHidden/showComments_c9').delete());
    await assertFails(alice().doc('moderationHidden/showComments_c1').set({
      collectionName: 'showComments', docId: 'c1', data: {},
    }));
    // Not even the admin account: restoring goes through
    // netlify/functions/moderate-report.js and the Admin SDK, so the
    // restore and the report closure happen in one batch.
    await assertFails(admin().doc('moderationHidden/showComments_c9').delete());
  });

  await test('the admin can read the hidden queue and the counters', async () => {
    await assertSucceeds(admin().doc('moderationHidden/showComments_c9').get());
    await assertSucceeds(admin().doc('moderationCounters/c9').get());
  });

  await test('a user cannot forge the auto-hide counter', async () => {
    await assertFails(alice().doc('moderationCounters/c1').set({ contentId: 'c1', openReports: 99 }));
    await assertFails(alice().doc('moderationCounters/c9').get());
  });

  console.log('\nblock lists stay private');

  await test('nobody can read another user’s block list', async () => {
    // The reason this is not on userProfiles: that document is readable by
    // every signed-in user, so a block list there would tell the blocked
    // person they had been blocked.
    await assertFails(banned().doc(`userBlocks/${ALICE}`).get());
    await assertFails(admin().doc(`userBlocks/${ALICE}`).get());
  });

  await test('a user can read and write their own block list', async () => {
    await assertSucceeds(alice().doc(`userBlocks/${ALICE}`).get());
    await assertSucceeds(alice().doc(`userBlocks/${ALICE}`).set({
      userId: ALICE, blockedUserIds: ['uid_bob', 'uid_carol'],
    }));
  });

  await test('a user cannot write to someone else’s block list', async () => {
    // Pinning the docId is what stops this. Matching on the userId field
    // alone would let anyone overwrite userBlocks/<victim-uid>, wiping
    // their blocks and locking them out of reading it back.
    await assertFails(banned().doc(`userBlocks/${ALICE}`).set({
      userId: BANNED, blockedUserIds: [],
    }));
    await assertFails(banned().doc(`userBlocks/${ALICE}`).set({
      userId: ALICE, blockedUserIds: [],
    }));
  });

  await testEnv.cleanup();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
