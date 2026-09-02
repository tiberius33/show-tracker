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
const {
  _toLineup: toLineup,
  _toIsoDate: toIsoDate,
  _toSetlistFmDate: toSetlistFmDate,
  _daysInWindow: daysInWindow,
  _cityFromLocation: cityFromLocation,
} = require('../../netlify/functions/search-festival-lineup.js');

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

// ── Day enumeration ──────────────────────────────────────────────────
// The lineup search queries setlist.fm one exact date at a time (it has no
// date-range parameter), so this list IS the search.

test('a multi-day festival enumerates every day inclusive', () => {
  assert.deepStrictEqual(
    daysInWindow('2025-05-23', '2025-05-25'),
    ['2025-05-23', '2025-05-24', '2025-05-25']
  );
});

test('a single-day festival is one day, not zero', () => {
  assert.deepStrictEqual(daysInWindow('2025-05-23', '2025-05-23'), ['2025-05-23']);
});

test('a festival spanning a month boundary enumerates across it', () => {
  assert.deepStrictEqual(
    daysInWindow('2025-05-30', '2025-06-02'),
    ['2025-05-30', '2025-05-31', '2025-06-01', '2025-06-02']
  );
});

test('a festival spanning a year boundary enumerates across it', () => {
  assert.deepStrictEqual(
    daysInWindow('2025-12-31', '2026-01-01'),
    ['2025-12-31', '2026-01-01']
  );
});

test('an absurd window is capped rather than fanning out unbounded', () => {
  assert.strictEqual(daysInWindow('2025-01-01', '2025-12-31').length, 10);
});

test('a missing or malformed start date yields no days', () => {
  assert.deepStrictEqual(daysInWindow('', '2025-05-25'), []);
  assert.deepStrictEqual(daysInWindow('not-a-date', '2025-05-25'), []);
});

test('an end date before the start yields no days', () => {
  assert.deepStrictEqual(daysInWindow('2025-05-25', '2025-05-23'), []);
});

test('a missing end date falls back to a single day', () => {
  assert.deepStrictEqual(daysInWindow('2025-05-23', ''), ['2025-05-23']);
});

test('dates are converted to the dd-MM-yyyy setlist.fm expects', () => {
  assert.strictEqual(toSetlistFmDate('2025-05-23'), '23-05-2025');
  assert.strictEqual(toSetlistFmDate(''), '');
});

// ── Location parsing ─────────────────────────────────────────────────

test('a city is taken from a "City, State" location', () => {
  assert.strictEqual(cityFromLocation('Napa, CA'), 'Napa');
  assert.strictEqual(cityFromLocation('Manchester, TN'), 'Manchester');
});

test('a bare city passes through, and a missing location is empty', () => {
  assert.strictEqual(cityFromLocation('Chicago'), 'Chicago');
  assert.strictEqual(cityFromLocation(''), '');
  assert.strictEqual(cityFromLocation(undefined), '');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
