// hooks/useSongIndex.js
//
// Memoized personal song index, built once per `shows` array change (not on
// every unrelated context update, and never rebuilt per-song) — a user can
// have 1,000+ shows with 20+ songs each, so this must stay a single pass.
// See lib/songIndex.js for the actual aggregation.

'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { buildSongIndex } from '@/lib/songIndex';

export default function useSongIndex() {
  const { shows } = useApp();
  return useMemo(() => buildSongIndex(shows || []), [shows]);
}
