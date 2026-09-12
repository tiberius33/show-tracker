/**
 * Unit tests for lib/bandSetlistMerge.js — the rules that let a setlist be
 * replaced from a band source without destroying anything the user put
 * there.
 *
 * This is the part of the band-source work most likely to go wrong and the
 * most expensive when it does: a user's ratings and hand-added songs live
 * inside the same array the source overwrites, and there is no undo. So the
 * cases below are deliberately about what must SURVIVE, not just about what
 * must change.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/bandSetlistMerge.test.js
 */

import assert from 'assert';
import { mergeBandSetlist, describeSummary, USER_OWNED_SONG_FIELDS } from '@/lib/bandSetlistMerge';
import { groupSongsBySet } from '@/lib/setlistGrouping';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`✗ ${name}\n  ${err.message}`);
  }
}

// A stored song, the way setlist.fm's extractSongsFromSetlist writes one.
function stored(name, set, extra = {}) {
  return { id: `old-${name.toLowerCase().replace(/\s+/g, '-')}`, name, set, cover: null, tape: false, ...extra };
}

// An incoming song, the way an adapter produces one.
function incoming(name, set, extra = {}) {
  return { id: `new-${name.toLowerCase().replace(/\s+/g, '-')}`, name, set, cover: null, tape: false, ...extra };
}

const titles = (songs) => songs.map(s => s.name);
const byName = (songs, name) => songs.find(s => s.name === name);

// ── The rule that matters most: never blank a setlist ─────────────────

test('an empty incoming setlist writes nothing and reports why', () => {
  const existing = [stored('Hot Tea', 'Set I'), stored('Arrow', 'Set I')];
  const { setlist, changed, summary } = mergeBandSetlist(existing, []);

  assert.strictEqual(changed, false, 'changed:false is the caller\'s cue not to touch the document');
  assert.strictEqual(setlist, existing, 'the existing array is handed straight back');
  assert.strictEqual(summary.skipped, 'empty-incoming');
  assert.strictEqual(summary.existingCount, 2);
  assert.strictEqual(summary.resultCount, 2);
});

test('a null or undefined incoming setlist is treated as empty, not a crash', () => {
  const existing = [stored('Hot Tea', 'Set I')];
  assert.strictEqual(mergeBandSetlist(existing, null).changed, false);
  assert.strictEqual(mergeBandSetlist(existing, undefined).changed, false);
  assert.strictEqual(mergeBandSetlist(existing).changed, false);
});

test('a failed fetch on a show with no setlist still writes nothing', () => {
  const { setlist, changed } = mergeBandSetlist([], []);
  assert.strictEqual(changed, false);
  assert.deepStrictEqual(setlist, []);
});

// ── Carrying over what the user authored ──────────────────────────────

test('a rating survives a re-fetch', () => {
  const existing = [stored('Hot Tea', 'Set I', { rating: 9 })];
  const { setlist, summary } = mergeBandSetlist(existing, [incoming('Hot Tea', 'Set I')]);

  assert.strictEqual(setlist[0].rating, 9);
  assert.strictEqual(summary.carriedOver.rating, 1);
});

test('a per-song comment survives a re-fetch', () => {
  const existing = [stored('Arrow', 'Set I', { comment: 'best version I have seen' })];
  const { setlist } = mergeBandSetlist(existing, [incoming('Arrow', 'Set I')]);
  assert.strictEqual(setlist[0].comment, 'best version I have seen');
});

test('every declared user-owned field survives, so the list is the contract', () => {
  const extras = { rating: 7, comment: 'note', manuallyAdded: true, tags: ['debut'] };
  const existing = [stored('Tumble', 'Set I', extras)];
  const { setlist } = mergeBandSetlist(existing, [incoming('Tumble', 'Set I')]);

  USER_OWNED_SONG_FIELDS.forEach((field) => {
    assert.deepStrictEqual(setlist[0][field], extras[field], `${field} must be carried over`);
  });
});

