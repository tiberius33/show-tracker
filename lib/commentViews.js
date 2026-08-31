/**
 * Firestore helpers for "new since your last visit" comment highlighting.
 *
 * Schema: top-level `commentViews` collection, one doc per user+concert,
 * doc id `${uid}_${concertKey}` — same top-level-collection-plus-owner-uid
 * convention as lib/wishlist.js and lib/bucketList.js (see those files for
 * why: a users/{uid}/commentViews/* subcollection would need its own
 * Firestore rule that doesn't exist).
 *
 *   commentViews/{uid}_{concertKey}
 *     { uid: string, concertKey: string, lastViewedAt: serverTimestamp() }
 *
 * Usage: read the *old* value with getLastViewed() before rendering (to
 * know what counts as "new" for this visit), then call markViewed() to
 * record the new high-water mark for next time — in that order, or
 * everything looks "seen" immediately.
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function viewDocRef(uid, concertKey) {
  const safeKey = concertKey.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return doc(db, 'commentViews', `${uid}_${safeKey}`);
}

// Returns the millis of the last visit, or 0 if this is the first one
// (so every existing comment is treated as "not new" the first time,
// rather than the whole thread lighting up as new).
export async function getLastViewed(uid, concertKey) {
  try {
    const snap = await getDoc(viewDocRef(uid, concertKey));
    return snap.exists() ? (snap.data().lastViewedAt?.toMillis?.() || 0) : Date.now();
  } catch (err) {
    console.error('[commentViews] Failed to read last-viewed:', err.code || err.message, err);
    return Date.now();
  }
}

export async function markViewed(uid, concertKey) {
  try {
    await setDoc(viewDocRef(uid, concertKey), {
      uid,
      concertKey,
      lastViewedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[commentViews] Failed to record last-viewed:', err.code || err.message, err);
  }
}
