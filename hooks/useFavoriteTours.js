// hooks/useFavoriteTours.js
//
// Loads the signed-in user's favorite tours once and exposes an optimistic
// star toggle. Mirrors the wishlist star pattern in
// components/WishlistView.jsx: flip local state first, write to Firestore,
// revert + toast on failure — so a rejected write can never look like it
// succeeded (the bug class documented in lib/wishlist.js).

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { loadFavoriteTours, addFavoriteTour, removeFavoriteTour } from '@/lib/favoriteTours';

export default function useFavoriteTours() {
  const { user, setToast } = useApp();
  const [favorites, setFavorites] = useState({}); // tourKey -> { tourName, artistName, addedAt }
  const [loading, setLoading] = useState(true);
  const [pendingKeys, setPendingKeys] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setFavorites({});
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    loadFavoriteTours(user.uid)
      .then(data => { if (!cancelled) setFavorites(data || {}); })
      .catch(err => {
        console.error('Failed to load favorite tours:', err);
        if (!cancelled) setToast?.({ message: "Couldn't load your favorite tours.", type: 'error' });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, setToast]);

  const toggleFavorite = useCallback(async (tour) => {
    if (!user || !tour?.key || pendingKeys.has(tour.key)) return;
    const key = tour.key;
    const wasFavorite = !!favorites[key];

    setPendingKeys(prev => new Set(prev).add(key));
    setFavorites(prev => {
      const next = { ...prev };
      if (wasFavorite) delete next[key];
      else next[key] = { tourName: tour.tourName || '', artistName: tour.artistName || '', addedAt: new Date().toISOString() };
      return next;
    });

    try {
      if (wasFavorite) await removeFavoriteTour(user.uid, key);
      else await addFavoriteTour(user.uid, tour);
    } catch (err) {
      // Revert — the star must never show a state Firestore didn't accept.
      setFavorites(prev => {
        const next = { ...prev };
        if (wasFavorite) next[key] = { tourName: tour.tourName || '', artistName: tour.artistName || '', addedAt: new Date().toISOString() };
        else delete next[key];
        return next;
      });
      setToast?.({
        message: err?.code === 'permission-denied'
          ? "Couldn't save — you don't have permission to update your favorite tours."
          : "Couldn't save that favorite. Please try again.",
        type: 'error',
      });
    } finally {
      setPendingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [user, favorites, pendingKeys, setToast]);

  return { favorites, loading, pendingKeys, toggleFavorite, isFavorite: (key) => !!favorites[key] };
}