test('a rating of 0 is carried over — it is a rating, not an absence', () => {
  // The bug a truthy check would introduce: `if (old[field])` drops a 0.
  const existing = [stored('Madhuvan', 'Set I', { rating: 0 })];
  const { setlist } = mergeBandSetlist(existing, [incoming('Madhuvan', 'Set I')]);
  assert.strictEqual(setlist[0].rating, 0);
});

test('the source cannot overwrite a rating with its own value', () => {
  const existing = [stored('Hot Tea', 'Set I', { rating: 9 })];
  const { setlist } = mergeBandSetlist(existing, [incoming('Hot Tea', 'Set I', { rating: 2 })]);
  assert.strictEqual(setlist[0].rating, 9, 'the user wins on user-owned fields');
});

test('a matched song keeps its EXISTING id, which is identity downstream', () => {
  // groupSongsBySet, songIndex's per-song set lookup, and the editor's
  // reorder and rating controls all address songs by id.
  const existing = [stored('Hot Tea', 'Set I', { rating: 5 })];
  const { setlist } = mergeBandSetlist(existing, [incoming('Hot Tea', 'Set I')]);
  assert.strictEqual(setlist[0].id, 'old-hot-tea');
});

// ── Manually added songs ──────────────────────────────────────────────

test('a hand-added song the source does not have is KEPT, not deleted', () => {
  const existing = [
    stored('Hot Tea', 'Set I'),
    stored('A Song I Remember', 'Set I', { manuallyAdded: true, rating: 8 }),
  ];
  const { setlist, summary } = mergeBandSetlist(existing, [incoming('Hot Tea', 'Set I')]);

  assert.ok(titles(setlist).includes('A Song I Remember'), 'a user\'s song is never deleted because the source disagrees');
  assert.deepStrictEqual(summary.keptManual, ['A Song I Remember']);
  assert.deepStrictEqual(summary.removed, [], 'a kept manual song is not counted as removed');
  assert.strictEqual(byName(setlist, 'A Song I Remember').rating, 8);
});

test('a kept manual song stays in the set the user put it in', () => {
  const existing = [
    stored('Hot Tea', 'Set I'),
    stored('Tumble', 'Set II'),
    stored('My Encore Memory', 'Encore', { manuallyAdded: true }),
    stored('Mid Set Two', 'Set II', { manuallyAdded: true }),
  ];
  const incomingSongs = [
    incoming('Hot Tea', 'Set I'),
    incoming('Tumble', 'Set II'),
    incoming('Time to Flee', 'Encore'),
  ];

  const { setlist } = mergeBandSetlist(existing, incomingSongs);

  // Grouped the way the app will render it, which is the thing that has to
  // be right — not the raw array order.
  const groups = groupSongsBySet(setlist);
  const setTwo = groups.find(g => g.label === 'Set II');
  const encore = groups.find(g => g.label === 'Encore');

  assert.ok(titles(setTwo.songs).includes('Mid Set Two'), 'must land in Set II');
  assert.ok(titles(encore.songs).includes('My Encore Memory'), 'must land in the Encore');
  // Appended to the end of its section rather than interleaved.
  assert.strictEqual(setTwo.songs[setTwo.songs.length - 1].name, 'Mid Set Two');
});

test('a manual song in a set the source does not list at all is still kept', () => {
  const existing = [
    stored('Hot Tea', 'Set I'),
    stored('Imagined Encore', 'Encore II', { manuallyAdded: true }),
  ];
  const { setlist } = mergeBandSetlist(existing, [incoming('Hot Tea', 'Set I')]);
  assert.ok(titles(setlist).includes('Imagined Encore'));
  const groups = groupSongsBySet(setlist);
  assert.ok(groups.some(g => g.label === 'Encore II'));
});

