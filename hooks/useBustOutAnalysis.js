// hooks/useBustOutAnalysis.js
//
// Resolves a show's artist to a setlist.fm mbid, fetches that artist's
// recent play-date history (including every show date, for "shows since"
// counts), merges in the user's own personal performance history for songs
// outside that window, and computes which songs in `show.setlist` are
// bust-outs at the given sensitivity. See lib/bustOuts.js for the
// underlying calculation.

'use client';

import { useState, useEffect, useMemo } from 'react';
import useSongIndex from '@/hooks/useSongIndex';
import { artistSlugFromName } from '@/lib/songIndex';
import { normalizeSongTitle, parseDate } from '@/lib/utils';
import {
  resolveArtistMbid,
  fetchArtistSongHistory,
  computeShowBustOuts,
  DEFAULT_BUSTOUT_SENSITIVITY,
} from '@/lib/bustOuts';

export default function useBustOutAnalysis(show, sensitivity = DEFAULT_BUSTOUT_SENSITIVITY) {
  const songIndex = useSongIndex();
  const [songHistory, setSongHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  const artistSlug = show?.artist ? artistSlugFromName(show.artist) : null;

  useEffect(() => {
    if (!show?.artist) return;
    let cancelled = false;
    setLoading(true);
    resolveArtistMbid(show.artist)
      .then(mbid => (mbid ? fetchArtistSongHistory(mbid) : null))
      .then(data => { if (!cancelled) setSongHistory(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [show?.artist]);

  // Map(normalizedTitle -> Date[]) of the user's own past performances of
  // this artist's songs, excluding the show being analyzed — fills gaps
  // for songs outside setlist.fm's fetched ~200-show window.
  const personalPerformances = useMemo(() => {
    const map = new Map();
    if (!artistSlug) return map;
    Object.values(songIndex).forEach(entry => {
      if (entry.artistSlug !== artistSlug) return;
      const key = normalizeSongTitle(entry.title);
      if (!key) return;
      const dates = entry.performances
        .filter(p => p.showId !== show?.id)
        .map(p => parseDate(p.date))
        .filter(d => d && d.getTime() > 0);
      if (dates.length) map.set(key, dates);
    });
    return map;
  }, [songIndex, artistSlug, show?.id]);

  const bustOuts = useMemo(() => {
    if (!show?.setlist?.length) return new Map();
    return computeShowBustOuts({
      setlist: show.setlist,
      showDate: show.date,
      songHistory,
      personalPerformances,
      sensitivity,
    });
  }, [show?.setlist, show?.date, songHistory, personalPerformances, sensitivity]);

  return { bustOuts, loading };
}
