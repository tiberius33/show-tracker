/**
 * Unit tests for the pure grouping half of
 * netlify/functions/search-festival-lineup.js — turning a pile of
 * setlist.fm setlists at a venue into one selectable entry per artist/date.
 *
 * Run with:
 *   node lib/__tests__/festivalLineup.test.js
 *
 * Plain require (not the @/ alias loader) since the function is CommonJS,
 * matching how the other netlify functions are structured.
 */

const assert = require('assert');
const { _toLineup: toLineup, _toIsoDate: toIsoDate } = require('../../netlify/functions/search-festival-lineup.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

function setlist(id, artist, eventDate, songCount = 1, overrides = {}) {
  return {
    id,
    artist: { name: artist, mbid: `mbid-${artist}` },
    eventDate, // dd-MM-yyyy, as setlist.fm returns it
    venue: { name: 'Great Stage Park', city: { name: 'Manchester', country: { name: 'United States' } } },
    sets: { set: [{ song: Array.from({ length: songCount }, (_, i) => ({ name: `Song ${i + 1}` })) }] },
    ...overrides,
  };
}

test('setlist.fm dd-MM-yyyy dates are normalized to yyyy-MM-dd', () => {
  assert.strictEqual(toIsoDate('16-06-2023'), '2023-06-16');
});

test('a malformed date normalizes to an empty string rather than throwing', () => {
  assert.strictEqual(toIsoDate(''), '');
  assert.strictEqual(toIsoDate('2023'), '');
});

test('each distinct artist/date pair becomes one lineup entry', () => {
  const results = toLineup(
    [
      setlist('a', 'Phish', '16-06-2023'),
      setlist('b', 'Goose', '16-06-2023'),
      setlist('c', 'Phish', '17-06-2023'),
    ],
    {}
  );
  assert.strictEqual(results.length, 3);
});

test('two sets by the same artist on one day collapse, keeping the fuller setlist', () => {
  const results = toLineup(
    [setlist('short', 'Phish', '16-06-2023', 2), setlist('long', 'Phish', '16-06-2023', 12)],
    {}
  );
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].setlistfmId, 'long');
  assert.strictEqual(results[0].songCount, 12);
});

test('sets outside the festival date window are dropped', () => {
  const results = toLineup(
    [
      setlist('before', 'Phish', '01-06-2023'),
      setlist('during', 'Goose', '16-06-2023'),
      setlist('after', 'Dead', '30-06-2023'),
    ],
    { from: '2023-06-15', to: '2023-06-18' }
  );
  assert.deepStrictEqual(results.map(r => r.artist), ['Goose']);
});

test('results are ordered by date, then artist', () => {
  const results = toLineup(
    [
      setlist('a', 'Zeta', '17-06-2023'),
      setlist('b', 'Beta', '17-06-2023'),
      setlist('c', 'Omega', '16-06-2023'),
    ],
    {}
  );
  assert.deepStrictEqual(results.map(r => r.artist), ['Omega', 'Beta', 'Zeta']);
});

test('a setlist with no artist or no date is skipped, not returned half-built', () => {
  const results = toLineup(
    [
      { id: 'x', eventDate: '16-06-2023', venue: {} },
      { id: 'y', artist: { name: 'Phish' }, venue: {} },
      setlist('ok', 'Goose', '16-06-2023'),
    ],
    {}
  );
  assert.deepStrictEqual(results.map(r => r.artist), ['Goose']);
});

test('an artist with no songs logged still appears, with a zero song count', () => {
  const results = toLineup([setlist('a', 'Phish', '16-06-2023', 0, { sets: { set: [] } })], {});
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].songCount, 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
