/**
 * Firestore helpers for the per-user, per-artist song wishlist.
 *
 * Schema: users/{uid}/wishlist/{artistKey}
 *   {
 *     artistName: string,
 *     artistMbid: string | null,       // setlist.fm MusicBrainz id, when known
 *     songs: {
 *       [normalizedTitleKey]: { title: string, addedAt: ISOString }
 *     },
 *     updatedAt: serverTimestamp
 *   }
 *
 * Mirrors the users/{uid}/friends/{friendUid} subcollection pattern already
 * used elsewhere in the app (see context/AppContext.jsx).
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

function wishlistDocRef(uid, artistKey) {
  return doc(db, 'users', uid, 'wishlist', artistKey);
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
  await setDoc(ref, {
    artistName: artist.name,
    artistMbid: artist.mbid || null,
    songs: {
      [songKey]: { title: songTitle, addedAt: new Date().toISOString() },
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function removeWishlistSong(uid, artist, songTitle) {
  const artistKey = artistKeyFor(artist);
  const songKey = normalizeSongTitle(songTitle);
  if (!songKey) return;
  const ref = wishlistDocRef(uid, artistKey);
  await updateDoc(ref, {
    [`songs.${songKey}`]: deleteField(),
    updatedAt: serverTimestamp(),
  }).catch(() => {
    // Doc may not exist yet if this fires before any song was ever added — no-op.
  });
}
