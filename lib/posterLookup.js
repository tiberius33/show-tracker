// lib/posterLookup.js
//
// Client-side helpers for the concert-poster-art lookup waterfall.
// fetchShowPosterQuick (step 1: Ticketmaster/SeatGeek) is cheap and safe to
// call automatically. fetchShowPosterDeep (steps 2-3: band website + Reddit,
// both backed by a Claude judgment call) costs real tokens per call and
// should only ever be invoked from an explicit user action.

import { apiUrl } from '@/lib/api';

async function callPosterFunction(path, params, timeoutMs) {
  try {
    const query = new URLSearchParams(params);
    const res = await fetch(apiUrl(`/.netlify/functions/${path}?${query}`), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { found: false };
    return await res.json();
  } catch {
    return { found: false };
  }
}

export async function fetchShowPosterQuick({ artist, venue, date, city }) {
  if (!artist?.trim() || !date) return { found: false };
  return callPosterFunction('find-show-poster', { artist: artist.trim(), venue: venue || '', date, city: city || '' }, 12000);
}

export async function fetchShowPosterDeep({ artist, venue, date, tour }) {
  if (!artist?.trim() || !date) return { found: false };
  return callPosterFunction('find-show-poster-deep', { artist: artist.trim(), venue: venue || '', date, tour: tour || '' }, 30000);
}
