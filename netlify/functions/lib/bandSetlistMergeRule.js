/**
 * bandSetlistMergeRule — replacing a setlist from a band source without
 * ever destroying what the user put there, in CommonJS, for Netlify
 * functions.
 *
 * WHY THIS FILE EXISTS. Same arrangement as
 * netlify/functions/lib/festivalMatchRule.js and its ESM twin: the rule has
 * to run in two places. Client-side it runs in AppContext when a show is
 * added or re-scanned (lib/bandSetlistMerge.js, ESM, written against the
 * `@/lib` alias); server-side it runs in admin-resync-setlists.js under
 * firebase-admin, which is CommonJS with no build step to resolve that
 * alias. lib/__tests__/bandSetlistMergeParity.test.js asserts the two agree
 * on every case, so they cannot drift silently.
 *
 * ── The invariant ─────────────────────────────────────────────────────
 *
 * A show's setlist array is not purely source data. The user owns part of
 * it: per-song `rating` and `comment`, songs they added by hand that the
 * source has never heard of, and set/order edits from the setlist editor.
 * A re-fetch that discarded any of that would be worse than not re-fetching
 * at all, because the user would have no way to know it happened and no way
 * to get it back.
 *
 * So this merge is conservative in one specific direction: the incoming
 * setlist decides what songs were played and in what structure, and the
 * existing setlist decides everything the user authored about them. And
 * when the incoming setlist is empty or the fetch failed, the existing
 * setlist wins outright — nothing is written. A failed fetch must never
 * blank a setlist, which is also what makes the name-match heuristic in
 * lib/setlistSources.js survivable: ask elgoose.net for a Dutch-Goose date
 * and it returns nothing, and nothing is what gets written.
 *
 * ── Matching ──────────────────────────────────────────────────────────
 *
 * Existing songs are matched to incoming songs on normalized title (the
 * app's one normalizeSongTitle, mirrored below for CJS), in three passes
 * from most to least specific:
 *
 *   1. title + set + position  – unchanged, the common case
 *   2. title + set             – moved within its set
 *   3. title                   – moved to a different set
 *
 * Each existing song is consumed at most once, so a show that plays the
 * same song twice pairs them up in order rather than collapsing them. Which
 * pass matched is what produces the "moved" counts in the diff summary —
 * the dry run's output is built from exactly this.
 */

