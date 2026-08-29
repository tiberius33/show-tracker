// @ts-check
'use strict';

/**
 * Clears posterCheckedQuick / posterCheckedDeep on shows that have no
 * posterUrl, so backfill-admin-poster-art.js will retry them.
 *
 * Usage:
 *   FIREBASE_PRIVATE_KEY='...' FIREBASE_CLIENT_EMAIL='...' FIREBASE_PROJECT_ID='...' \
 *     node scripts/reset-admin-poster-flags.js
 */

const ADMIN_EMAIL = 'phillip.leonard@gmail.com';

function getDb() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (!getApps().length) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (json) {
      initializeApp({ credential: cert(JSON.parse(json)), projectId: process.env.FIREBASE_PROJECT_ID });
    } else {
      const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const projectId = process.env.FIREBASE_PROJECT_ID;
      if (!privateKey || !clientEmail || !projectId) {
        throw new Error('Missing Firebase Admin credentials');
      }
      initializeApp({ credential: cert({ privateKey, clientEmail, projectId }), projectId });
    }
  }
  const { getFirestore } = require('firebase-admin/firestore');
  return getFirestore();
}

function getAuth() {
  const { getAuth: getAdminAuth } = require('firebase-admin/auth');
  return getAdminAuth();
}

async function main() {
  const db = getDb();
  const auth = getAuth();

  console.log(`Looking up admin account: ${ADMIN_EMAIL}`);
  const adminUser = await auth.getUserByEmail(ADMIN_EMAIL);
  const uid = adminUser.uid;
  console.log(`Found uid: ${uid}`);

  const showsSnap = await db.collection('users').doc(uid).collection('shows').get();
  const shows = showsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const toReset = shows.filter((s) => !s.posterUrl && (s.posterCheckedQuick || s.posterCheckedDeep));
  console.log(`${shows.length} total shows, ${toReset.length} to reset (no poster URL, but checked flags set).`);

  if (!toReset.length) {
    console.log('Nothing to reset.');
    return;
  }

  const { FieldValue } = require('firebase-admin/firestore');
  const BATCH_SIZE = 500;
  for (let i = 0; i < toReset.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const show of toReset.slice(i, i + BATCH_SIZE)) {
      const ref = db.collection('users').doc(uid).collection('shows').doc(show.id);
      batch.update(ref, {
        posterCheckedQuick: FieldValue.delete(),
        posterCheckedDeep: FieldValue.delete(),
      });
    }
    await batch.commit();
    console.log(`Reset ${Math.min(i + BATCH_SIZE, toReset.length)} / ${toReset.length}`);
  }

  console.log('Done. Re-run backfill-admin-poster-art.js to retry.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
