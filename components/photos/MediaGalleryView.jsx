// components/photos/MediaGalleryView.jsx
//
// Presentational gallery: thumbnail grid + lightbox + upload button, for
// one category ('photo' | 'poster' | 'setlist') of a concert's media.
// Deliberately takes `items` as a prop rather than subscribing itself —
// see ShowMediaSection.jsx, which subscribes once for all three
// categories so a show page doesn't run three near-identical Firestore
// listeners against the same concertKey.

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Trash2, ChevronLeft, ChevronRight, Play, Plus } from 'lucide-react';
import { Card, Avatar, Button, Modal, Spinner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { togglePhotoLike, deletePhoto, extractYoutubeId } from '@/lib/photos';
import { createEngagementNotification } from '@/lib/notifications';
import { timeAgo } from '@/lib/utils';

const LABEL_BY_CATEGORY = { poster: 'poster', setlist: 'setlist photo' };
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

function Lightbox({ items, index, onIndexChange, onClose, currentUid, canModerate, onLike, onDelete, zoomable }) {
  const item = items[index];
  const [zoomed, setZoomed] = useState(false);

  const handleKey = useCallback((e) => {
    if (e.key === 'ArrowLeft') onIndexChange((index - 1 + items.length) % items.length);
    if (e.key === 'ArrowRight') onIndexChange((index + 1) % items.length);
  }, [index, items.length, onIndexChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  useEffect(() => { setZoomed(false); }, [index]);

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
            <img
              src={item.url}
              alt={item.caption || 'Concert media'}
              onClick={zoomable ? () => setZoomed((z) => !z) : undefined}
              className={`transition-transform ${zoomable ? 'cursor-zoom-in' : ''} ${
                zoomed ? 'max-w-none max-h-none scale-150 cursor-zoom-out' : 'max-w-full max-h-[70vh] object-contain'
              }`}
            />
          )}
        </div>
        {zoomable && (
          <p className="text-xs text-muted text-center -mt-1">Click the image to zoom in</p>
        )}

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

export default function MediaGalleryView({ show, concertKey, category, title, icon: Icon, emptyText, signInText, zoomable, items, allItems, loading }) {
  const { user, isAdmin, guestMode, setToast } = useApp();
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleLike = async (item) => {
    if (!user) return;
    const alreadyLiked = (item.likedBy || []).includes(user.uid);
    try {
      await togglePhotoLike(item.id, user.uid, alreadyLiked);
      if (!alreadyLiked) {
        const likerName = user.displayName || 'Anonymous';
        const noun = LABEL_BY_CATEGORY[category] || (item.type === 'image' ? 'photo' : 'video');
        createEngagementNotification(item.uploadedBy, 'photo_like', {
          concertKey, artist: show.artist, venue: show.venue, date: show.date,
          fromUid: user.uid, fromName: likerName,
          message: `${likerName} liked your ${noun} from ${show.artist}`,
        });
      }
    } catch (err) {
      setToast?.("Couldn't update your like. Please try again.");
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Delete this?')) return;
    try {
      await deletePhoto(item);
      setLightboxIndex(null);
    } catch (err) {
      setToast?.("Couldn't delete that. Please try again.");
    }
  };

  return (
    <Card padding="md" className="mt-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Icon size={18} className="text-brand" />
          {title} {items.length > 0 && <span className="text-muted font-normal text-sm">({items.length})</span>}
        </h3>
        {user && !guestMode && (
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setUploadOpen(true)}>
            Add {category === 'photo' ? 'Photos' : title}
          </Button>
        )}
      </div>

      {!user || guestMode ? (
        <p className="text-sm text-muted">{signInText}</p>
      ) : loading ? (
        <div className="py-8"><Spinner size="sm" label={`Loading ${title.toLowerCase()}…`} /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item, i) => (
            <Thumbnail key={item.id} item={item} onClick={() => setLightboxIndex(i)} />
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          currentUid={user?.uid}
          canModerate={isAdmin}
          onLike={handleLike}
          onDelete={handleDelete}
          zoomable={zoomable}
        />
      )}

      {user && !guestMode && (
        <UploadMediaModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          concertKey={concertKey}
          uid={user.uid}
          uploaderName={user.displayName || 'Anonymous'}
          show={show}
          category={category}
          title={`Add ${title}`}
          existingPhotos={allItems}
          onUploaded={() => setToast?.('Uploaded!')}
          onError={(msg) => setToast?.(msg)}
        />
      )}
    </Card>
  );
}
