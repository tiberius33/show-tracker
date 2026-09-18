// lib/handles.js
//
// Public profile handles — unique, case-insensitive, permanent once set (a
// user picks a handle once; there is no rename, so a released handle being
// immediately reclaimed by someone else is not a case this needs to
// handle). Reservation is enforced by a Firestore transaction against a
// dedicated `handles/{handleLower}` collection (uid -> handle is a 1:1
// mapping, so the transaction only needs to check one doc for a race).

import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { apiUrl } from '@/lib/api';
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
//
// WHY THIS GOES THROUGH THE SERVER NOW. It used to run a Firestore
// transaction from the client, and that could never have worked:
// `handles/{handleLower}` has no rule in firestore.rules and Firestore
// denies every path without one, so the transaction was rejected on every
// attempt and nobody could claim a handle at all. Moving it to
// netlify/functions/moderate-content.js fixes that — the Admin SDK is not
// subject to rules — and is also what makes the wordlist check a gate
// rather than advice, since a client that can write the handle can skip
// handleFormatError() below.
//
// The format check stays here as well, for the inline error under the
// field; the server runs the identical one.
export async function claimHandle(uid, rawHandle) {
  const handleLower = normalizeHandle(rawHandle);
  const formatError = handleFormatError(handleLower);
  if (formatError) throw new Error(formatError);

  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Please sign in again to claim a handle.');

  const res = await fetch(apiUrl('/api/moderate-content'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ target: 'handle', handle: rawHandle.trim() }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || 'That handle could not be claimed.');
  return payload;
}

/**
 * Save the user's display name.
 *
 * Same reasoning as claimHandle: the name is published beside every
 * comment, photo, friend card and activity row this user produces, and a
 * client that writes it directly writes past the filter. firestore.rules
 * now pins `displayName` and `firstName` shut against client writes, so
 * this is the only way to change them.
 */
export async function saveDisplayName(rawName) {
  const displayName = (rawName || '').trim();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Please sign in again to save your name.');

  const res = await fetch(apiUrl('/api/moderate-content'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ target: 'profileName', displayName }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || 'Could not save that name.');
  return payload;
}

export async function isHandleAvailable(rawHandle) {
  const handleLower = normalizeHandle(rawHandle);
  if (handleFormatError(handleLower)) return false;
  const snap = await getDoc(doc(db, 'handles', handleLower));
  return !snap.exists();
}
