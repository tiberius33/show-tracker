// lib/festivalGrouping.js
//
// Pure stats/grouping for a single Festival's attached shows — mirrors
// lib/runIndex.js's pure-function pattern (wrapped by hooks/useFestivalShows.js
// the same way lib/runIndex.js is wrapped by hooks/useRunIndex.js).
//
// Takes the *already-filtered* list of shows attached to one festival
// (shows.filter(s => s.festivalId === festival.id) — see useFestivalShows)
// rather than the full shows array + a festivalId, so this stays a plain
// array -> stats function with no Firestore/festival-lookup concerns.
//
// Day grouping uses each show's own `date` string directly (e.g.
// "2023-12-31") as the group key — never a `Date` object comparison — so a
// festival spanning a year boundary (Dec 30 - Jan 2) or any other
// timezone-sensitive range groups correctly with no off-by-one risk. Two
// shows on the same calendar date both land in that date's group; that's
// expected (an afternoon set + a late-night set), not a bug.

import { parseDate } from '@/lib/utils';

export function buildFestivalStats(festivalShows = []) {
  const sorted = festivalShows.slice().sort((a, b) => parseDate(a.date) - parseDate(b.date));

  const artists = new Set(sorted.map(s => s.artist).filter(Boolean));

  const ratedShows = sorted.filter(s => typeof s.rating === 'number');
  const avgRating = ratedShows.length
    ? ratedShows.reduce((sum, s) => sum + s.rating, 0) / ratedShows.length
    : null;

  // Group by raw date string — see file header on why this avoids
  // timezone/date-boundary bugs.
  const byDay = new Map(); // dateStr -> shows[]
  sorted.forEach(show => {
    const key = show.date || '';
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(show);
  });

  const groupedByDay = Array.from(byDay.entries())
    .map(([date, dayShows]) => ({ date, shows: dayShows }))
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));

  return {
    showCount: sorted.length,
    artists: Array.from(artists).sort((a, b) => a.localeCompare(b)),
    artistCount: artists.size,
    avgRating,
    dayCount: byDay.size,
    groupedByDay,
    shows: sorted,
  };
}