// ── normalizeSongTitle, mirrored from lib/utils.js ────────────────────
// Kept character-for-character identical to the ESM original, including the
// "/" -> space rule that collapses "Ashes//Dust" and "Ashes // Dust" onto
// one key. The parity test compares against the real one.
function normalizeSongTitle(title) {
  if (!title) return '';
  return String(title)
    .toLowerCase()
    .replace(/[-–—]\s*(live|remaster(ed)?( \d{4})?|mono|stereo|single|album)( version)?\s*$/i, '')
    .replace(/\(\s*(live|remaster(ed)?( \d{4})?|mono|stereo|single|album)( version)?\s*\)\s*$/i, '')
    .replace(/\//g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Per-song fields the USER owns. These are carried from the existing song
// onto its incoming replacement; nothing the source says can overwrite
// them. `manuallyAdded` is here because a song the user added by hand stays
// flagged as theirs even in the unlikely event the source later agrees it
// was played.
const USER_OWNED_SONG_FIELDS = ['rating', 'comment', 'manuallyAdded', 'tags'];

// Fields a band source populates. Used only for the diff summary's "fields
// newly populated" line — the merge itself takes whatever the adapter
// produced.
const SOURCE_SONG_FIELDS = [
  'transitionMark', 'footnote', 'jamchart', 'jamchartNote',
  'sourceGap', 'debut', 'songId', 'songSlug', 'sourceOpener',
];

function positionsWithinSets(songs) {
  // Position within a set, derived rather than read off the song, because a
  // stored song carries no position field — groupSongsBySet infers
  // structure from the `set` label and array order, and so does this.
  const counters = new Map();
  return songs.map((song) => {
    const set = song.set || '';
    const next = (counters.get(set) || 0) + 1;
    counters.set(set, next);
    return { song, set, position: next, key: normalizeSongTitle(song.name) };
  });
}

/**
 * mergeBandSetlist(existingSetlist, incomingSongs) -> {
 *   setlist, changed, summary
 * }
 *
 * `setlist` is the array to write. `changed` is false when there is nothing
 * worth writing — which happens when the incoming setlist is empty, and is
 * the caller's cue to leave the document alone entirely.
 *
 * `summary` is the per-show change report. On the Change 4 backfill's dry
 * run this IS the output, so it is shaped to be read by a human:
 *
 *   { existingCount, incomingCount, resultCount,
 *     added: [titles], removed: [titles],
 *     movedSet: [{ title, from, to }],
 *     movedPosition: [{ title, set, from, to }],
 *     fieldsPopulated: { transitionMark: n, footnote: n, ... },
 *     carriedOver: { rating: n, comment: n, ... },
 *     keptManual: [titles],
 *     skipped: null | 'empty-incoming',
 *   }
 */
function mergeBandSetlist(existingSetlist, incomingSongs) {
  const existing = Array.isArray(existingSetlist) ? existingSetlist : [];
  const incoming = Array.isArray(incomingSongs) ? incomingSongs : [];

  const emptySummary = () => ({
    existingCount: existing.length,
    incomingCount: incoming.length,
    resultCount: existing.length,
    added: [],
    removed: [],
    movedSet: [],
    movedPosition: [],
    fieldsPopulated: {},
    carriedOver: {},
    keptManual: [],
    skipped: null,
  });

  // Rule 1, and the one that matters most: an empty incoming setlist writes
  // nothing. The caller treats `changed: false` as "do not touch the
  // document", so a source with no data for this date, a bad date, or an
  // artist-name false positive all come out the same safe way.
  if (incoming.length === 0) {
    const summary = emptySummary();
    summary.skipped = 'empty-incoming';
    return { setlist: existing, changed: false, summary };
  }

  const existingIndexed = positionsWithinSets(existing);
  const incomingIndexed = positionsWithinSets(incoming);

  const consumed = new Set();
  const summary = emptySummary();

  const findMatch = (target) => {
    // Pass 1: same title, same set, same position.
    for (let i = 0; i < existingIndexed.length; i++) {
      if (consumed.has(i)) continue;
      const e = existingIndexed[i];
      if (e.key && e.key === target.key && e.set === target.set && e.position === target.position) {
        return { index: i, entry: e, kind: 'exact' };
      }
    }
    // Pass 2: same title, same set, different position.
    for (let i = 0; i < existingIndexed.length; i++) {
      if (consumed.has(i)) continue;
      const e = existingIndexed[i];
      if (e.key && e.key === target.key && e.set === target.set) {
        return { index: i, entry: e, kind: 'moved-position' };
      }
    }
    // Pass 3: same title, anywhere.
    for (let i = 0; i < existingIndexed.length; i++) {
      if (consumed.has(i)) continue;
      const e = existingIndexed[i];
      if (e.key && e.key === target.key) {
        return { index: i, entry: e, kind: 'moved-set' };
      }
    }
    return null;
  };

  const bump = (bucket, field) => {
    summary[bucket][field] = (summary[bucket][field] || 0) + 1;
  };

  const merged = incomingIndexed.map((target) => {
    const match = findMatch(target);

    if (!match) {
      summary.added.push(target.song.name);
      SOURCE_SONG_FIELDS.forEach((f) => {
        if (target.song[f] != null && target.song[f] !== false) bump('fieldsPopulated', f);
      });
      return { ...target.song };
    }

    consumed.add(match.index);
    const old = match.entry.song;

    if (match.kind === 'moved-set') {
      summary.movedSet.push({ title: target.song.name, from: match.entry.set, to: target.set });
    } else if (match.kind === 'moved-position') {
      summary.movedPosition.push({
        title: target.song.name,
        set: target.set,
        from: match.entry.position,
        to: target.position,
      });
    }

    // Keep the EXISTING song's id. The id is identity everywhere
    // downstream — groupSongsBySet keys off it, songIndex's per-song set
    // lookup keys off it, and the setlist editor's reorder and rating
    // controls address songs by it. Minting a fresh id for a song that is
    // demonstrably the same performance would invalidate all of that for no
    // gain.
    const next = { ...target.song, id: old.id || target.song.id };

    USER_OWNED_SONG_FIELDS.forEach((field) => {
      if (old[field] != null) {
        next[field] = old[field];
        bump('carriedOver', field);
      }
    });

    SOURCE_SONG_FIELDS.forEach((f) => {
      const had = old[f] != null && old[f] !== false;
      const has = next[f] != null && next[f] !== false;
      if (!had && has) bump('fieldsPopulated', f);
    });

    return next;
  });

  // ── What the source didn't account for ──────────────────────────────
  // Every existing song left unconsumed. A song the user added by hand is
  // KEPT — the source disagreeing is not grounds for deleting a user's
  // work — appended to the end of whichever set it was in. Anything else
  // unconsumed came from a previous source fetch and the current source
  // says it wasn't played, so it goes.
  const leftovers = existingIndexed.filter((_, i) => !consumed.has(i));

  const keptManual = [];
  leftovers.forEach((e) => {
    if (e.song.manuallyAdded) {
      keptManual.push(e.song.name);
    } else {
      summary.removed.push(e.song.name);
    }
  });

  let result = merged;

  if (keptManual.length > 0) {
    // Insert each kept manual song after the last song of its own set, so
    // it stays in the section the user put it in rather than being dumped
    // at the end of the show. A set the incoming setlist doesn't have at
    // all (the user invented an "Encore II" the source doesn't list) keeps
    // its songs as a trailing group; groupSongsBySet handles a label it has
    // never seen by placing it after the canonical ones.
    const out = [];
    const manualBySet = new Map();
    leftovers
      .filter((e) => e.song.manuallyAdded)
      .forEach((e) => {
        const set = e.song.set || '';
        if (!manualBySet.has(set)) manualBySet.set(set, []);
        // `manuallyAdded` is already true; re-stamped so the flag survives
        // even if a stored song somehow lost it, since it is what the UI's
        // "added by you" badge and this rule both key off.
        manualBySet.get(set).push({ ...e.song, manuallyAdded: true });
      });

    for (let i = 0; i < merged.length; i++) {
      out.push(merged[i]);
      const thisSet = merged[i].set || '';
      const nextSet = i + 1 < merged.length ? (merged[i + 1].set || '') : null;
      if (thisSet !== nextSet && manualBySet.has(thisSet)) {
        out.push(...manualBySet.get(thisSet));
        manualBySet.delete(thisSet);
      }
    }
    // Sets the incoming setlist has no songs for at all.
    manualBySet.forEach((songs) => out.push(...songs));

    result = out;
  }

  summary.keptManual = keptManual;
  summary.resultCount = result.length;

  return { setlist: result, changed: true, summary };
}

/**
 * A one-line rendering of a summary, for the dry run's log output and the
 * per-show console line on a real run.
 */
function describeSummary(summary) {
  if (!summary) return 'no summary';
  if (summary.skipped === 'empty-incoming') {
    return `skipped — source returned no songs (kept existing ${summary.existingCount})`;
  }
  const parts = [`${summary.existingCount} → ${summary.resultCount} songs`];
  if (summary.added.length) parts.push(`+${summary.added.length} added`);
  if (summary.removed.length) parts.push(`-${summary.removed.length} removed`);
  if (summary.movedSet.length) parts.push(`${summary.movedSet.length} changed set`);
  if (summary.movedPosition.length) parts.push(`${summary.movedPosition.length} moved`);
  if (summary.keptManual.length) parts.push(`${summary.keptManual.length} manual kept`);

  const carried = Object.entries(summary.carriedOver).map(([k, n]) => `${k}×${n}`);
  if (carried.length) parts.push(`carried ${carried.join(' ')}`);

  const populated = Object.entries(summary.fieldsPopulated).map(([k, n]) => `${k}×${n}`);
  if (populated.length) parts.push(`new ${populated.join(' ')}`);

  return parts.join(', ');
}

module.exports = {
  SOURCE_SONG_FIELDS,
  USER_OWNED_SONG_FIELDS,
  describeSummary,
  mergeBandSetlist,
  normalizeSongTitle,
};
