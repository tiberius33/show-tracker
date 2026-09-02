/**
 * Unit tests for lib/tourBrowse.js — tour-name normalization, the
 * free-text `Artist Tour Name` parse, and the already-in-your-account
 * check that keeps bulk add from creating duplicates.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/tourBrowse.test.js
 */

import assert from 'assert';
import {
  normalizeTourName,
  isBrowsableTour,
  tourNamesMatch,
  tourOptionLabel,
  splitCandidates,
  exactArtistMatches,
  resolveTourQuery,
  buildExistingShowIndex,
  existingShowStatus,
  UNTAGGED_TOUR_NAME,
} from '@/lib/tourBrowse';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

const tour = (name, startDate, endDate = startDate) => ({ name, startDate, endDate, showCount: 1 });

console.log('\nlib/tourBrowse.js\n');

// ── normalizeTourName ─────────────────────────────────────────────────

test('normalizes casing and collapses whitespace', () => {
  assert.strictEqual(normalizeTourName('Summer  Tour   2025'), 'summer tour 2025');
  assert.strictEqual(normalizeTourName('SUMMER TOUR 2025'), 'summer tour 2025');
  assert.strictEqual(normalizeTourName('  Summer Tour 2025  '), 'summer tour 2025');
});

test('strips edge punctuation and normalizes smart quotes', () => {
  assert.strictEqual(normalizeTourName('"Summer Tour 2025"'), 'summer tour 2025');
  assert.strictEqual(normalizeTourName('Summer Tour 2025.'), 'summer tour 2025');
  assert.strictEqual(normalizeTourName('Rockin’ Tour'), normalizeTourName("Rockin' Tour"));
});

test('keeps the year — different years are different tours', () => {
  assert.notStrictEqual(normalizeTourName('Summer Tour 2024'), normalizeTourName('Summer Tour 2025'));
  assert.strictEqual(tourNamesMatch('Summer Tour 2024', 'Summer Tour 2025'), false);
});

test('tourNamesMatch is false for empty names rather than matching them together', () => {
  assert.strictEqual(tourNamesMatch('', ''), false);
  assert.strictEqual(tourNamesMatch(null, undefined), false);
});

// ── browsable tours ───────────────────────────────────────────────────

test('the untagged bucket is never browsable', () => {
  assert.strictEqual(isBrowsableTour({ name: UNTAGGED_TOUR_NAME }), false);
  assert.strictEqual(isBrowsableTour({ name: 'Summer Tour 2025', untagged: true }), false);
  assert.strictEqual(isBrowsableTour({ name: '   ' }), false);
  assert.strictEqual(isBrowsableTour({ name: 'Summer Tour 2025' }), true);
});

// ── tourOptionLabel ───────────────────────────────────────────────────

test('same tour name in two years is disambiguated by year', () => {
  const tours = [tour('Summer Tour', '2024-06-01'), tour('Summer Tour', '2025-06-01')];
  assert.strictEqual(tourOptionLabel(tours[0], tours), 'Summer Tour (2024)');
  assert.strictEqual(tourOptionLabel(tours[1], tours), 'Summer Tour (2025)');
});

test('a unique tour name is shown exactly as setlist.fm has it', () => {
  const tours = [tour('Summer Tour 2025', '2025-06-01'), tour('Fall Tour 2025', '2025-09-01')];
  assert.strictEqual(tourOptionLabel(tours[0], tours), 'Summer Tour 2025');
});

// ── splitCandidates ───────────────────────────────────────────────────

test('single-word input has no splits to try', () => {
  assert.deepStrictEqual(splitCandidates('Goose'), []);
  assert.deepStrictEqual(splitCandidates('   '), []);
});

test('splits longest-artist-first and caps the artist at three tokens', () => {
  const splits = splitCandidates('Goose Summer Tour 2025');
  assert.deepStrictEqual(splits, [
    { artistQuery: 'Goose Summer Tour', tourQuery: '2025' },
    { artistQuery: 'Goose Summer', tourQuery: 'Tour 2025' },
    { artistQuery: 'Goose', tourQuery: 'Summer Tour 2025' },
  ]);
});

test('never proposes a split with an empty tour half', () => {
  const splits = splitCandidates('My Morning Jacket');
  assert.ok(splits.every(s => s.tourQuery.length > 0));
  assert.strictEqual(splits[0].artistQuery, 'My Morning');
});

// ── exactArtistMatches ────────────────────────────────────────────────

test('only an exact name equality counts as a resolution', () => {
  const results = [
    { name: 'Goose', mbid: '1' },
    { name: 'Goose Creek Symphony', mbid: '2' },
    { name: 'goose', mbid: '3' },
  ];
  const matches = exactArtistMatches(results, 'Goose');
  assert.deepStrictEqual(matches.map(a => a.mbid), ['1', '3']);
});

