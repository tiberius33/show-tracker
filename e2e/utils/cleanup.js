// @ts-check
'use strict';

/**
 * Deletes all Firestore documents owned by a given uid where the artist name
 * (or a dedicated field) starts with the test prefix "test-".
 *
 * Run standalone:
 *   node e2e/utils/cleanup.js
 *
 * Or call deleteTestData(uid) programmatically from test teardown.
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_PROJECT_ID env vars.
 */

const { testConfig } = require('../../tests/config/test.config');
const TEST_PREFIX = testConfig.testPrefix; // 'test-'

function getDb() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!json || !projectId) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_PROJECT_ID must be set for cleanup'
    );
  }
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(json)), projectId });
  }
  const { getFirestore } = require('firebase-admin/firestore');
  return getFirestore();
}

/**
 * Deletes shows for `uid` whose artist field starts with TEST_PREFIX.
 * Returns the count of deleted documents.
 */
async function deleteTestShows(uid) {
  const db = getDb();
  const snapshot = await db
    .collection('users')
    .doc(uid)
    .collection('shows')
    .where('artist', '>=', TEST_PREFIX)
    .where('artist', '<', TEST_PREFIX + '\uffff')
    .get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log(`[cleanup] Deleted ${snapshot.size} test show(s) for uid=${uid}`);
  return snapshot.size;
}

/**
 * Deletes shared collections whose title starts with TEST_PREFIX.
 */
async function deleteTestCollections() {
  const db = getDb();
  const snapshot = await db
    .collection('sharedCollections')
    .where('title', '>=', TEST_PREFIX)
    .where('title', '<', TEST_PREFIX + '\uffff')
    .get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log(`[cleanup] Deleted ${snapshot.size} test shared collection(s)`);
  return snapshot.size;
}

/**
 * Main cleanup — call with the uid of the test account after a test run.
 */
async function deleteTestData(uid) {
  let total = 0;
  total += await deleteTestShows(uid);
  total += await deleteTestCollections();
  return total;
}

module.exports = { deleteTestData, deleteTestShows, deleteTestCollections };

// Standalone execution
if (require.main === module) {
  const uid = process.argv[2];
  if (!uid) {
    console.error('Usage: node e2e/utils/cleanup.js <firebase-uid>');
    process.exit(1);
  }
  deleteTestData(uid)
    .then((n) => {
      console.log(`[cleanup] Total deleted: ${n}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[cleanup] Error:', err.message);
      process.exit(1);
    });
}
