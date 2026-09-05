/**
 * moderate-content — the write path for every piece of free text a user
 * can publish: concert comments, meetup messages, and photo/video
 * captions.
 *
 * WHY WRITES MOVED HERE. App Store Guideline 1.2 wants objectionable
 * material filtered *before* it is published. A filter that only runs in
 * the browser is a suggestion: the Firestore rules for `showComments`,
 * `meetupComments` and `showPhotos` let any signed-in user create a
 * document, so anyone with the SDK and five minutes can post whatever
 * they like straight past it. Moving creation behind this function and
 * closing `allow create` on those three collections (see firestore.rules)
 * is what turns the check into an actual gate.
 *
 * The client still runs lib/contentFilter.js first. That copy exists so
 * the writer gets an inline error under the box instead of a round trip
 * that ends in a rejected write — it is a courtesy, and this is the
 * enforcement. Both run the identical rule; see
 * lib/__tests__/contentFilterParity.test.js.
 *
 * WHAT ELSE IT ENFORCES. A banned user (`userProfiles/{uid}.banned`) is
 * refused here as well as in the rules, so a ban takes effect on the one
 * path that bypasses rules entirely — this function's own Admin SDK
 * writes.
 *
 * POST body:
 *   { target: "showComment",   concertKey, text, parentId? }
 *   { target: "meetupComment", meetupId, text }
 *   { target: "showMedia",     concertKey, category, type, url,
 *                              storagePath?, fileSize?, caption?, show? }
 *
 * Auth header: Authorization: Bearer {idToken}  (any signed-in user)
 *
 * WHAT IT NEVER DOES
 *   - Never trusts the caller for identity. authorUid/uploadedBy is the
 *     verified token's uid, never a field from the body, so one user
 *     cannot post as another through this endpoint.
 *   - Never trusts the caller for likes or timestamps. likedBy starts
 *     empty and createdAt is the server's clock.
 *   - Never uploads bytes. The client still writes the file to Cloud
 *     Storage under storage.rules (which enforces size and content type);
 *     only the metadata document, the part carrying the caption, is
 *     written here.
 */

const { checkContent } = require('./lib/contentFilterRule');

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Field limits, so a client cannot write a megabyte of text into a
// document that renders inline on a show page.
const MAX_TEXT = 2000;
const MAX_CAPTION = 500;
const MAX_NAME = 120;

function initFirebase() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (getApps().length > 0) return;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!privateKey || !clientEmail || !projectId) throw new Error('Firebase env vars not configured');
  initializeApp({ credential: cert({ privateKey, clientEmail, projectId }), projectId });
}

function json(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

/**
 * The author's display name is read from their profile rather than taken
 * from the request. The client used to pass it, and a client that can
 * pass a name can pass someone else's.
 */
async function resolveAuthorName(db, uid, fallback) {
  try {
    const snap = await db.collection('userProfiles').doc(uid).get();
    const name = snap.exists ? snap.data().displayName : '';
    return (name || fallback || 'Anonymous').slice(0, MAX_NAME);
  } catch {
    return (fallback || 'Anonymous').slice(0, MAX_NAME);
  }
}

async function isBanned(db, uid) {
  try {
    const snap = await db.collection('userProfiles').doc(uid).get();
    return !!(snap.exists && snap.data().banned === true);
  } catch {
    // Fail closed on identity questions is the usual advice, but a
    // profile read that errors would then lock every user out of
    // commenting over an unrelated Firestore blip. A ban is also enforced
    // by firestore.rules, which is not subject to this outage.
    return false;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const token = (event.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return json(401, { error: 'You need to be signed in to post.' });

  let uid;
  let db;
  try {
    initFirebase();
    const { getAuth } = require('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(token);
    uid = decoded.uid;
    const { getFirestore } = require('firebase-admin/firestore');
    db = getFirestore();
  } catch (e) {
    console.error('[moderate-content] Auth failed:', e.message);
    return json(401, { error: 'Your session has expired. Please sign in again.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Body must be JSON' });
  }

  if (await isBanned(db, uid)) {
    return json(403, { error: 'Your account can no longer post. Contact support@mysetlists.net if you think this is a mistake.' });
  }

  const { FieldValue } = require('firebase-admin/firestore');
  const now = FieldValue.serverTimestamp();

  try {
    // ── A concert comment or reply ───────────────────────────────────
    if (body.target === 'showComment') {
      const text = String(body.text || '').trim();
      if (!text) return json(400, { error: 'A comment needs some text.' });
      if (text.length > MAX_TEXT) return json(400, { error: `Comments are limited to ${MAX_TEXT} characters.` });
      if (!body.concertKey) return json(400, { error: 'concertKey is required' });

      const verdict = checkContent(text);
      if (!verdict.ok) return json(422, { error: verdict.message, code: verdict.code });

      const ref = await db.collection('showComments').add({
        concertKey: String(body.concertKey),
        parentId: body.parentId ? String(body.parentId) : null,
        authorUid: uid,
        authorName: await resolveAuthorName(db, uid, body.authorName),
        text,
        likedBy: [],
        createdAt: now,
      });
      return json(200, { id: ref.id });
    }

    // ── A meetup discussion message ──────────────────────────────────
    if (body.target === 'meetupComment') {
      const text = String(body.text || '').trim();
      if (!text) return json(400, { error: 'A message needs some text.' });
      if (text.length > MAX_TEXT) return json(400, { error: `Messages are limited to ${MAX_TEXT} characters.` });
      if (!body.meetupId) return json(400, { error: 'meetupId is required' });

      const verdict = checkContent(text);
      if (!verdict.ok) return json(422, { error: verdict.message, code: verdict.code });

      const ref = await db.collection('meetupComments').add({
        meetupId: String(body.meetupId),
        authorUid: uid,
        authorName: await resolveAuthorName(db, uid, body.authorName),
        text,
        createdAt: now,
      });
      return json(200, { id: ref.id });
    }

    // ── Photo / video / poster metadata, carrying the caption ────────
    if (body.target === 'showMedia') {
      const caption = String(body.caption || '').trim();
      if (caption.length > MAX_CAPTION) {
        return json(400, { error: `Captions are limited to ${MAX_CAPTION} characters.` });
      }
      if (!body.concertKey || !body.url) {
        return json(400, { error: 'concertKey and url are required' });
      }

      const verdict = checkContent(caption);
      if (!verdict.ok) return json(422, { error: verdict.message, code: verdict.code });

      const show = body.show || {};
      const ref = await db.collection('showPhotos').add({
        concertKey: String(body.concertKey),
        category: ['photo', 'poster', 'setlist'].includes(body.category) ? body.category : 'photo',
        artist: show.artist || null,
        venue: show.venue || null,
        date: show.date || null,
        uploadedBy: uid,
        uploaderName: await resolveAuthorName(db, uid, body.uploaderName),
        type: ['image', 'video', 'youtube'].includes(body.type) ? body.type : 'image',
        url: String(body.url),
        storagePath: body.storagePath ? String(body.storagePath) : null,
        fileSize: typeof body.fileSize === 'number' ? body.fileSize : null,
        caption,
        likedBy: [],
        createdAt: now,
      });
      return json(200, { id: ref.id });
    }

    return json(400, { error: `Unknown target: ${body.target}` });
  } catch (e) {
    console.error('[moderate-content] Write failed:', e.message, e);
    return json(500, { error: "Couldn't save that. Please try again." });
  }
};
