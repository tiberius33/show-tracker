// lib/artistImage.js
//
// Client-side helper to fetch an artist photo URL via the artist-image Netlify function.
// Returns a string URL or null if unavailable.

export async function fetchArtistImage(artistName) {
  if (!artistName?.trim()) return null;
  try {
    const res = await fetch(
      `/.netlify/functions/artist-image?artist=${encodeURIComponent(artistName.trim())}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.imageUrl || null;
  } catch {
    return null;
  }
}
