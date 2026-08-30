// hooks/useArchivalAudio.js
//
// Looks up archival recordings for one show, on demand (called only when a
// show's detail view is actually open — not prefetched for a whole list),
// via netlify/functions/archival-audio-lookup.js. Never calls the Relisten
// API directly from the client.

'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';

export default function useArchivalAudio(artistName, date) {
  const [state, setState] = useState({ loading: !!(artistName && date), found: false, recordings: [] });

  useEffect(() => {
    if (!artistName || !date) {
      setState({ loading: false, found: false, recordings: [] });
      return;
    }

    let cancelled = false;
    setState(s => ({ ...s, loading: true }));

    const params = new URLSearchParams({ artist: artistName, date });
    fetch(apiUrl(`/.netlify/functions/archival-audio-lookup?${params}`))
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setState({ loading: false, found: !!data.found, recordings: data.recordings || [] });
      })
      .catch(() => {
        // A source being down degrades to the no-audio state, not an error.
        if (!cancelled) setState({ loading: false, found: false, recordings: [] });
      });

    return () => { cancelled = true; };
  }, [artistName, date]);

  return state;
}
