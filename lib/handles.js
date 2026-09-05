// lib/handles.js
//
// Public profile handles — unique, case-insensitive, permanent once set (a
// user picks a handle once; there is no rename, so a released handle being
// immediately reclaimed by someone else is not a case this needs to
// handle). Reservation is enforced by a Firestore transaction against a
// dedicated `handles/{handleLower}` collection (uid -> handle is a 1:1
// mapping, so the transaction only needs to check one doc for a race).

import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { findBlockedTerm } from '@/lib/contentFilter';

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 20;

// Existing app routes (would otherwise collide with /u/[handle] or
// /shared/[id] at the redirect layer) plus obvious impersonation risks.
export const RESERVED_HANDLES = [
  'shows', 'stats', 'venues', 'songs', 'runs', 'tours', 'wishlist', 'friends',
  'profile', 'api', 'admin', 'settings', 'privacy', 'terms', 'cookies',
  'shared', 'roadmap', 'support', 'search', 'upcoming', 'community',
  'feedback', 'invite', 'scan-import', 'release-notes', 'how-to-use',
  'spotify-callback', 'u', 'mysetlists', 'official', 'help', 'www', 'app',
];

export function normalizeHandle(raw) {
  return (raw || '').toLowerCase().trim();
}

// Returns an error string, or null if the format is fine (reserved-word and
// availability checks happen separately since they need a network round trip).
export function handleFormatError(raw) {
  const handle = normalizeHandle(raw);
  if (handle.length < HANDLE_MIN_LENGTH || handle.length > HANDLE_MAX_LENGTH) {
    return `Handle must be ${HANDLE_MIN_LENGTH}-${HANDLE_MAX_LENGTH} characters.`;
  }
  if (!/^[a-z0-9_]+$/.test(handle)) {
    return 'Handle can only contain lowercase letters, numbers, and underscores.';
  }
  if (RESERVED_HANDLES.includes(handle)) {
    return 'That handle is reserved.';
  }
  // A handle becomes a public URL (mysetlists.net/u/{handle}) and appears
  // beside this user's name everywhere, so it goes through the same
  // wordlist as a comment. Only the profanity half applies: a handle
  // cannot contain an @, a space or a dot, so the email/phone/link checks
  // have nothing to find and would only cost a scan.
  if (findBlockedTerm(handle)) {
    return 'That handle contains language we don’t allow.';
  }
  return null;
}

// Claims `rawHandle` for `uid`. Throws with a user-facing message on any
// failure (bad format, reserved, taken, or the user already has a handle).
export async function claimHandle(uid, rawHandle) {
  const handleLower = normalizeHandle(rawHandle);
  const formatError = handleFormatError(handleLower);
  if (formatError) throw new Error(formatError);

  await runTransaction(db, async (tx) => {
    const profileRef = doc(db, 'userProfiles', uid);
    const profileSnap = await tx.get(profileRef);
    if (profileSnap.exists() && profileSnap.data().handle) {
      throw new Error('Your handle is already set and cannot be changed.');
    }

    const handleRef = doc(db, 'handles', handleLower);
    const handleSnap = await tx.get(handleRef);
    if (handleSnap.exists()) {
      throw new Error('That handle is already taken.');
    }

    tx.set(handleRef, { uid, createdAt: serverTimestamp() });
    tx.set(profileRef, { handle: rawHandle.trim(), handleLower }, { merge: true });
  });
}

export async function isHandleAvailable(rawHandle) {
  const handleLower = normalizeHandle(rawHandle);
  if (handleFormatError(handleLower)) return false;
  const snap = await getDoc(doc(db, 'handles', handleLower));
  return !snap.exists();
}
