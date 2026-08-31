// components/photos/ShowMediaSection.jsx
//
// Subscribes once to a concert's showPhotos (see lib/photos.js) and
// splits the result into the three category galleries — Photos & Videos,
// Posters, Setlist Photos — rendered on ShowDetailView. One listener for
// all three, not three near-identical ones against the same concertKey.

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Image as PosterIcon, ScrollText } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { subscribePhotos, CATEGORY_FALLBACK } from '@/lib/photos';
import MediaGalleryView from './MediaGalleryView';

export default function ShowMediaSection({ show }) {
  const { user, guestMode, normalizeShowKey } = useApp();
  const concertKey = useMemo(() => (show ? normalizeShowKey(show) : null), [show, normalizeShowKey]);

  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reading showPhotos requires Firestore auth — a guest has no
    // Firebase auth user at all, so subscribing would just fail with
    // permission-denied and leave the spinner stuck forever. Skip it.
    if (!concertKey || !user || guestMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribePhotos(concertKey, (list) => {
      setAllItems(list);
      setLoading(false);
    });
    return unsubscribe;
  }, [concertKey, user, guestMode]);

  const byCategory = useMemo(() => {
    const buckets = { photo: [], poster: [], setlist: [] };
    allItems.forEach((item) => {
      const cat = item.category || CATEGORY_FALLBACK;
      (buckets[cat] || buckets.photo).push(item);
    });
    return buckets;
  }, [allItems]);

  if (!concertKey) return null;

  return (
    <>
      <MediaGalleryView
        show={show}
        concertKey={concertKey}
        category="photo"
        title="Photos & Videos"
        icon={Camera}
        emptyText="No photos or videos yet — be the first to share one from this show."
        signInText="Sign in to see and share photos from this show."
        items={byCategory.photo}
        allItems={allItems}
        loading={loading}
      />
      <MediaGalleryView
        show={show}
        concertKey={concertKey}
        category="poster"
        title="Posters"
        icon={PosterIcon}
        emptyText="No posters uploaded yet — add the show announcement or gig poster if you have one."
        signInText="Sign in to see and share posters for this show."
        items={byCategory.poster}
        allItems={allItems}
        loading={loading}
      />
      <MediaGalleryView
        show={show}
        concertKey={concertKey}
        category="setlist"
        title="Setlist Photos"
        icon={ScrollText}
        emptyText="No setlist photos yet — add a photo of the paper or board setlist if you have one."
        signInText="Sign in to see and share setlist photos for this show."
        zoomable
        items={byCategory.setlist}
        allItems={allItems}
        loading={loading}
      />
    </>
  );
}
