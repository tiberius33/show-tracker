'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import VerificationBadge from './VerificationBadge';
import { subscribeVenuePhotos, uploadVenuePhoto, deleteVenuePhoto } from '@/lib/venues';

// Official venue photos — separate from user-uploaded concert photos
// (lib/photos.js's showPhotos collection). Every photo here is tagged
// with the venue checkmark since only a verified owner can upload one.
export default function VenuePhotoGallery({ venueKey, isOwner, currentUser, venueName }) {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!venueKey) return;
    return subscribeVenuePhotos(venueKey, setPhotos);
  }, [venueKey]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setUploading(true);
    try {
      await uploadVenuePhoto({ venueKey, file, uid: currentUser.uid, uploaderName: venueName });
    } catch (err) {
      console.error('Failed to upload venue photo:', err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (photo) => {
    if (!confirm('Delete this photo?')) return;
    await deleteVenuePhoto(photo);
  };

  if (!photos.length && !isOwner) return null;

  return (
    <Card variant="elevated" padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Camera size={18} className="text-brand" /> Official Photos <VerificationBadge size={14} />
        </h3>
        {isOwner && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading}>
              Upload Photo
            </Button>
          </>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="text-secondary text-sm">No official photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative group aspect-square rounded-xl overflow-hidden bg-hover">
              <img src={p.url} alt={p.caption || venueName} className="w-full h-full object-cover" />
              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleDelete(p)}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
