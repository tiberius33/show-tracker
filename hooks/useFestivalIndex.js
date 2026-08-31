// hooks/useFestivalIndex.js
//
// Memoized festival index, built once per `shows` array change. See
// lib/festivalIndex.js for the actual grouping. Mirrors hooks/useRunIndex.js.

'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { buildFestivalIndex } from '@/lib/festivalIndex';

export default function useFestivalIndex() {
  const { shows } = useApp();
  return useMemo(() => buildFestivalIndex(shows || []), [shows]);
}
