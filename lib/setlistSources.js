// lib/setlistSources.js
//
// The single place that answers one question: given this artist, who is the
// source of truth for their setlists?
//
// setlist.fm is the default and always will be — it covers the long tail,
// and nothing here changes that. What this registry adds is the handful of
// bands whose own community archive is strictly better than setlist.fm's
// mirror of it: per-song transitions, footnotes, jam-chart flags, official
// band-wide gap counts, soundcheck and opener flags. A source is opt-in per
// artist, never inferred — an artist absent from this file resolves to
// `setlistfm`, full stop.
//
// The registry is data rather than a switch statement on purpose. Adding
// Grateful Dead later (dead.net publishes HTML, not JSON, so it needs its
// own parser and caching strategy — deliberately out of this pass) should be
// one new entry below plus one new adapter file under
// netlify/functions/lib/, and nothing else.
//
// ── On matching, and why it is a heuristic ─────────────────────────────
//
// Show documents store `artist` as a plain string with no mbid (see the
// comment at the top of lib/songIndex.js), so at match time the artist
// string is usually all we have. That is genuinely ambiguous: "Goose" is
// also a Dutch electro band with its own setlist.fm entries, and a name
// match cannot tell the two apart.
//
// So resolveSource prefers an mbid when the caller has one — the artist
// search and the wishlist's selected-artist object both carry one — and
// falls back to the name otherwise, reporting which of the two it used via
// `matchedOn` so callers can treat a name match with appropriate suspicion.
//
// The name match being a heuristic is survivable because of what sits
// downstream of it, not because it is reliable:
//
//   1. A false positive costs nothing. Ask elgoose.net for a Dutch-Goose
//      show date and it returns no rows, and the merge rules in
//      lib/bandSetlistMerge.js write nothing on an empty result — the
//      existing setlist.fm setlist stands untouched.
//   2. The backfill (netlify/functions/admin-resync-setlists.js) reports
//      every show where the source returned nothing, which is exactly the
//      list of suspected false positives, for a human to look at.
//
// Never let a mismatch destroy data. That invariant lives in the merge
// rules; this file only decides who to ask.

import { artistKeyFor } from '@/lib/wishlist';

// Normalized artist key, reusing the app's one and only artist normalizer.
// artistKeyFor returns the mbid when given an mbid-bearing artist object,
// which is not what we want for a *name* key, so names are passed through
// deliberately mbid-less — the same trick artistSlugFromName pulls in
// lib/songIndex.js, and for the same reason.
//
// The input is trimmed first, which is not a second normalizer but a
// necessary guard against one of artistKeyFor's quirks: it collapses
// whitespace to hyphens BEFORE it trims, so "  Goose  " comes out as
// "-goose-" and the trailing trim finds nothing left to remove. An artist
// string with stray padding — and user-typed ones do have it — would
// otherwise never match a registry entry, silently falling back to
// setlist.fm for no reason a reader could see.
export function artistNameKey(name) {
  return artistKeyFor({ name: String(name || '').trim() });
}

// ── The registry ──────────────────────────────────────────────────────
//
// Per entry:
//   id            – stored on the show document as `setlistSource`, and the
//                   `source` query parameter /api/band-setlist expects.
//   label         – human-readable, used for the attribution line in the UI.
//   homeUrl       – where the attribution links when a show has no permalink.
//   nameKeys      – normalized artist-name keys this source owns. Matched
//                   exactly against artistNameKey(showArtist); no fuzzy
//                   matching, so a name is either in this list or it isn't.
//   mbids         – setlist.fm / MusicBrainz artist mbids known to be this
//                   artist. Preferred over nameKeys when the caller has one.
//   deniedMbids   – mbids known to be a *different* artist sharing the name
//                   (the Dutch Goose problem). Matching one forces
//                   setlist.fm, overriding any name match.
//   sourceArtistFilter – the value the upstream API wants to identify the
//                   artist: elgoose.net takes an `artist` slug, phish.net
//                   takes a numeric `artistid`. Keyed by name key so one
//                   source can serve several acts.
//   requiresApiKey – whether the Netlify function needs an env-var key to
//                   talk to this source at all.
//
// ── On side projects ──────────────────────────────────────────────────
//
// elgoose.net carries Orebolo (the Rick Mitarotonda / Peter Anspach /
// Trevor Weekz acoustic project) and other Goose-adjacent acts under its
// `artist` filter, and phish.net's API is keyed by `artistid` and covers
// Trey Anastasio Band and related acts alongside Phish. Those belong here
// eventually, behind explicit config exactly like the entries below rather
// than behind fuzzy matching.
//
// They are NOT here yet, and that is deliberate: the brief was to add only
// the acts verifiable from a live API response, and this branch was built
// in an environment with no network route to either API (see the PR
// description). Adding an act on the strength of a remembered slug or
// artistid would be exactly the guesswork this registry exists to replace.
// Until someone confirms them against a live response, Orebolo and Trey
// Anastasio Band resolve to `setlistfm` — which is what they do today, so
// nothing regresses by waiting.
//
// To add one: append its name key to `nameKeys` and its upstream
// identifier to `sourceArtistFilter`. Nothing else needs to change.

