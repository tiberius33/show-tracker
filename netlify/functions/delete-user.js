/**
 * delete-user — Admin-only endpoint that permanently removes a user and all their data.
 *
 * Collections / documents deleted:
 *   adminAuditLog/{docId}                  — written FIRST as immutable record
 *   users/{uid}/shows/*                    — all show documents
 *   users/{uid}/friends/*                  — all friend subcollection documents
 *   friendRequests where from==uid         — outgoing friend requests
 *   friendRequests where to==uid           — incoming friend requests
 *   showTags where fromUid==uid            — tags this user sent
 *   showTags where toUid==uid             — tags sent to this user
 *   invites where inviterUid==uid          — email invites this user sent
 *   pendingEmailTags where fromUid==uid    — non-user email tags this user sent
 *   userProfiles/{uid}                     — profile document
 *   Firebase Auth account for uid          — deleted last
 *
 * POST body:   { targetUid: string }
 * Auth header: Authorization: Bearer {idToken}   (admin account only)
 */

const ADMIN_EMAILS = ['phillip.leonard@gmail.com'];
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function initFirebase() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (getApps().length > 0) return;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!privateKey || !clientEmail || !projectId) throw new Error('Firebase env vars not configured');
  initializeApp({ credential: cert({ privateKey, clientEmail, projectId }), projectId });
}

async function verifyAdmin(token) {
  initFirebase();
  const { getAuth } = require('firebase-admin/auth');
  const decoded = await getAuth().verifyIdToken(token);
  if (!ADMIN_EMAILS.includes(decoded.email)) throw new Error('Forbidden');
  return decoded;
}

// Batch-delete an array of Firestore DocumentReferences (max 500 per batch).
async function batchDelete(db, refs) {
  if (refs.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    refs.slice(i, i + CHUNK).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

// Get all document refs from a subcollection.
async function getSubcollectionRefs(db, ...pathSegments) {
  const colRef = db.collection(pathSegments.join('/'));
  const snap = await colRef.get();
  return snap.docs.map(d => d.ref);
}

// Query a top-level collection by a single field and return all matching refs.
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

  let adminDecoded;
  try {
    adminDecoded = await verifyAdmin(token);
  } catch (e) {
    const status = e.message === 'Forbidden' ? 403 : 401;
    return { statusCode: status, headers: CORS_HEADERS, body: JSON.stringify({ error: e.message }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { targetUid } = body;
  if (!targetUid) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'targetUid is required' }) };
  }

  // Prevent self-deletion
  if (targetUid === adminDecoded.uid) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Cannot delete your own account' }) };
  }

  try {
    const { getFirestore, FieldValue } = require('firebase-admin/firestore');
    const { getAuth } = require('firebase-admin/auth');
    const db = getFirestore();

    // Fetch target user info for the audit log before deleting anything
    let targetEmail = '';
    let targetDisplayName = '';
    try {
      const targetAuthUser = await getAuth().getUser(targetUid);
      targetEmail = targetAuthUser.email || '';
      targetDisplayName = targetAuthUser.displayName || '';
    } catch (_) {
      // User may not exist in Auth — still proceed with Firestore cleanup
    }

    // ── Step 1: Write audit log FIRST ────────────────────────────────────────
    await db.collection('adminAuditLog').add({
      action: 'delete_user',
      targetUid,
      targetEmail,
      targetDisplayName,
      performedByUid: adminDecoded.uid,
      performedByEmail: adminDecoded.email,
      performedAt: FieldValue.serverTimestamp(),
    });

    // ── Step 2: Delete subcollections ─────────────────────────────────────────
    const showRefs    = await getSubcollectionRefs(db, 'users', targetUid, 'shows');
    const friendRefs  = await getSubcollectionRefs(db, 'users', targetUid, 'friends');

    await Promise.all([
      batchDelete(db, showRefs),
      batchDelete(db, friendRefs),
    ]);

    // ── Step 3: Delete cross-user collections ─────────────────────────────────
    const [
      frFromRefs,
      frToRefs,
      tagsFromRefs,
      tagsToRefs,
      inviteRefs,
      emailTagRefs,
    ] = await Promise.all([
      queryRefs(db, 'friendRequests', 'from', targetUid),
      queryRefs(db, 'friendRequests', 'to', targetUid),
      queryRefs(db, 'showTags', 'fromUid', targetUid),
      queryRefs(db, 'showTags', 'toUid', targetUid),
      queryRefs(db, 'invites', 'inviterUid', targetUid),
      queryRefs(db, 'pendingEmailTags', 'fromUid', targetUid),
    ]);

    await Promise.all([
      batchDelete(db, [...frFromRefs, ...frToRefs]),
      batchDelete(db, [...tagsFromRefs, ...tagsToRefs]),
      batchDelete(db, inviteRefs),
      batchDelete(db, emailTagRefs),
    ]);

    // ── Step 4: Delete profile document and users/{uid} parent ────────────────
    await Promise.all([
      db.doc(`userProfiles/${targetUid}`).delete(),
      db.doc(`users/${targetUid}`).delete().catch(() => {}),
    ]);

    // ── Step 5: Delete Firebase Auth account (must be last) ───────────────────
    try {
      await getAuth().deleteUser(targetUid);
    } catch (authErr) {
      // If auth account doesn't exist, that's fine — Firestore is already cleaned up
      if (authErr.code !== 'auth/user-not-found') throw authErr;
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, deletedUid: targetUid }),
    };
  } catch (e) {
    console.error('delete-user error:', e);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