test('an empty query matches nothing', () => {
  assert.deepStrictEqual(exactArtistMatches([{ name: '' }], ''), []);
});

// ── resolveTourQuery ──────────────────────────────────────────────────

test('resolves an exact tour name', () => {
  const tours = [tour('Summer Tour 2025', '2025-06-01'), tour('Fall Tour 2025', '2025-09-01')];
  assert.strictEqual(resolveTourQuery('summer tour 2025', tours).name, 'Summer Tour 2025');
});

test('resolves a unique prefix', () => {
  const tours = [tour('Summer Tour 2025', '2025-06-01'), tour('Fall Tour 2025', '2025-09-01')];
  assert.strictEqual(resolveTourQuery('Summer', tours).name, 'Summer Tour 2025');
});

test('refuses to guess when a prefix matches two tours', () => {
  const tours = [tour('Summer Tour 2024', '2024-06-01'), tour('Summer Tour 2025', '2025-06-01')];
  assert.strictEqual(resolveTourQuery('Summer Tour', tours), null);
});

test('refuses to guess when the same name exists in two years', () => {
  const tours = [tour('Summer Tour', '2024-06-01'), tour('Summer Tour', '2025-06-01')];
  assert.strictEqual(resolveTourQuery('Summer Tour', tours), null);
});

test('never resolves to the untagged bucket', () => {
  const tours = [{ name: UNTAGGED_TOUR_NAME, untagged: true, startDate: '2025-01-01' }];
  assert.strictEqual(resolveTourQuery('No Tour Listed', tours), null);
});

// ── already-added check ───────────────────────────────────────────────

const existing = [
  { artist: 'Goose', venue: "Dick's Sporting Goods Park", date: '2025-06-20', setlistfmId: 'abc123' },
  { artist: 'Goose', venue: 'Red Rocks Amphitheatre', date: '2025-06-21' }, // hand-added, no id
  { artist: 'Phish', venue: 'Madison Square Garden', date: '2024-12-31', setlistfmId: 'nye2024' },
];

test('matches on setlistfmId first', () => {
  const index = buildExistingShowIndex(existing);
  const status = existingShowStatus(index, {
    artist: 'Goose', venue: 'Somewhere Else Entirely', date: '2099-01-01', setlistfmId: 'abc123',
  });
  assert.strictEqual(status, 'added');
});

test('falls back to artist + date + fuzzy venue for hand-added shows', () => {
  const index = buildExistingShowIndex(existing);
  assert.strictEqual(
    existingShowStatus(index, { artist: 'Goose', venue: 'Red Rocks Amphitheatre', date: '2025-06-21' }),
    'added'
  );
  // Punctuation and a partial rename still count as the same venue.
  assert.strictEqual(
    existingShowStatus(index, { artist: 'goose', venue: 'Dicks Sporting Goods Park', date: '2025-06-20' }),
    'added'
  );
});

test('same artist and date at a genuinely different venue is flagged, not blocked', () => {
  const index = buildExistingShowIndex(existing);
  assert.strictEqual(
    existingShowStatus(index, { artist: 'Goose', venue: 'The Fillmore', date: '2025-06-21' }),
    'possible'
  );
});

test('a night the user does not have is new', () => {
  const index = buildExistingShowIndex(existing);
  assert.strictEqual(
    existingShowStatus(index, { artist: 'Goose', venue: 'The Capitol Theatre', date: '2025-07-04', setlistfmId: 'zzz' }),
    'new'
  );
});

test('a different artist on the same date is new', () => {
  const index = buildExistingShowIndex(existing);
  assert.strictEqual(
    existingShowStatus(index, { artist: 'Umphrey’s McGee', venue: 'Red Rocks Amphitheatre', date: '2025-06-21' }),
    'new'
  );
});

test('a blank venue on either side downgrades to possible rather than missing the collision', () => {
  const index = buildExistingShowIndex([{ artist: 'Goose', venue: '', date: '2025-06-22' }]);
  assert.strictEqual(
    existingShowStatus(index, { artist: 'Goose', venue: 'Red Rocks Amphitheatre', date: '2025-06-22' }),
    'possible'
  );
});

test('index and status handle empty/garbage input without throwing', () => {
  const index = buildExistingShowIndex([null, undefined, {}, { artist: 'X' }]);
  assert.strictEqual(existingShowStatus(index, null), 'new');
  assert.strictEqual(existingShowStatus(null, { artist: 'X', date: '2025-01-01' }), 'new');
  assert.strictEqual(existingShowStatus(index, { artist: '', date: '' }), 'new');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
