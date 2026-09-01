// hooks/useFestivalShows.js
//
// Memoized stats for one festival, built once per `shows`/`festivalId`
// change. See lib/festivalGrouping.js for the actual grouping. Mirrors
// hooks/useRunIndex.js.

'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { buildFestivalStats } from '@/lib/festivalGrouping';

export default function useFestivalShows(festivalId) {
  const { shows } = useApp();
  return useMemo(() => {
    const festivalShows = festivalId ? (shows || []).filter(s => s.festivalId === festivalId) : [];
    return buildFestivalStats(festivalShows);
  }, [shows, festivalId]);
}
