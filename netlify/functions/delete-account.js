/**
 * delete-account — Self-service account deletion endpoint.
 *
 * Allows authenticated users to permanently delete their own account and all data.
 * Reuses the same deletion logic as the admin delete-user function.
 *
 * POST body:   { confirmEmail: string }  (must match the authenticated user's email)
 * Auth header: Authorization: Bearer {idToken}
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function initFirebase() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (getApps().length > 0) return;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!json || !projectId) throw new Error('Firebase env vars not configured');
  initializeApp({ credential: cert(JSON.parse(json)), projectId });
}

async function batchDelete(db, refs) {
  if (refs.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    refs.slice(i, i + CHUNK).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

async function getSubcollectionRefs(db, ...pathSegments) {
  const colRef = db.collection(pathSegments.join('/'));
  const snap = await colRef.get();
  return snap.docs.map(d => d.ref);
}

async function queryRefs(db, collection, field, value) {
  const snap = await db.collection(collection).where(field, '==', value).get();
  return snap.docs.map(d => d.ref);
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = (event.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let decoded;
  try {
    initFirebase();
    const { getAuth } = require('firebase-admin/auth');
    decoded = await getAuth().verifyIdToken(token);
  } catch (e) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  // Require email confirmation to prevent accidental deletion
  const { confirmEmail } = body;
  if (!confirmEmail || confirmEmail.toLowerCase() !== (decoded.email || '').toLowerCase()) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Email confirmation does not match your account email' }),
    };
  }

  const uid = decoded.uid;

  try {
    const { getFirestore, FieldValue } = require('firebase-admin/firestore');
    const { getAuth } = require('firebase-admin/auth');
    const db = getFirestore();

    // Write audit log first
    await db.collection('adminAuditLog').add({
      action: 'self_delete_account',
      targetUid: uid,
      targetEmail: decoded.email || '',
      performedByUid: uid,
      performedByEmail: decoded.email || '',
      performedAt: FieldValue.serverTimestamp(),
    });

    // Delete subcollections
    const showRefs = await getSubcollectionRefs(db, 'users', uid, 'shows');
    const friendRefs = await getSubcollectionRefs(db, 'users', uid, 'friends');
    await Promise.all([
      batchDelete(db, showRefs),
      batchDelete(db, friendRefs),
    ]);

    // Delete cross-user collections
    const [frFromRefs, frToRefs, tagsFromRefs, tagsToRefs, inviteRefs, emailTagRefs, notificationRefs, suggestionRefs] = await Promise.all([
      queryRefs(db, 'friendRequests', 'from', uid),
      queryRefs(db, 'friendRequests', 'to', uid),
      queryRefs(db, 'showTags', 'fromUid', uid),
      queryRefs(db, 'showTags', 'toUid', uid),
      queryRefs(db, 'invites', 'inviterUid', uid),
      queryRefs(db, 'pendingEmailTags', 'fromUid', uid),
      queryRefs(db, 'notifications', 'uid', uid),
      // Also clean up suggestions where this user is a participant
      (async () => {
        const snap = await db.collection('showSuggestions').where('participants', 'array-contains', uid).get();
        return snap.docs.map(d => d.ref);
      })(),
    ]);

    await Promise.all([
      batchDelete(db, [...frFromRefs, ...frToRefs]),
      batchDelete(db, [...tagsFromRefs, ...tagsToRefs]),
      batchDelete(db, inviteRefs),
      batchDelete(db, emailTagRefs),
      batchDelete(db, notificationRefs),
      batchDelete(db, suggestionRefs),
    ]);

    // Also remove this user from other users' friend subcollections
    const allUsersSnap = await db.collectionGroup('friends').where('friendUid', '==', uid).get();
    await batchDelete(db, allUsersSnap.docs.map(d => d.ref));

    // Delete profile document and users/{uid} parent
    await Promise.all([
      db.doc(`userProfiles/${uid}`).delete(),
      db.doc(`users/${uid}`).delete().catch(() => {}),
    ]);

    // Delete Firebase Auth account (must be last)
    try {
      await getAuth().deleteUser(uid);
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') throw authErr;
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true }),
    };
  } catch (e) {
    console.error('delete-account error:', e);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
