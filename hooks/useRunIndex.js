// hooks/useRunIndex.js
//
// Memoized run/tour index, built once per `shows` array change. See
// lib/runIndex.js for the actual aggregation. Mirrors hooks/useSongIndex.js.

'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { buildRunIndex, buildTourIndex } from '@/lib/runIndex';

export default function useRunIndex() {
  const { shows } = useApp();
  return useMemo(() => buildRunIndex(shows || []), [shows]);
}

export function useTourIndex() {
  const { shows } = useApp();
  return useMemo(() => buildTourIndex(shows || []), [shows]);
}
