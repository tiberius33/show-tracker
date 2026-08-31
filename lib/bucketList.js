/**
 * Firestore helpers for the per-user "bucket list" — future shows a user
 * wants to attend, distinct from lib/wishlist.js (which tracks individual
 * songs per artist, not shows).
 *
 * Schema: top-level `bucketList` collection, one doc per entry, doc id
 * `${uid}_${itemKey}` — mirrors the app's dominant convention for
 * user-owned data (see lib/wishlist.js for the same reasoning: a brand-new
 * `users/{uid}/bucketList/*` subcollection would need its own Firestore
 * rule that doesn't exist yet, so a top-level collection + owner-uid field
 * reuses the rule shape that's already deployed).
 *
 *   bucketList/{uid}_{itemKey}
 *     {
 *       userId: string,
 *       artist: string,
 *       venue: string | null,
 *       city: string | null,
 *       state: string | null,
 *       date: string (ISO date, e.g. "2026-05-10"),
 *       source: 'manual' | 'ticketmaster' | 'seatgeek',
 *       ticketUrl: string | null,
 *       addedAt: serverTimestamp,
 *     }
 *
 * Security rule lives in firestore.rules (see the `bucketList` match
 * block) — deploy with `npm run deploy:rules` after any change there.
 */

import { doc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Stable key for a bucket-list entry so re-adding the same event is a no-op
// merge rather than a duplicate doc, and "already added" checks are cheap.
export function bucketListItemKey({ artist, venue, date }) {
  return [artist, venue, date]
    .map((v) => (v || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'))
    .join('_');
}

function bucketListDocId(uid, itemKey) {
  return `${uid}_${itemKey}`;
}

function bucketListDocRef(uid, itemKey) {
  return doc(db, 'bucketList', bucketListDocId(uid, itemKey));
}

export async function addToBucketList(uid, item) {
  const itemKey = bucketListItemKey(item);
  const ref = bucketListDocRef(uid, itemKey);
  try {
    await setDoc(ref, {
      userId: uid,
      artist: item.artist,
      venue: item.venue || null,
      city: item.city || null,
      state: item.state || null,
      date: item.date,
      source: item.source || 'manual',
      ticketUrl: item.ticketUrl || null,
      addedAt: serverTimestamp(),
    }, { merge: true });
    return itemKey;
  } catch (err) {
    console.error(`[bucketList] Failed to add "${item.artist}" (${ref.path}):`, err.code || err.message, err);
    throw err;
  }
}

export async function removeFromBucketList(uid, itemKey) {
  const ref = bucketListDocRef(uid, itemKey);
  try {
    await deleteDoc(ref);
  } catch (err) {
    if (err.code === 'not-found') return;
    console.error(`[bucketList] Failed to remove ${itemKey} (${ref.path}):`, err.code || err.message, err);
    throw err;
  }
}

// Returns [{ key, userId, artist, venue, city, state, date, source, ticketUrl, addedAt }]
export async function listBucketList(uid) {
  const q = query(collection(db, 'bucketList'), where('userId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ key: d.id.slice(uid.length + 1), ...d.data() }));
}
