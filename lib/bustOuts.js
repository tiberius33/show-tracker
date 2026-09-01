// lib/bustOuts.js
//
// Bust-out detection: flags a song in a setlist as returning after a
// significant absence ("bust-out"). Severity is based on BOTH how many
// shows the artist has played since the song was last heard and how much
// time has passed — whichever clears its band first wins:
//
//   minor  – 50+ shows OR 1+ year since last played
//   major  – 100+ shows OR 2+ years since last played
//   epic   – 5+ years since last played (no show-count band — a song that
//            hasn't been played in 5 years is an epic bust-out regardless
//            of how many shows that spans)
//
// DEFAULT_BUSTOUT_RULE holds these numbers; BUSTOUT_SENSITIVITY_OPTIONS
// lets a user scale all of them up/down together via getBustOutSeverity's
// `sensitivity` multiplier (below 1 = flags sooner, above 1 = later).
//
// Data sources (no new backend — reuses what already exists):
//   - netlify/functions/get-artist-song-stats.js fetches each song's play
//     dates AND every fetched show's date (`showDates`) across an artist's
//     ~200 most recent setlist.fm shows (same call TourInfoModal makes,
//     shared via the same `song_stats_${mbid}` localStorage cache key) —
//     `showDates` is what lets "shows since" be counted, not just days.
//   - The user's own logged performances (from useSongIndex) fill in songs
//     that fall outside that ~200-show window, per computeShowBustOuts's
//     personalPerformances param. "Shows since" can't be counted from that
//     fallback alone (we don't have the artist's full show list from it),
//     so severity there falls back to the days-based bands only.
//
// A song absent from *both* sources isn't flagged — we can't compute a gap
// without a prior date, so it's left alone rather than guessed at.

import { parseDate, normalizeSongTitle } from '@/lib/utils';
import { apiUrl } from '@/lib/api';

const MS_PER_DAY = 86400000;
const SONG_HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MBID_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const DEFAULT_BUSTOUT_RULE = {
  minor: { shows: 50, days: 365 },
  major: { shows: 100, days: 730 },
  epic: { days: 1825 },
};

export const DEFAULT_BUSTOUT_SENSITIVITY = 1;
export const BUSTOUT_SENSITIVITY_OPTIONS = [
  { value: 0.5, label: 'More sensitive (~25 shows / 6mo)' },
  { value: 1, label: 'Standard (50 shows / 1yr)' },
  { value: 1.5, label: 'Less sensitive (~75 shows / 18mo)' },
  { value: 2, label: 'Rare bust-outs only (100 shows / 2yr)' },
];

export const BUSTOUT_SEVERITY_META = {
  minor: { flames: '🔥', label: 'Bust-out', badgeClass: 'text-[#a0680f] bg-amber-subtle' },
  major: { flames: '🔥🔥', label: 'Major bust-out', badgeClass: 'text-white bg-orange-600' },
  epic: { flames: '🔥🔥🔥', label: 'Epic bust-out', badgeClass: 'text-white bg-red-600' },
};

function getCached(key, ttlMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const { data, cachedAt } = JSON.parse(raw);
    if (Date.now() - cachedAt < ttlMs) return data;
    localStorage.removeItem(key);
  } catch { /* ignore */ }
  return undefined;
}

function setCached(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch { /* ignore */ }
}

// Resolves an artist name to a setlist.fm mbid, cached for a week since
// artist identity never changes. Returns null (and caches the null) when
// no match is found, so a bad lookup doesn't get retried every render.
export async function resolveArtistMbid(artistName) {
  if (!artistName) return null;
  const cacheKey = `bustout_mbid_${normalizeSongTitle(artistName)}`;
  const cached = getCached(cacheKey, MBID_CACHE_TTL_MS);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(`${apiUrl('/.netlify/functions/search-artists')}?artistName=${encodeURIComponent(artistName)}`);
    if (!res.ok) throw new Error('search-artists failed');
    const data = await res.json();
    const candidates = data?.artist || [];
    const exact = candidates.find(a => (a.name || '').toLowerCase() === artistName.toLowerCase());
    const mbid = (exact || candidates[0])?.mbid || null;
    setCached(cacheKey, mbid);
    return mbid;
  } catch {
    return null;
  }
}

