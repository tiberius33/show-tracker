// lib/bandSetlist.js
//
// The client side of the band-source path: resolve an artist through the
// registry, and if a band source owns them, get that source's setlist for a
// date and hand back the show-document fields to write.
//
// This is the ONE place the app decides where a setlist comes from once a
// show has been identified, so the five add paths don't each grow their own
// copy of the logic. Everything funnels through AppContext's addShow /
// addShowsFromTour / scanForMissingSetlists, which is where this is called
// from — see the comment on buildShowDoc in context/AppContext.jsx ("Change
// the shape here or not at all").
//
// ── What this does NOT change ─────────────────────────────────────────
//
// setlist.fm remains the show *discovery* layer everywhere it is one today:
// artist search, tour lists, venue and mbid resolution, the festival
// lineup lookup. Neither elgoose.net nor phish.net replaces those cleanly,
// and this change is not about replacing show search. It is only about
// where the setlist comes from once a show is identified.
//
// So the fall-through is silent and total: if the band source fails,
// returns nothing, or isn't configured, the caller keeps whatever
// setlist.fm gave it and records `setlistSource: 'setlistfm'`. A volunteer
// archive being down must never turn into a failed show add.

import { apiUrl } from '@/lib/api';
import { resolveSource, SETLISTFM_SOURCE_ID } from '@/lib/setlistSources';
import { mergeBandSetlist } from '@/lib/bandSetlistMerge';

const FETCH_TIMEOUT_MS = 12000;

// A hung request must not hang a show add. Races the fetch rather than
// using AbortController so this keeps working in the Capacitor WebView
// without depending on which abort semantics that runtime ships.
function withTimeout(promise, ms = FETCH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Band setlist request timed out')), ms)),
  ]);
}

/**
 * fetchBandSetlist({ artist, artistMbid, date, venue })
 *   -> null | { source, songs, sourceShowId, sourcePermalink, setlistNotes,
 *               tour, ambiguous, candidates, message }
 *
 * Returns null for every "carry on with setlist.fm" case: artist has no
 * band source, the fetch failed, the source had no show on that date, or
 * the source returned a show with no songs. A caller can therefore treat
 * null as "nothing to do" without inspecting a reason.
 */
export async function fetchBandSetlist({ artist, artistMbid, date, venue } = {}) {
  if (!artist || !date) return null;

  const source = resolveSource({ name: artist, mbid: artistMbid });
  if (!source.isBandSource) return null;

  const params = new URLSearchParams({ source: source.id, artist, date });
  if (venue) params.set('venue', venue);
  if (source.sourceArtistFilter) params.set('artistId', source.sourceArtistFilter);

  try {
    const response = await withTimeout(fetch(apiUrl(`/api/band-setlist?${params.toString()}`)));
    if (!response.ok) {
      // Includes the 503 a missing PHISHNET_API_KEY produces. Nothing to
      // tell the user about — the setlist.fm path still works.
      console.warn(`[BAND-SETLIST] ${source.id} returned HTTP ${response.status} for ${artist} ${date}`);
      return null;
    }

    const data = await response.json();
    if (!data?.ok || !Array.isArray(data.songs) || data.songs.length === 0) {
      if (data?.message) console.log(`[BAND-SETLIST] ${source.id} ${artist} ${date}: ${data.message}`);
      return null;
    }

    if (data.ambiguous) {
      // Surfaced rather than swallowed: more than one show on this date and
      // the function had to choose. See selectShow in
      // netlify/functions/band-setlist.js.
      console.warn(`[BAND-SETLIST] ${artist} ${date}: ${data.message}`);
    }

    return {
      source: source.id,
      songs: data.songs,
      sourceShowId: data.sourceShowId || '',
      sourcePermalink: data.sourcePermalink || '',
      setlistNotes: data.setlistNotes || '',
      tour: data.tour || '',
      ambiguous: !!data.ambiguous,
      candidates: data.candidates || [],
      message: data.message || '',
    };
  } catch (err) {
    console.warn(`[BAND-SETLIST] ${source.id} fetch failed for ${artist} ${date}:`, err?.message || err);
    return null;
  }
}

/**
 * The show-document fields a band-sourced setlist contributes, so callers
 * write the same keys in the same way every time.
 *
 * `setlistSource` is the field everything downstream branches on. Nothing
 * should infer the source by sniffing for the presence of `footnote` or
 * `transitionMark` — a Goose show where nobody wrote any footnotes is still
 * a Goose show from El Goose.
 */
export function bandSetlistShowFields(result, setlist) {
  return {
    setlist,
    setlistSource: result.source,
    sourceShowId: result.sourceShowId || '',
    sourcePermalink: result.sourcePermalink || '',
    setlistNotes: result.setlistNotes || '',
    setlistFetchedAt: new Date().toISOString(),
    isManual: false,
  };
}

/**
 * enrichShowDataWithBandSetlist(showData)
 *   -> showData (unchanged), or showData with the band source's setlist
 *
 * The add-path hook. Takes a show document about to be written — already
 * carrying whatever setlist.fm gave it, which may be nothing — and swaps in
 * the band source's setlist if one exists for that artist and date.
 *
 * Always returns a usable show document. On any failure it returns the
 * input with `setlistSource: 'setlistfm'` stamped on it, so the stored
 * document always says where its setlist came from rather than leaving
 * later readers to guess.
 */
export async function enrichShowDataWithBandSetlist(showData) {
  if (!showData) return showData;

  const stamped = { ...showData, setlistSource: showData.setlistSource || SETLISTFM_SOURCE_ID };

  const result = await fetchBandSetlist({
    artist: showData.artist,
    artistMbid: showData.artistMbid,
    date: showData.date,
    venue: showData.venue,
  });

  if (!result) return stamped;

  // Merged rather than assigned even on a fresh add. A "fresh" add is not
  // always fresh — the ticket scanner and the festival lineup modal can
  // both re-add over a show that already has a setlist, and addShow's own
  // duplicate check hands off to mergeTagDataIntoShow rather than creating
  // a second document. Going through the merge rules means there is exactly
  // one code path that can replace a setlist, and it is the one that cannot
  // destroy a rating.
  const { setlist, changed } = mergeBandSetlist(showData.setlist || [], result.songs);
  if (!changed) return stamped;

  const fields = bandSetlistShowFields(result, setlist);

  return {
    ...stamped,
    ...fields,
    // The source's own tour name, but only where the show hasn't already
    // got one. A user-entered or setlist.fm tour name is not worth
    // overwriting with a differently-spelled equivalent.
    tour: showData.tour || result.tour || null,
  };
}
