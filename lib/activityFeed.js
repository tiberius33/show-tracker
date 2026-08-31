/**
 * Firestore helpers for the friend activity feed.
 *
 * Schema: top-level `userActivity` collection, one doc per event —
 * append-only, never updated or deleted by the app. Mirrors the shape of
 * showTags/showSuggestions (top-level collection, owner-uid field) rather
 * than a subcollection, since reading a feed means querying across many
 * users' activity at once, which subcollections can't do in one query.
 *
 *   userActivity/{autoId}
 *     {
 *       userId: string,       // the friend who did the thing
 *       userName: string,
 *       action: 'added_show' | 'rated_show',
 *       showId: string,
 *       artist: string,
 *       venue: string | null,
 *       rating: number | null,  // only set for 'rated_show'
 *       handle: string | null,  // actor's public-profile handle, snapshotted
 *                                // at write time — see logActivity() below
 *       timestamp: serverTimestamp(),
 *     }
 *
 * Privacy: logActivity() checks the actor's own userProfiles.shareActivity
 * (default true — opt-out, unlike the off-by-default Public Profile) before
 * writing, so an opted-out user's actions are never recorded at all rather
 * than recorded-but-filtered. This is a one-way door: flipping the setting
 * off doesn't retroactively remove past entries, only stops new ones.
 *
 * Firestore rule (see firestore.rules): reads/writes just require auth,
 * matching the existing showTags/showSuggestions precedent — privacy is
 * enforced by what queries the app chooses to run (friends-only) and by
 * the write-time shareActivity check, not a per-doc ACL. A future PR could
 * tighten this if that precedent changes.
 *
 * Firestore composite index: querying `where('userId','in',[...])` +
 * `orderBy('timestamp','desc')` needs a composite index that isn't
 * pre-created — Firestore will log a console error with a direct "create
 * index" link the first time this runs against a fresh project. Not an
 * issue against a project that already has other `in` + `orderBy` queries
 * indexed the same way.
 */

import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, where, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const CHUNK_SIZE = 10; // Firestore 'in' supports up to 30; 10 keeps listener count low for typical friend-list sizes
const PER_CHUNK_LIMIT = 50;

export async function logActivity(uid, userName, action, payload) {
  if (!uid) return;
  try {
    const profileSnap = await getDoc(doc(db, 'userProfiles', uid));
    const profile = profileSnap.exists() ? profileSnap.data() : {};
    if (profile.shareActivity === false) return;

    // Denormalize the actor's handle at write time, only if their public
    // profile is on right now — a feed item can then deep-link to the
    // existing /u/{handle}/shows/{showId} public show page (the only route
    // that can render another user's individual show; there's no
    // "friend's private show" view). If public profile is off, `handle` is
    // omitted and the feed just renders plain, unlinked text for that item.
    // This is a snapshot, not a live join: toggling public profile later
    // doesn't retroactively change old feed items' linkability.
    const handle = profile.publicProfile ? (profile.handle || null) : null;

    await addDoc(collection(db, 'userActivity'), {
      userId: uid,
      userName: userName || 'A friend',
      action,
      handle,
      ...payload,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    // Best-effort — never let a feed-logging failure surface as an error
    // on the show-add/rating flow that triggered it.
    console.error(`[activityFeed] Failed to log "${action}" for ${uid}:`, err.code || err.message, err);
  }
}

// Real-time feed of friends' activity. Calls `callback` with the full
// merged, sorted list every time any chunk updates. Returns an unsubscribe
// function that tears down every chunk's listener.
export function subscribeFriendActivity(friendUids, callback) {
  if (!friendUids || friendUids.length === 0) {
    callback([]);
    return () => {};
  }

  const chunks = [];
  for (let i = 0; i < friendUids.length; i += CHUNK_SIZE) {
    chunks.push(friendUids.slice(i, i + CHUNK_SIZE));
  }

  const chunkResults = chunks.map(() => []);

  const emit = () => {
    const merged = chunkResults
      .flat()
      .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
    callback(merged);
  };

  const unsubs = chunks.map((chunk, idx) => {
    const q = query(
      collection(db, 'userActivity'),
      where('userId', 'in', chunk),
      orderBy('timestamp', 'desc'),
      limit(PER_CHUNK_LIMIT)
    );
    return onSnapshot(q, (snap) => {
      chunkResults[idx] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    }, (err) => {
      console.error('[activityFeed] Listener failed:', err.code || err.message, err);
    });
  });

  return () => unsubs.forEach((u) => u());
}
