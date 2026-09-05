/**
 * moderate-report — the three actions an admin can take on a report from
 * the Moderation queue in AdminView: dismiss it, delete the content, or
 * delete the content and ban its author.
 *
 * Admin-only, same Bearer-token check as the other admin-* functions in
 * this directory. It is a function rather than a client write for the
 * same reason report-content.js is: every one of these actions touches a
 * document the caller does not own — someone else's comment, someone
 * else's profile — which only the Admin SDK can do.
 *
 * POST body: { reportId, action: "dismiss" | "delete" | "ban" }
 * Auth header: Authorization: Bearer {idToken}   (admin account only)
 *
 * WHAT EACH ACTION DOES
 *
 *   dismiss — the report was wrong. If three reports had already pulled
 *             the content out of circulation, it goes back, with its
 *             original document id, so every reply, like and link to it
 *             still resolves. The counter is cleared so the same three
 *             reports cannot re-hide it the moment it returns.
 *
 *   delete  — the content is gone for good: removed from its collection
 *             if it is still there, and from moderationHidden if it was
 *             auto-hidden. Storage bytes for a photo are left alone,
 *             matching deletePhoto() in lib/photos.js — an orphaned file
 *             wastes a little space, where a failed storage call that
 *             aborted the delete would leave the content up.
 *
 *   ban     — delete, plus `banned: true` on the author's profile.
 *             firestore.rules refuses their writes and
 *             netlify/functions/moderate-content.js refuses them on the
 *             path that bypasses rules. Their existing content is left
 *             standing; a ban is not a retroactive purge, and mass-
 *             deleting a user's history on one report is not reversible.
 *
 * Every action closes every OPEN report against that content, not just
 * the one the admin clicked — three reports about one comment are one
 * decision, and leaving the other two open would show the same comment
 * in the queue three times.
 */

const ADMIN_EMAILS = ['phillip.leonard@gmail.com'];

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_ACTIONS = ['dismiss', 'delete', 'ban'];

function json(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

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

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const token = (event.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return json(401, { error: 'Unauthorized' });

  let admin;
  try {
    admin = await verifyAdmin(token);
  } catch (e) {
    return json(e.message === 'Forbidden' ? 403 : 401, { error: e.message });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Body must be JSON' });
  }

  const { reportId, action } = body;
  if (!reportId) return json(400, { error: 'reportId is required' });
  if (!VALID_ACTIONS.includes(action)) {
    return json(400, { error: `action must be one of ${VALID_ACTIONS.join(', ')}` });
  }

  const firestore = require('firebase-admin/firestore');
  const db = firestore.getFirestore();
  const { FieldValue } = firestore;

  try {
    const reportRef = db.collection('reports').doc(String(reportId));
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) return json(404, { error: 'That report no longer exists.' });

    const report = reportSnap.data();
    const { contentId, contentPath } = report;
    const [collectionName] = String(contentPath || '').split('/');
    if (!collectionName || !contentId) {
      return json(400, { error: 'That report is missing the content path it refers to.' });
    }

    const contentRef = db.collection(collectionName).doc(String(contentId));
    const hiddenRef = db.collection('moderationHidden').doc(`${collectionName}_${contentId}`);
    const counterRef = db.collection('moderationCounters').doc(String(contentId));

    const batch = db.batch();
    let restored = false;

    if (action === 'dismiss') {
      const hiddenSnap = await hiddenRef.get();
      if (hiddenSnap.exists) {
        // Back to its own collection under its original id, so replies
        // (which reference parentId) and any link to it still resolve.
        batch.set(contentRef, hiddenSnap.data().data || {});
        batch.delete(hiddenRef);
        restored = true;
      }
      // Cleared, not decremented: leaving the count at three would let
      // the same three reports re-hide the content the instant it
      // returns, and an admin has now looked at all three.
      batch.delete(counterRef);
    } else {
      batch.delete(contentRef);
      batch.delete(hiddenRef);
      batch.delete(counterRef);

      if (action === 'ban' && report.reportedUserId) {
        batch.set(
          db.collection('userProfiles').doc(String(report.reportedUserId)),
          { banned: true, bannedAt: FieldValue.serverTimestamp(), bannedBy: admin.email },
          { merge: true },
        );
      }
    }

    // Close every open report against this content, not just this one.
    const siblings = await db.collection('reports')
      .where('contentId', '==', String(contentId))
      .where('status', '==', 'open')
      .get();

    const status = action === 'dismiss' ? 'dismissed' : 'actioned';
    siblings.docs.forEach((sibling) => {
      batch.update(sibling.ref, {
        status,
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: admin.email,
        resolvedAction: action,
      });
    });
    // The report that was clicked may already be closed (a re-click, or
    // resolved by a sibling action), in which case the query above misses
    // it — close it explicitly so the queue cannot get stuck on it.
    batch.update(reportRef, {
      status,
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: admin.email,
      resolvedAction: action,
    });

    // Same audit trail the roadmap and venue-verification admin flows
    // write, so a moderation decision is as traceable as those are.
    batch.set(db.collection('adminAuditLog').doc(), {
      type: 'moderation',
      action,
      reportId: String(reportId),
      contentPath,
      reportedUserId: report.reportedUserId || null,
      by: admin.email,
      at: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return json(200, {
      action,
      restored,
      closedReports: siblings.size || 1,
      banned: action === 'ban' ? report.reportedUserId : null,
    });
  } catch (e) {
    console.error('[moderate-report] Failed:', e.message, e);
    return json(500, { error: 'That action failed. Please try again.' });
  }
};