test('the manuallyAdded flag is re-stamped so the "added by you" badge survives', () => {
  const existing = [stored('Hot Tea', 'Set I'), stored('Mine', 'Set I', { manuallyAdded: true })];
  const { setlist } = mergeBandSetlist(existing, [incoming('Hot Tea', 'Set I')]);
  assert.strictEqual(byName(setlist, 'Mine').manuallyAdded, true);
});

test('a song from a PREVIOUS source fetch that the source now omits is removed', () => {
  // The asymmetry is the point: user-authored songs are kept, stale source
  // data is not — otherwise a corrected setlist could never shrink.
  const existing = [stored('Hot Tea', 'Set I'), stored('Wrongly Listed', 'Set I')];
  const { setlist, summary } = mergeBandSetlist(existing, [incoming('Hot Tea', 'Set I')]);

  assert.deepStrictEqual(titles(setlist), ['Hot Tea']);
  assert.deepStrictEqual(summary.removed, ['Wrongly Listed']);
});

// ── Matching, and the diff summary it produces ────────────────────────

test('titles match through normalizeSongTitle, so punctuation and case differ freely', () => {
  const existing = [stored("Mike's Song", 'Set II', { rating: 10 })];
  const { setlist, summary } = mergeBandSetlist(existing, [incoming('Mikes Song', 'Set II')]);

  assert.strictEqual(setlist.length, 1, 'must not double up the same song under two spellings');
  assert.strictEqual(setlist[0].rating, 10);
  assert.deepStrictEqual(summary.added, []);
});

test('a song moved within its set is reported as moved, keeping its rating', () => {
  const existing = [stored('A', 'Set I'), stored('B', 'Set I', { rating: 6 })];
  const { setlist, summary } = mergeBandSetlist(existing, [incoming('B', 'Set I'), incoming('A', 'Set I')]);

  assert.deepStrictEqual(titles(setlist), ['B', 'A']);
  assert.strictEqual(byName(setlist, 'B').rating, 6);

  // Both songs moved, so both are reported — a swap is two position
  // changes, not one, and the dry run should say so.
  assert.strictEqual(summary.movedPosition.length, 2);
  assert.deepStrictEqual(
    summary.movedPosition.map(m => [m.title, m.from, m.to]).sort(),
    [['A', 1, 2], ['B', 2, 1]]
  );
  assert.deepStrictEqual(summary.movedSet, [], 'neither left Set I');
});

test('a song moved to a different set is reported with from and to', () => {
  const existing = [stored('Tumble', 'Set I', { rating: 4 })];
  const { setlist, summary } = mergeBandSetlist(existing, [incoming('Tumble', 'Set II')]);

  assert.strictEqual(setlist[0].set, 'Set II', 'the source decides the structure');
  assert.strictEqual(setlist[0].rating, 4, 'the user still keeps the rating');
  assert.deepStrictEqual(summary.movedSet, [{ title: 'Tumble', from: 'Set I', to: 'Set II' }]);
});

test('a song played twice in one show pairs up rather than collapsing', () => {
  const existing = [
    stored('Tweezer', 'Set II', { rating: 9 }),
    { ...stored('Tweezer', 'Encore'), id: 'old-tweezer-2', rating: 7 },
  ];
  const { setlist } = mergeBandSetlist(existing, [incoming('Tweezer', 'Set II'), incoming('Tweezer', 'Encore')]);

  assert.strictEqual(setlist.length, 2);
  assert.strictEqual(setlist[0].rating, 9);
  assert.strictEqual(setlist[1].rating, 7, 'each performance keeps its own rating');
});

test('a genuinely new song is reported as added', () => {
  const existing = [stored('Hot Tea', 'Set I')];
  const { setlist, summary } = mergeBandSetlist(existing, [incoming('Hot Tea', 'Set I'), incoming('Arrow', 'Set I')]);

  assert.deepStrictEqual(titles(setlist), ['Hot Tea', 'Arrow']);
  assert.deepStrictEqual(summary.added, ['Arrow']);
});

