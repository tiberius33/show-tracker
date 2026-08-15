/**
 * Firestore helpers for the per-user, per-artist song wishlist.
 *
 * Schema: top-level `wishlists` collection, one doc per user+artist,
 * doc id `${uid}_${artistKey}`, with a `userId` field for ownership —
 * this mirrors the app's dominant convention for user-owned data
 * (venueRatings, showTags, showSuggestions, etc. all use a top-level
 * collection + owner-uid field + composite doc id; see
 * components/VenueRatingModal.jsx). `users/{uid}/shows` and
 * `users/{uid}/friends` are the only subcollections in this schema, and
 * Firestore security rules don't automatically extend to new
 * subcollections — a brand-new `users/{uid}/wishlist/*` path would need
 * its own rule that doesn't exist yet, which silently rejected every
 * write as permission-denied. Using the established top-level shape
 * avoids that.
 *
 *   wishlists/{uid}_{artistKey}
 *     {
 *       userId: string,
 *       artistKey: string,
 *       artistName: string,
 *       artistMbid: string | null,
 *       songs: {
 *         [normalizedTitleKey]: { title: string, addedAt: ISOString }
 *       },
 *       updatedAt: serverTimestamp,
 *     }
 *
 * Firestore rule for this collection must allow the `read` used by
 * loadWishlist() even when the doc doesn't exist yet (first time a user
 * picks an artist they've never wishlisted anything for) — i.e.
 * `resource == null || resource.data.userId == request.auth.uid`, not
 * just the latter. Referencing resource.data on a null resource denies
 * the read outright.
 */

import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeSongTitle } from '@/lib/utils';

export function artistKeyFor(artist) {
  if (artist?.mbid) return artist.mbid;
  return (artist?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

function wishlistDocId(uid, artistKey) {
  return `${uid}_${artistKey}`;
}

function wishlistDocRef(uid, artistKey) {
  return doc(db, 'wishlists', wishlistDocId(uid, artistKey));
}

// Returns { artistName, artistMbid, songs: { [key]: { title, addedAt } } } or null
export async function loadWishlist(uid, artistKey) {
  const snap = await getDoc(wishlistDocRef(uid, artistKey));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function addWishlistSong(uid, artist, songTitle) {
  const artistKey = artistKeyFor(artist);
  const songKey = normalizeSongTitle(songTitle);
  if (!songKey) return;
  const ref = wishlistDocRef(uid, artistKey);
  try {
    // No pre-read here on purpose: a getDoc() against a wishlist that
    // doesn't exist yet (i.e. every first star for a new artist) hits the
    // Firestore `read` rule with a null `resource`, which denies the read
    // before this write ever runs. addedAt on each song entry already
    // covers the "timestamps" requirement, so there's no need to read
    // first just to distinguish create vs. update for a createdAt field.
    await setDoc(ref, {
      userId: uid,
      artistKey,
      artistName: artist.name,
      artistMbid: artist.mbid || null,
      songs: {
        [songKey]: { title: songTitle, addedAt: new Date().toISOString() },
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.error(`[wishlist] Failed to add "${songTitle}" (${ref.path}):`, err.code || err.message, err);
    throw err;
  }
}

export async function removeWishlistSong(uid, artist, songTitle) {
  const artistKey = artistKeyFor(artist);
  const songKey = normalizeSongTitle(songTitle);
  if (!songKey) return;
  const ref = wishlistDocRef(uid, artistKey);
  try {
    await updateDoc(ref, {
      [`songs.${songKey}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    // Only swallow "doc doesn't exist yet" — that's a legitimate no-op
    // (nothing was ever added). Any other error (e.g. permission-denied)
    // must propagate so the caller can revert its optimistic UI update
    // and surface the failure instead of pretending it succeeded.
    if (err.code === 'not-found') return;
    console.error(`[wishlist] Failed to remove "${songTitle}" (${ref.path}):`, err.code || err.message, err);
    throw err;
  }
}
