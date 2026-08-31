/**
 * Firebase Storage + Firestore helpers for concert photos and videos.
 *
 * Same "keyed by concert, not by any one user's private show" shape as
 * lib/comments.js — anyone who's logged a matching show (via
 * AppContext's normalizeShowKey()) can see and add to the gallery, so
 * attendees can share what they shot without a friend relationship.
 *
 * Two kinds of media:
 *  - Uploaded files (image/* or video/mp4) go to Firebase Storage at
 *    showPhotos/{concertKey}/{uid}/{timestamp}-{filename}, capped at
 *    MAX_FILE_BYTES per file and MAX_CONCERT_BYTES total per concert
 *    (checked client-side against the already-loaded gallery before
 *    starting the upload — see checkUploadAllowed()).
 *  - YouTube links are stored as a Firestore doc only, no Storage
 *    involved — `type: 'youtube'`, `url` holds the original link,
 *    `storagePath`/`fileSize` are null.
 *
 * Schema:
 *   showPhotos/{autoId}
 *     {
 *       concertKey: string,
 *       uploadedBy: string,
 *       uploaderName: string,
 *       type: 'image' | 'video' | 'youtube',
 *       url: string,             // Storage download URL, or the YouTube link
 *       storagePath: string | null,
 *       fileSize: number | null, // bytes; null for youtube
 *       caption: string,
 *       likedBy: string[],
 *       createdAt: serverTimestamp(),
 *     }
 *
 * Storage rules live in storage.rules (new, alongside firestore.rules) —
 * deploy both with `npm run deploy:rules`.
 */

import {
  addDoc, arrayUnion, arrayRemove, collection, deleteDoc, doc,
  onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per file
export const MAX_CONCERT_BYTES = 50 * 1024 * 1024; // 50MB total per concert

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'];

// Sanitize the concert key for use as a Storage path segment — it can
// contain characters (spaces, pipes from the artist|venue|date fallback
// key) that Storage paths tolerate but are awkward to work with.
function storagePathSegment(concertKey) {
  return concertKey.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// Checked before starting an upload — returns an error message string, or
// null if the upload is allowed. `existingPhotos` is the gallery's
// already-loaded list (from subscribePhotos), so this doesn't need an
// extra Firestore read.
export function checkUploadAllowed(file, existingPhotos) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, GIF, WEBP images or MP4 videos are supported.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} is over the 10MB per-file limit.`;
  }
  const currentTotal = (existingPhotos || []).reduce((sum, p) => sum + (p.fileSize || 0), 0);
  if (currentTotal + file.size > MAX_CONCERT_BYTES) {
    return "This show's photo/video gallery is at the 50MB limit — remove something first.";
  }
  return null;
}

export function extractYoutubeId(url) {
  const match = (url || '').match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function subscribePhotos(concertKey, callback) {
  if (!concertKey) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, 'showPhotos'),
    where('concertKey', '==', concertKey),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error('[photos] Listener failed:', err.code || err.message, err);
  });
}

export async function uploadShowMedia(file, concertKey, uid, uploaderName, caption, onProgress) {
  const path = `showPhotos/${storagePathSegment(concertKey)}/${uid}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);

  const url = await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      'state_changed',
      (snap) => onProgress?.(snap.bytesTransferred / snap.totalBytes),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });

  await addDoc(collection(db, 'showPhotos'), {
    concertKey,
    uploadedBy: uid,
    uploaderName: uploaderName || 'Anonymous',
    type: file.type.startsWith('video/') ? 'video' : 'image',
    url,
    storagePath: path,
    fileSize: file.size,
    caption: (caption || '').trim(),
    likedBy: [],
    createdAt: serverTimestamp(),
  });
}

export async function addYoutubeLink(url, concertKey, uid, uploaderName, caption) {
  const videoId = extractYoutubeId(url);
  if (!videoId) throw new Error('Not a recognizable YouTube link.');

  await addDoc(collection(db, 'showPhotos'), {
    concertKey,
    uploadedBy: uid,
    uploaderName: uploaderName || 'Anonymous',
    type: 'youtube',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    storagePath: null,
    fileSize: null,
    caption: (caption || '').trim(),
    likedBy: [],
    createdAt: serverTimestamp(),
  });
}

export async function togglePhotoLike(photoId, uid, alreadyLiked) {
  await updateDoc(doc(db, 'showPhotos', photoId), {
    likedBy: alreadyLiked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function deletePhoto(photo) {
  await deleteDoc(doc(db, 'showPhotos', photo.id));
  if (photo.storagePath) {
    try {
      await deleteObject(ref(storage, photo.storagePath));
    } catch (err) {
      // The Firestore doc is already gone (the visible part of "delete");
      // an orphaned Storage file just wastes a little space, so log and
      // move on rather than leaving the doc undeleted over a storage hiccup.
      console.error('[photos] Failed to delete storage object for', photo.storagePath, err);
    }
  }
}
