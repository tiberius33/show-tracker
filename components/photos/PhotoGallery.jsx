// components/photos/PhotoGallery.jsx
//
// Photo/video gallery for a concert, shown on ShowDetailView. Thumbnail
// grid (3-4 cols desktop, 2 tablet, 1 mobile) with a lightbox modal for
// the full view — arrow keys / on-screen arrows to navigate, Escape or
// backdrop click to close (via components/ui/Modal). See lib/photos.js
// for the data model and why this is keyed by concert, not by any one
// user's private show doc.

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Camera, Heart, Trash2, ChevronLeft, ChevronRight, Play, Plus } from 'lucide-react';
import { Card, Avatar, Button, Modal, Spinner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { subscribePhotos, togglePhotoLike, deletePhoto, extractYoutubeId } from '@/lib/photos';
import { createEngagementNotification } from '@/lib/notifications';
import { timeAgo } from '@/lib/utils';
import UploadMediaModal from './UploadMediaModal';

function Thumbnail({ item, onClick }) {
  if (item.type === 'youtube') {
    const videoId = extractYoutubeId(item.url);
    return (
      <button type="button" onClick={onClick} className="relative aspect-square rounded-xl overflow-hidden group bg-hover">
        {videoId && (
          <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt={item.caption || 'Video'} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <Play size={28} className="text-white drop-shadow" fill="white" />
        </div>
      </button>
    );
  }

  if (item.type === 'video') {
    return (
      <button type="button" onClick={onClick} className="relative aspect-square rounded-xl overflow-hidden group bg-hover">
        <video src={item.url} className="w-full h-full object-cover" preload="metadata" muted />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <Play size={28} className="text-white drop-shadow" fill="white" />
        </div>
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} className="aspect-square rounded-xl overflow-hidden hover:opacity-90 transition-opacity">
      <img src={item.url} alt={item.caption || 'Concert photo'} className="w-full h-full object-cover" />
    </button>
  );
}

function Lightbox({ items, index, onIndexChange, onClose, currentUid, canModerate, onLike, onDelete }) {
  const item = items[index];

  const handleKey = useCallback((e) => {
    if (e.key === 'ArrowLeft') onIndexChange((index - 1 + items.length) % items.length);
    if (e.key === 'ArrowRight') onIndexChange((index + 1) % items.length);
  }, [index, items.length, onIndexChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!item) return null;

  const liked = currentUid ? (item.likedBy || []).includes(currentUid) : false;
  const canDelete = currentUid && (item.uploadedBy === currentUid || canModerate);
  const videoId = item.type === 'youtube' ? extractYoutubeId(item.url) : null;

  return (
    <Modal open onClose={onClose} size="xl" showClose={false}>
      <div className="flex flex-col gap-3">
        <div className="relative bg-black rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: '50vh' }}>
          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => onIndexChange((index - 1 + items.length) % items.length)}
                aria-label="Previous"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => onIndexChange((index + 1) % items.length)}
                aria-label="Next"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {item.type === 'youtube' ? (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title={item.caption || 'YouTube video'}
              className="w-full aspect-video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : item.type === 'video' ? (
            <video src={item.url} controls autoPlay className="max-w-full max-h-[70vh]" />
          ) : (
            <img src={item.url} alt={item.caption || 'Concert photo'} className="max-w-full max-h-[70vh] object-contain" />
          )}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Avatar name={item.uploaderName} size="sm" />
              <span className="text-sm font-semibold text-primary">{item.uploaderName}</span>
              <span className="text-xs text-muted">{timeAgo(item.createdAt)}</span>
            </div>
            {item.caption && <p className="text-sm text-secondary mt-1.5">{item.caption}</p>}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => onLike(item)}
              disabled={!currentUid}
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                liked ? 'text-danger' : 'text-muted hover:text-primary'
              } disabled:opacity-50`}
            >
              <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
              {(item.likedBy || []).length > 0 && (item.likedBy || []).length}
            </button>
            {canDelete && (
              <button type="button" onClick={() => onDelete(item)} className="text-muted hover:text-danger">
                <Trash2 size={16} />
              </button>
            )}
            <button type="button" onClick={onClose} className="text-muted hover:text-primary text-sm font-medium">
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function PhotoGallery({ show }) {
  const { user, isAdmin, guestMode, setToast, normalizeShowKey } = useApp();
  const concertKey = useMemo(() => (show ? normalizeShowKey(show) : null), [show, normalizeShowKey]);

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    if (!concertKey || !user || guestMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribePhotos(concertKey, (list) => {
      setPhotos(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [concertKey, user, guestMode]);

  const handleLike = async (item) => {
    if (!user) return;
    const alreadyLiked = (item.likedBy || []).includes(user.uid);
    try {
      await togglePhotoLike(item.id, user.uid, alreadyLiked);
      if (!alreadyLiked) {
        const likerName = user.displayName || 'Anonymous';
        createEngagementNotification(item.uploadedBy, 'photo_like', {
          concertKey, artist: show.artist, venue: show.venue, date: show.date,
          fromUid: user.uid, fromName: likerName,
          message: `${likerName} liked your ${item.type === 'image' ? 'photo' : 'video'} from ${show.artist}`,
        });
      }
    } catch (err) {
      setToast?.("Couldn't update your like. Please try again.");
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Delete this photo/video?')) return;
    try {
      await deletePhoto(item);
      setLightboxIndex(null);
    } catch (err) {
      setToast?.("Couldn't delete that. Please try again.");
    }
  };

  if (!concertKey) return null;

  return (
    <Card padding="md" className="mt-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Camera size={18} className="text-brand" />
          Photos & Videos {photos.length > 0 && <span className="text-muted font-normal text-sm">({photos.length})</span>}
        </h3>
        {user && !guestMode && (
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setUploadOpen(true)}>
            Add Photos
          </Button>
        )}
      </div>

      {!user || guestMode ? (
        <p className="text-sm text-muted">Sign in to see and share photos from this show.</p>
      ) : loading ? (
        <div className="py-8"><Spinner size="sm" label="Loading gallery…" /></div>
      ) : photos.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">
          No photos or videos yet — be the first to share one from this show.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((item, i) => (
            <Thumbnail key={item.id} item={item} onClick={() => setLightboxIndex(i)} />
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          items={photos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          currentUid={user?.uid}
          canModerate={isAdmin}
          onLike={handleLike}
          onDelete={handleDelete}
        />
      )}

      {user && !guestMode && (
        <UploadMediaModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          concertKey={concertKey}
          uid={user.uid}
          uploaderName={user.displayName || 'Anonymous'}
          existingPhotos={photos}
          onUploaded={() => setToast?.('Uploaded!')}
          onError={(msg) => setToast?.(msg)}
        />
      )}
    </Card>
  );
}
