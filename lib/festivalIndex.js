// lib/festivalIndex.js
//
// Groups shows into "festivals" purely from data already on hand — no new
// Firestore schema, mirroring lib/runIndex.js's pure-function + memoized-hook
// pattern (see hooks/useFestivalIndex.js).
//
// setlist.fm has no dedicated "festival" concept: a festival's name (e.g.
// "Bonnaroo 2023") shows up in the same `tour` field a regular tour name
// would (see lib/runIndex.js's buildTourIndex, which already groups by
// artist + tour name). What distinguishes a festival from an artist's own
// tour is that more than one artist shares the same tour-name text — a
// single-artist tour never does that. So: group all shows (any artist) by
// normalized tour name, and keep only groups spanning 2+ distinct artists.
//
// Known limitation: a festival where the user only logged one artist won't
// be detected (indistinguishable from that artist's own tour with the same
// name) — same class of limitation already documented for run/tour
// grouping in lib/runIndex.js.

import { parseDate, normalizeSongTitle } from '@/lib/utils';

function slugify(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

function pickMostCommon(counts) {
  let best = null;
  let bestCount = -1;
  for (const [value, count] of Object.entries(counts)) {
    if (count > bestCount) { best = value; bestCount = count; }
  }
  return best;
}

export function festivalKeyFor(tourName) {
  const slug = slugify(tourName);
  return slug || null;
}

export function buildFestivalIndex(shows = []) {
  const byKey = new Map(); // key -> shows[]

  shows.forEach(show => {
    if (!show?.artist || !show?.tour || !show.tour.trim() || !show.date) return;
    const key = festivalKeyFor(show.tour);
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(show);
  });

  const index = {};
  byKey.forEach((groupShows, key) => {
    const distinctArtists = new Set(groupShows.map(s => s.artist));
    if (distinctArtists.size < 2) return; // single-artist group is a tour, not a festival

    const sorted = groupShows.slice().sort((a, b) => parseDate(a.date) - parseDate(b.date));
    const nameCounts = {};
    sorted.forEach(s => { nameCounts[s.tour] = (nameCounts[s.tour] || 0) + 1; });

    const songKeys = new Set();
    sorted.forEach(s => (s.setlist || []).forEach(song => {
      const k = normalizeSongTitle((song?.name || '').trim());
      if (k) songKeys.add(k);
    }));

    const ratedShows = sorted.filter(s => typeof s.rating === 'number');
    const avgRating = ratedShows.length
      ? ratedShows.reduce((sum, s) => sum + s.rating, 0) / ratedShows.length
      : null;

    const venueSlugs = new Set(sorted.map(s => slugify(s.venue)).filter(Boolean));
    const countries = new Set(sorted.map(s => (s.country || '').trim().toLowerCase()).filter(Boolean));

    index[key] = {
      key,
      name: pickMostCommon(nameCounts),
      artists: Array.from(distinctArtists).sort((a, b) => a.localeCompare(b)),
      artistCount: distinctArtists.size,
      shows: sorted.map(s => ({
        showId: s.id,
        artist: s.artist,
        date: s.date,
        venue: s.venue || '',
        city: s.city || '',
        country: s.country || '',
        rating: typeof s.rating === 'number' ? s.rating : null,
      })),
      showCount: sorted.length,
      dateRange: { start: sorted[0].date, end: sorted[sorted.length - 1].date },
      uniqueSongs: songKeys.size,
      avgRating,
      venuesCount: venueSlugs.size,
      countriesVisited: countries.size,
    };
  });

  return index;
}