// Fetches (and caches) the artist's aggregated song/play-date history.
// Shares its cache key with TourInfoModal's "Songs" tab so viewing a show
// and viewing that artist's tour info don't each fetch it separately.
export async function fetchArtistSongHistory(mbid) {
  if (!mbid) return null;
  const cacheKey = `song_stats_${mbid}`;
  const cached = getCached(cacheKey, SONG_HISTORY_CACHE_TTL_MS);
  if (cached) return cached;

  try {
    const res = await fetch(`${apiUrl('/.netlify/functions/get-artist-song-stats')}?mbid=${encodeURIComponent(mbid)}`);
    if (!res.ok) throw new Error('get-artist-song-stats failed');
    const data = await res.json();
    setCached(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

// null when under every band; otherwise 'minor' | 'major' | 'epic'.
// `showsSince` (shows the artist played without this song) is optional —
// when unknown, severity is decided by `days` alone.
export function getBustOutSeverity(days, showsSince, sensitivity = DEFAULT_BUSTOUT_SENSITIVITY) {
  if (days == null) return null;
  const s = sensitivity > 0 ? sensitivity : 1;
  const showsKnown = showsSince != null;

  if (days >= DEFAULT_BUSTOUT_RULE.epic.days * s) return 'epic';
  if (days >= DEFAULT_BUSTOUT_RULE.major.days * s) return 'major';
  if (showsKnown && showsSince >= DEFAULT_BUSTOUT_RULE.major.shows * s) return 'major';
  if (days >= DEFAULT_BUSTOUT_RULE.minor.days * s) return 'minor';
  if (showsKnown && showsSince >= DEFAULT_BUSTOUT_RULE.minor.shows * s) return 'minor';
  return null;
}

function daysBetween(fromDate, toDate) {
  return Math.round((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
}

// { normalizedTitle -> [{ date: Date, venue, city, setlistUrl }] } from the
// get-artist-song-stats response shape ({ songs: [{ name, plays: [...] }] }).
function playsBySong(songHistory) {
  const map = new Map();
  (songHistory?.songs || []).forEach(s => {
    const key = normalizeSongTitle(s.name);
    if (!key) return;
    const plays = (s.plays || [])
      .map(p => ({ date: parseDate(p.date), venue: p.venue, city: p.city, setlistUrl: p.setlistUrl }))
      .filter(p => p.date && p.date.getTime() > 0);
    map.set(key, plays);
  });
  return map;
}

// Sorted array of every distinct date the artist played, from
// get-artist-song-stats's `showDates` field — used to count shows between
// two dates rather than just elapsed days.
function parseShowDates(songHistory) {
  return (songHistory?.showDates || [])
    .map(d => parseDate(d))
    .filter(d => d && d.getTime() > 0)
    .sort((a, b) => a.getTime() - b.getTime());
}

// Count of artist show dates strictly between `fromDate` and `toDate`
// (exclusive on both ends) — i.e. shows played without this song.
function countShowsBetween(sortedShowDates, fromDate, toDate) {
  if (!sortedShowDates.length) return null;
  let count = 0;
  for (const d of sortedShowDates) {
    const t = d.getTime();
    if (t > fromDate.getTime() && t < toDate.getTime()) count++;
  }
  return count;
}

// Returns Map(normalizedTitle -> bustOutInfo) for every song in `setlist`
// that clears a bust-out band as of `showDate`.
//
//   setlist               – show.setlist entries ({ name/song/title })
//   showDate              – this show's date string
//   songHistory           – fetchArtistSongHistory() result (nullable)
//   personalPerformances  – optional Map(normalizedTitle -> Date[]) of the
//                           user's own past performances of this artist's
//                           songs (excluding the show being analyzed)
//   sensitivity           – user's configured band multiplier
export function computeShowBustOuts({ setlist = [], showDate, songHistory, personalPerformances, sensitivity = DEFAULT_BUSTOUT_SENSITIVITY }) {
  const result = new Map();
  const showDateObj = parseDate(showDate);
  if (!showDateObj || showDateObj.getTime() <= 0) return result;

  const historyMap = songHistory ? playsBySong(songHistory) : new Map();
  const sortedShowDates = songHistory ? parseShowDates(songHistory) : [];
  const seen = new Set();

  setlist.forEach(song => {
    const title = (song?.name || song?.song || song?.title || '').trim();
    if (!title) return;
    const key = normalizeSongTitle(title);
    if (!key || seen.has(key)) return;
    seen.add(key);

    const fromHistory = historyMap.get(key) || [];
    const fromPersonal = (personalPerformances?.get(key) || [])
      .map(date => ({ date, venue: null, city: null, setlistUrl: null }));
    const priorPlays = [...fromHistory, ...fromPersonal]
      .filter(p => p.date && p.date.getTime() < showDateObj.getTime());

    if (priorPlays.length === 0) return;

    priorPlays.sort((a, b) => b.date.getTime() - a.date.getTime());
    const last = priorPlays[0];
    const days = daysBetween(last.date, showDateObj);
    const showsSince = countShowsBetween(sortedShowDates, last.date, showDateObj);
    const severity = getBustOutSeverity(days, showsSince, sensitivity);
    if (!severity) return;

    result.set(key, {
      severity,
      days,
      showsSince,
      lastPlayedDate: last.date,
      lastVenue: last.venue,
      lastCity: last.city,
      setlistUrl: last.setlistUrl,
    });
  });

  return result;
}
