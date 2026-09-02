/**
 * Firestore helpers for per-user "favorite tours".
 *
 * Schema: one top-level `favoriteTours` doc per user, id = uid, with a
 * `userId` field for ownership:
 *
 *   favoriteTours/{uid}
 *     {
 *       userId: string,
 *       tours: {
 *         [tourKey]: { tourName: string, artistName: string, addedAt: ISOString }
 *       },
 *       updatedAt: serverTimestamp,
 *     }
 *
 * Shape rationale (same reasoning as lib/wishlist.js): a top-level
 * collection + owner-uid field is this app's dominant convention for
 * user-owned data (wishlists, venueRatings, bucketList, ...), and a new
 * `users/{uid}/...` subcollection would need its own security rule — the
 * absence of which silently rejects every write as permission-denied. A
 * single doc per user (rather than one per tour) is enough here: a user's
 * favorites are a handful of short keys, they're all read together on the
 * Tours page, and a map field makes the star toggle one merge write.
 *
 * The matching firestore.rules block must allow the read even when the doc
 * doesn't exist yet — `resource == null || resource.data.userId == uid` —
 * since referencing resource.data on a null resource denies the read
 * outright.
 */

import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function favoriteToursRef(uid) {
  return doc(db, 'favoriteTours', uid);
}

// Returns { [tourKey]: { tourName, artistName, addedAt } } — {} when the
// user has never favorited a tour.
export async function loadFavoriteTours(uid) {
  const snap = await getDoc(favoriteToursRef(uid));
  if (!snap.exists()) return {};
  return snap.data()?.tours || {};
}

export async function addFavoriteTour(uid, tour) {
  if (!uid || !tour?.key) return;
  const ref = favoriteToursRef(uid);
  const entry = {
    tourName: tour.tourName || '',
    artistName: tour.artistName || '',
    addedAt: new Date().toISOString(),
  };
  try {
    await setDoc(
      ref,
      { userId: uid, tours: { [tour.key]: entry }, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.error(`[favoriteTours] Failed to star "${tour.key}" (${ref.path}):`, err.code || err.message, err);
    throw err;
  }
}

export async function removeFavoriteTour(uid, tourKey) {
  if (!uid || !tourKey) return;
  const ref = favoriteToursRef(uid);
  try {
    await updateDoc(ref, {
      [`tours.${tourKey}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    // "doc doesn't exist yet" is a legitimate no-op — nothing was ever
    // starred. Everything else (permission-denied in particular) must
    // propagate so the caller can revert its optimistic update instead of
    // pretending the unstar stuck.
    if (err.code === 'not-found') return;
    console.error(`[favoriteTours] Failed to unstar "${tourKey}" (${ref.path}):`, err.code || err.message, err);
    throw err;
  }
}
