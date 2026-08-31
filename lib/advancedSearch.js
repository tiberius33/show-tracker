// lib/advancedSearch.js
//
// Pure filtering logic for the Advanced Search page. Kept separate from the
// component so it's independently testable, mirroring lib/runIndex.js and
// lib/festivalIndex.js's pure-function pattern.
//
// `tourShowIds` / `festivalShowIds` are precomputed Sets of show ids (built
// by the caller from useTourIndex()/useFestivalIndex(), see
// components/search/AdvancedSearchView.jsx) rather than re-deriving keys
// here, so a selected tour/festival always matches exactly the shows that
// index already decided belong to it.

export const EMPTY_FILTERS = {
  artist: '',
  venue: '',
  city: '',
  country: '',
  dateFrom: '',
  dateTo: '',
  tourKey: '',
  festivalKey: '',
  minRating: 0,
  notes: '',
  friendUid: '',
  song: '',
};

function includesCI(haystack, needle) {
  return (haystack || '').toLowerCase().includes(needle.toLowerCase());
}

export function hasActiveFilters(filters) {
  return Object.entries(filters).some(([key, value]) =>
    key === 'minRating' ? value > 0 : Boolean(value)
  );
}

// Returns { matches, matchedFields } — matchedFields lists which filters
// contributed to the match, used to render a "why this matched" hint for
// fields not already visible on the show card (notes, song, friend).
export function matchShow(show, filters, { tourShowIds, festivalShowIds } = {}) {
  const matchedFields = [];

  if (filters.artist) {
    if (!includesCI(show.artist, filters.artist)) return { matches: false, matchedFields };
    matchedFields.push('artist');
  }
  if (filters.venue) {
    if (!includesCI(show.venue, filters.venue)) return { matches: false, matchedFields };
    matchedFields.push('venue');
  }
  if (filters.city) {
    if (!includesCI(show.city, filters.city)) return { matches: false, matchedFields };
    matchedFields.push('city');
  }
  if (filters.country) {
    if (!includesCI(show.country, filters.country)) return { matches: false, matchedFields };
    matchedFields.push('country');
  }
  if (filters.dateFrom) {
    if (!show.date || show.date < filters.dateFrom) return { matches: false, matchedFields };
  }
  if (filters.dateTo) {
    if (!show.date || show.date > filters.dateTo) return { matches: false, matchedFields };
  }
  if (filters.tourKey) {
    if (!tourShowIds?.has(show.id)) return { matches: false, matchedFields };
    matchedFields.push('tour');
  }
  if (filters.festivalKey) {
    if (!festivalShowIds?.has(show.id)) return { matches: false, matchedFields };
    matchedFields.push('festival');
  }
  if (filters.minRating > 0) {
    if (typeof show.rating !== 'number' || show.rating < filters.minRating) return { matches: false, matchedFields };
  }
  if (filters.notes) {
    if (!includesCI(show.comment, filters.notes)) return { matches: false, matchedFields };
    matchedFields.push('notes');
  }
  if (filters.friendUid) {
    if (!(show.taggedFriendUids || []).includes(filters.friendUid)) return { matches: false, matchedFields };
    matchedFields.push('friend');
  }
  if (filters.song) {
    const found = (show.setlist || []).some(s => includesCI(s?.name, filters.song));
    if (!found) return { matches: false, matchedFields };
    matchedFields.push('song');
  }

  return { matches: true, matchedFields };
}

export function filterShows(shows, filters, context) {
  return shows
    .map(show => ({ show, ...matchShow(show, filters, context) }))
    .filter(r => r.matches);
}