export const SETLIST_SOURCES = {
  elgoose: {
    id: 'elgoose',
    label: 'El Goose',
    homeUrl: 'https://elgoose.net',
    // Songfish engine, v2, no key and no auth.
    apiBase: 'https://elgoose.net/api/v2',
    requiresApiKey: false,
    nameKeys: ['goose'],
    // Populate from a live lookup before relying on the mbid branch — see
    // the module header. An empty list is safe: resolveSource falls back to
    // the name match, which is the documented behaviour.
    mbids: [],
    // The Dutch electro act also called Goose. Its mbid belongs here once
    // someone has it; until then a show of theirs is caught by the
    // write-nothing-on-empty-result rule rather than by this list.
    deniedMbids: [],
    sourceArtistFilter: { goose: 'goose' },
  },

  phishnet: {
    id: 'phishnet',
    label: 'Phish.net',
    homeUrl: 'https://phish.net',
    apiBase: 'https://api.phish.net/v5',
    // PHISHNET_API_KEY, server-side only. The function returns 503 when it
    // is missing rather than falling back to a literal.
    requiresApiKey: true,
    nameKeys: ['phish'],
    mbids: [],
    deniedMbids: [],
    // phish.net identifies artists numerically. 1 is Phish itself, which is
    // also the API's default when no artistid is supplied — so this is the
    // one value that holds without a live response to check it against.
    sourceArtistFilter: { phish: '1' },
  },
};

// The default. Not an entry in SETLIST_SOURCES, because it is not a band
// source: it has no per-song transitions, footnotes, jam charts or official
// gaps to pull through, and it needs no adapter. It is the answer for every
// artist this registry does not explicitly claim.
export const SETLISTFM_SOURCE_ID = 'setlistfm';

const FALLBACK = Object.freeze({
  id: SETLISTFM_SOURCE_ID,
  label: 'setlist.fm',
  homeUrl: 'https://www.setlist.fm',
  isBandSource: false,
  matchedOn: 'default',
  nameKey: '',
  sourceArtistFilter: null,
  requiresApiKey: false,
});

// Accepts either a bare artist name or an artist-shaped object
// ({ name, mbid }), so callers that have been through the artist search can
// hand over what they already hold instead of unpacking it first.
function readArtist(artist) {
  if (typeof artist === 'string') return { name: artist, mbid: '' };
  return { name: artist?.name || '', mbid: artist?.mbid || '' };
}

/**
 * resolveSource(artist) -> {
 *   id, label, homeUrl, isBandSource, matchedOn, nameKey, sourceArtistFilter
 * }
 *
 * `artist` is an artist name, or an object with `name` and optionally
 * `mbid`. Never throws and never returns null — an unknown artist resolves
 * to the setlist.fm fallback.
 *
 * `matchedOn` reports how the decision was reached:
 *   'mbid'        – matched an mbid in a source's known-good list. Trustworthy.
 *   'name'        – matched a normalized artist name. A HEURISTIC: it cannot
 *                   distinguish two bands that share a name (see the module
 *                   header). Safe only because nothing downstream overwrites
 *                   data on an empty or failed fetch.
 *   'mbid-denied' – the mbid is on a deniedMbids list, so a name match that
 *                   would otherwise have hit was overruled.
 *   'default'     – no match; setlist.fm.
 */
export function resolveSource(artist) {
  const { name, mbid } = readArtist(artist);
  const nameKey = artistNameKey(name);

  if (mbid) {
    for (const source of Object.values(SETLIST_SOURCES)) {
      if (source.deniedMbids.includes(mbid)) {
        return { ...FALLBACK, matchedOn: 'mbid-denied', nameKey };
      }
    }
    for (const source of Object.values(SETLIST_SOURCES)) {
      if (source.mbids.includes(mbid)) {
        return describe(source, nameKey, 'mbid');
      }
    }
    // An mbid we don't recognize is not evidence of a different artist —
    // it is only evidence that the mbid lists above are incomplete. So fall
    // through to the name match rather than denying, which is the
    // prefer-mbid-then-fall-back-to-name rule this was asked for.
  }

  if (!nameKey) return { ...FALLBACK, nameKey: '' };

  for (const source of Object.values(SETLIST_SOURCES)) {
    if (source.nameKeys.includes(nameKey)) {
      return describe(source, nameKey, 'name');
    }
  }

  return { ...FALLBACK, nameKey };
}

function describe(source, nameKey, matchedOn) {
  return {
    id: source.id,
    label: source.label,
    homeUrl: source.homeUrl,
    isBandSource: true,
    matchedOn,
    nameKey,
    sourceArtistFilter: source.sourceArtistFilter[nameKey] || null,
    requiresApiKey: source.requiresApiKey,
  };
}

// Convenience predicate for the common "should I even try the band path?"
// branch, so callers don't each re-derive it from resolveSource's shape.
export function hasBandSource(artist) {
  return resolveSource(artist).isBandSource;
}

// The display label for a stored `setlistSource` value, for the attribution
// line on the show detail. Takes the stored id rather than an artist,
// because attribution must reflect where the data actually came from — not
// where the registry would send that artist today. An artist added to the
// registry after a show was saved must not retroactively relabel that
// show's setlist.fm setlist as coming from El Goose.
export function sourceLabel(sourceId) {
  if (sourceId && SETLIST_SOURCES[sourceId]) return SETLIST_SOURCES[sourceId].label;
  return FALLBACK.label;
}

export function sourceHomeUrl(sourceId) {
  if (sourceId && SETLIST_SOURCES[sourceId]) return SETLIST_SOURCES[sourceId].homeUrl;
  return FALLBACK.homeUrl;
}