test('newly populated source fields are counted for the dry-run report', () => {
  const existing = [stored('Hot Tea', 'Set I')];
  const { summary } = mergeBandSetlist(existing, [
    incoming('Hot Tea', 'Set I', {
      transitionMark: '>', tape: true, footnote: 'teases', jamchart: true,
      jamchartNote: 'big one', sourceGap: 3, songId: 'x',
    }),
  ]);

  assert.strictEqual(summary.fieldsPopulated.transitionMark, 1);
  assert.strictEqual(summary.fieldsPopulated.footnote, 1);
  assert.strictEqual(summary.fieldsPopulated.jamchart, 1);
  assert.strictEqual(summary.fieldsPopulated.sourceGap, 1);
});

test('a field the show already had is not counted as newly populated', () => {
  const existing = [stored('Hot Tea', 'Set I', { footnote: 'already here' })];
  const { summary } = mergeBandSetlist(existing, [incoming('Hot Tea', 'Set I', { footnote: 'updated' })]);
  assert.strictEqual(summary.fieldsPopulated.footnote, undefined);
});

test('the source refreshes its own fields even though it cannot touch the user\'s', () => {
  const existing = [stored('Hot Tea', 'Set I', { footnote: 'old note', rating: 8 })];
  const { setlist } = mergeBandSetlist(existing, [incoming('Hot Tea', 'Set I', { footnote: 'corrected note' })]);

  assert.strictEqual(setlist[0].footnote, 'corrected note', 'corrections are the reason to re-fetch');
  assert.strictEqual(setlist[0].rating, 8);
});

test('tape and transitionMark come from the source, replacing a stale segue', () => {
  const existing = [stored('Hot Tea', 'Set I', { tape: true })];
  const { setlist } = mergeBandSetlist(existing, [incoming('Hot Tea', 'Set I', { tape: false })]);
  assert.strictEqual(setlist[0].tape, false);
});

test('a first fetch onto a show with no setlist adds everything', () => {
  const { setlist, changed, summary } = mergeBandSetlist([], [incoming('Hot Tea', 'Set I'), incoming('Arrow', 'Set I')]);
  assert.strictEqual(changed, true);
  assert.deepStrictEqual(titles(setlist), ['Hot Tea', 'Arrow']);
  assert.strictEqual(summary.added.length, 2);
  assert.strictEqual(summary.existingCount, 0);
  assert.strictEqual(summary.resultCount, 2);
});

test('a song with an empty title cannot match another empty title by accident', () => {
  const existing = [stored('', 'Set I', { rating: 5 })];
  const { setlist, summary } = mergeBandSetlist(existing, [incoming('', 'Set I')]);
  // Both normalize to '', which findMatch refuses to treat as a key — so
  // the incoming row is new and the blank existing row is dropped rather
  // than silently absorbing the rating of an unrelated song.
  assert.strictEqual(summary.added.length, 1);
  assert.strictEqual(setlist[0].rating, undefined);
});

// ── The summary rendering the dry run prints ──────────────────────────

test('describeSummary names the skip reason on an empty result', () => {
  const { summary } = mergeBandSetlist([stored('A', 'Set I')], []);
  assert.match(describeSummary(summary), /source returned no songs/);
});

test('describeSummary lists the counts a human needs to read a dry run', () => {
  const existing = [stored('A', 'Set I', { rating: 5 }), stored('Gone', 'Set I'), stored('Mine', 'Set I', { manuallyAdded: true })];
  const { summary } = mergeBandSetlist(existing, [incoming('A', 'Set I'), incoming('New', 'Set I', { footnote: 'x' })]);
  const line = describeSummary(summary);

  assert.match(line, /\+1 added/);
  assert.match(line, /-1 removed/);
  assert.match(line, /1 manual kept/);
  assert.match(line, /carried rating×1/);
  assert.match(line, /new footnote×1/);
});

test('describeSummary tolerates a missing summary', () => {
  assert.strictEqual(describeSummary(null), 'no summary');
});

// ── Summary ─────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
