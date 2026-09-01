/**
 * Firestore helpers for concert comments — discussion on a specific
 * concert (artist + venue + date), not tied to any one user's private
 * show record. A prior friend-to-friend "Shared Memories" comment feature
 * (visible only to you + one tagged friend) was built, then deliberately
 * removed in v4.1.1 — this is a different, broader shape: any signed-in
 * user who has logged a matching show can see and post in the thread, not
 * just a tagged pair.
 *
 * "Matching show" uses the same identity as AppContext's
 * normalizeShowKey() (setlist.fm ID when available, else a normalized
 * artist|venue|date string) — the same key that already powers Shows
 * Together and show-suggestion matching, so "is this the same concert"
 * means the same thing everywhere in the app.
 *
 * Schema: top-level `showComments` collection, one doc per comment
 * (top-level or reply — replies are one level deep only, via `parentId`).
 *
 *   showComments/{autoId}
 *     {
 *       concertKey: string,        // normalizeShowKey(show)
 *       parentId: string | null,   // set only on a reply
 *       authorUid: string,
 *       authorName: string,
 *       text: string,
 *       likedBy: string[],         // uids who liked this comment
 *       createdAt: serverTimestamp(),
 *     }
 *
 * Moderation: any authenticated user can delete their own comment;
 * ADMIN_EMAILS (lib/constants.js) can delete any comment. Firestore rules
 * can't import app code, so the admin email is duplicated in
 * firestore.rules — keep the two in sync if that list ever changes.
 */

import {
  addDoc, arrayUnion, arrayRemove, collection, deleteDoc, doc,
  onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function subscribeComments(concertKey, callback) {
  if (!concertKey) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'showComments'),
    where('concertKey', '==', concertKey),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error('[comments] Listener failed:', err.code || err.message, err);
    // Without this, a permission-denied/missing-index/offline error leaves
    // the caller's `loading` state stuck true forever, since it only ever
    // flips false inside the success branch of this callback.
    callback([], err);
  });
}

export async function postComment(concertKey, authorUid, authorName, text, parentId = null) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'showComments'), {
    concertKey,
    parentId,
    authorUid,
    authorName: authorName || 'Anonymous',
    text: trimmed,
    likedBy: [],
    createdAt: serverTimestamp(),
  });
}

export async function toggleCommentLike(commentId, uid, alreadyLiked) {
  await updateDoc(doc(db, 'showComments', commentId), {
    likedBy: alreadyLiked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function deleteComment(commentId) {
  await deleteDoc(doc(db, 'showComments', commentId));
}
