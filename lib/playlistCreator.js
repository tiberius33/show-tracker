/**
 * Shared song matching logic for playlist creation.
 * Works with both Spotify and Apple Music.
 */

import { formatDate } from '@/lib/utils';

// --- Song name normalization ---

/**
 * Strip common live-music annotations from song names:
 * (encore), (jam), (tease), (reprise), (segue), (debut),
 * (w/...), (with ...), (-> ...), trailing arrows (->), (>)
 */
export function normalizeSongName(name) {
  if (!name) return '';
  return name
    // Remove parenthetical annotations
    .replace(/\s*\((?:encore|jam|tease|reprise|segue|debut|outro|intro|acoustic|solo|instrumental)\)\s*/gi, '')
    // Remove "(w/ Guest Name)" or "(with Guest Name)"
    .replace(/\s*\((?:w\/|with\s+)[^)]*\)\s*/gi, '')
    // Remove "(-> Next Song)" transition markers
    .replace(/\s*\(->\s*[^)]*\)\s*/gi, '')
    // Remove set markers like "(Set 1)" "(Encore)"
    .replace(/\s*\((?:set\s*\d+|encore\s*\d*)\)\s*/gi, '')
    // Remove trailing arrows
    .replace(/\s*->\s*$/, '')
    .replace(/\s*>\s*$/, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Song matching ---

/**
 * Simple Levenshtein distance for fuzzy matching.
 */
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Score how well a search result matches the expected song.
 * Returns 0-100.
 */
export function scoreSongMatch(searchName, trackName) {
  const s = searchName.toLowerCase().trim();
  const t = trackName.toLowerCase().trim();

  // Exact match
  if (s === t) return 100;

  // One contains the other
  if (t.includes(s) || s.includes(t)) return 80;

  // Levenshtein similarity
  const distance = levenshteinDistance(s, t);
  const maxLen = Math.max(s.length, t.length);
  if (maxLen === 0) return 0;
  const similarity = 1 - (distance / maxLen);

  return Math.round(similarity * 60);
}

/**
 * Find the best matching track from search results.
 * Returns the best track or null if no good match.
 */
export function findBestMatch(songName, tracks, expectedArtist) {
  if (!tracks || tracks.length === 0) return null;

  const normalizedSong = normalizeSongName(songName).toLowerCase();
  let bestTrack = null;
  let bestScore = 0;

  for (const track of tracks) {
    let score = scoreSongMatch(normalizedSong, track.name);

    // Bonus if artist matches
    if (expectedArtist && track.artist) {
      const artistMatch = track.artist.toLowerCase().includes(expectedArtist.toLowerCase()) ||
                          expectedArtist.toLowerCase().includes(track.artist.toLowerCase());
      if (artistMatch) score += 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestTrack = track;
    }
  }

  // Threshold: require at least 60 to accept
  return bestScore >= 60 ? bestTrack : null;
}

// --- Playlist metadata ---

/**
 * Build playlist name: "[Artist] - [Venue] [Date]"
 */
export function buildPlaylistName(show) {
  const date = formatDate(show.date);
  const venue = show.venue || 'Unknown Venue';
  return `${show.artist} - ${venue} ${date}`;
}

/**
 * Build playlist description.
 */
export function buildPlaylistDescription(show) {
  const date = formatDate(show.date);
  const location = show.venue
    ? `${show.venue}${show.city ? `, ${show.city}` : ''}`
    : 'Unknown Venue';
  return `Setlist from ${show.artist} at ${location} on ${date}. Created with MySetlists.net`;
}

// --- Build search query for a song ---

/**
 * Build an optimized search query for a song.
 * Uses the cover artist if it's a cover song, otherwise the show artist.
 */
export function buildSearchQuery(song, showArtist) {
  const cleanName = normalizeSongName(song.name);
  const artist = song.cover || showArtist;
  // Spotify search syntax: track name + artist filter
  return `${cleanName} artist:${artist}`;
}

/**
 * Build Apple Music search query (no special syntax, just terms).
 */
export function buildAppleMusicSearchQuery(song, showArtist) {
  const cleanName = normalizeSongName(song.name);
  const artist = song.cover || showArtist;
  return `${cleanName} ${artist}`;
}

// --- Filter out non-song entries from setlist ---

/**
 * Filter out set breaks and empty entries from a setlist.
 */
export function getPlayableSongs(setlist) {
  if (!setlist) return [];
  return setlist.filter(song =>
    song.name &&
    song.name.trim() !== '' &&
    !song.setBreak
  );
}

// --- Delay helper for rate limiting ---

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
