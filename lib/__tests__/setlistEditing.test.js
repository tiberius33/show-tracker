/**
 * Unit tests for the setlist editor's destructive operation: removing a
 * song, and putting it back.
 *
 * The reason this has tests when the other editor helpers didn't: a song
 * carries the user's rating and comment, and nothing else in the app holds
 * a copy. Getting the removal wrong costs data that cannot be re-fetched —
 * an archive can supply the song again, never the 9/10 and the note that
 * said why. So the cases below are about what must SURVIVE a delete and an
 * undo, not just about the song disappearing.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/setlistEditing.test.js
 */

import assert from 'assert';
import { removeSongFromSetlist, insertSongAt, groupSongsBySet } from '@/lib/setlistGrouping';

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

const song = (id, name, set, extra = {}) => ({ id, name, set, ...extra });

const SETLIST = [
  song('s1', 'Hungersite', 'Set I'),
  song('s2', 'Arcadia', 'Set I', { rating: 9, comment: 'best ever' }),
  song('s3', 'Madhuvan', 'Set II'),
  song('s4', 'Arrow', 'Encore', { manuallyAdded: true }),
];

const names = (list) => list.map(s => s.name);

// ── Removing ──────────────────────────────────────────────────────────

test('removes the named song and leaves the rest in order', () => {
  const { setlist, removed, index } = removeSongFromSetlist(SETLIST, 's2');

  assert.deepStrictEqual(names(setlist), ['Hungersite', 'Madhuvan', 'Arrow']);
  assert.strictEqual(removed.name, 'Arcadia');
  assert.strictEqual(index, 1, 'the index is into the whole setlist, not into its set');
});

test('the removed song comes back whole, rating and comment included', () => {
  // This is what makes the undo worth having: the song object handed back
  // is the stored one, not a reconstruction from its title.
  const { removed } = removeSongFromSetlist(SETLIST, 's2');

  assert.strictEqual(removed.rating, 9);
  assert.strictEqual(removed.comment, 'best ever');
  assert.strictEqual(removed.id, 's2');
  assert.strictEqual(removed.set, 'Set I');
});

test('does not mutate the array it was given', () => {
  const original = [...SETLIST];
  removeSongFromSetlist(SETLIST, 's2');
  assert.deepStrictEqual(SETLIST, original);
});

test('an id that is not there removes nothing and says so', () => {
  // The caller treats a null `removed` as "do not write". A no-op save
  // would replace the whole array, which is how a stale view stamps an old
  // setlist over a newer one.
  const { setlist, removed, index } = removeSongFromSetlist(SETLIST, 'not-a-song');

  assert.strictEqual(removed, null);
  assert.strictEqual(index, -1);
  assert.strictEqual(setlist, SETLIST, 'the original array is handed straight back');
});

test('an empty, null or undefined setlist is handled, not thrown at', () => {
  [[], null, undefined].forEach((input) => {
    const { removed, index } = removeSongFromSetlist(input, 's1');
    assert.strictEqual(removed, null);
    assert.strictEqual(index, -1);
  });
});

test('removing every song in a set leaves the other sets intact', () => {
  const { setlist } = removeSongFromSetlist(SETLIST, 's3');
  const labels = groupSongsBySet(setlist).map(g => g.label);

  assert.ok(!labels.includes('Set II'), 'the emptied set is gone');
  assert.deepStrictEqual(labels, ['Set I', 'Encore']);
});

test('removing one song does not re-file its neighbours', () => {
  // groupSongsBySet infers structure from the `set` label and array order,
  // so a removal that round-tripped through grouping could move a song
  // across a set boundary. Every survivor must keep the set it had.
  const { setlist } = removeSongFromSetlist(SETLIST, 's2');

  setlist.forEach((s) => {
    const before = SETLIST.find(o => o.id === s.id);
    assert.strictEqual(s.set, before.set, `${s.name} kept its set`);
  });
});

// ── Putting it back ───────────────────────────────────────────────────

test('an undo restores the song at the position it came from', () => {
  const { setlist, removed, index } = removeSongFromSetlist(SETLIST, 's2');
  const restored = insertSongAt(setlist, removed, index);

  assert.deepStrictEqual(names(restored), names(SETLIST));
  assert.deepStrictEqual(restored, SETLIST, 'undoing a delete leaves no trace');
});

test('an undo restores the rating and the comment', () => {
  const { setlist, removed, index } = removeSongFromSetlist(SETLIST, 's2');
  const back = insertSongAt(setlist, removed, index).find(s => s.id === 's2');

  assert.strictEqual(back.rating, 9);
  assert.strictEqual(back.comment, 'best ever');
});

test('undoing the first and last songs works too', () => {
  ['s1', 's4'].forEach((id) => {
    const { setlist, removed, index } = removeSongFromSetlist(SETLIST, id);
    assert.deepStrictEqual(insertSongAt(setlist, removed, index), SETLIST, `${id} restored`);
  });
});

test('a hand-added song keeps its flag through a delete and an undo', () => {
  const { setlist, removed, index } = removeSongFromSetlist(SETLIST, 's4');
  const back = insertSongAt(setlist, removed, index).find(s => s.id === 's4');
  assert.strictEqual(back.manuallyAdded, true);
});

test('an index past the end appends rather than throwing', () => {
  // The setlist can shrink between the delete and the undo — a re-fetch,
  // another device. Landing at the end beats losing the song.
  const restored = insertSongAt([SETLIST[0]], SETLIST[3], 99);
  assert.deepStrictEqual(names(restored), ['Hungersite', 'Arrow']);
});

test('a negative index appends too, and no song is a no-op', () => {
  assert.deepStrictEqual(names(insertSongAt([SETLIST[0]], SETLIST[2], -3)), ['Hungersite', 'Madhuvan']);
  assert.deepStrictEqual(insertSongAt(SETLIST, null, 0), SETLIST);
});

test('insertSongAt does not mutate the array it was given', () => {
  const list = [SETLIST[0]];
  insertSongAt(list, SETLIST[1], 0);
  assert.strictEqual(list.length, 1);
});

// ── Summary ─────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
