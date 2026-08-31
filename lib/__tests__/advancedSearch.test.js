/**
 * Unit tests for lib/advancedSearch.js — advanced search filter matching.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/advancedSearch.test.js
 */

import assert from 'assert';
import { EMPTY_FILTERS, matchShow, filterShows, hasActiveFilters } from '@/lib/advancedSearch';

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

function show(overrides = {}) {
  return {
    id: 's1',
    artist: 'Phish',
    venue: "Dick's Sporting Goods Park",
    city: 'Commerce City',
    country: 'USA',
    date: '2023-07-15',
    rating: 8,
    comment: 'Great second set',
    taggedFriendUids: ['friend-1'],
    setlist: [{ name: 'Tweezer' }, { name: 'Wilson' }],
    ...overrides,
  };
}

test('hasActiveFilters is false for the empty filter set', () => {
  assert.strictEqual(hasActiveFilters(EMPTY_FILTERS), false);
});

test('hasActiveFilters is true once any field is set', () => {
  assert.strictEqual(hasActiveFilters({ ...EMPTY_FILTERS, artist: 'Phish' }), true);
  assert.strictEqual(hasActiveFilters({ ...EMPTY_FILTERS, minRating: 5 }), true);
});

test('artist filter matches case-insensitive substring', () => {
  const { matches, matchedFields } = matchShow(show(), { ...EMPTY_FILTERS, artist: 'phi' });
  assert.strictEqual(matches, true);
  assert.deepStrictEqual(matchedFields, ['artist']);
});

test('artist filter excludes non-matching shows', () => {
  const { matches } = matchShow(show(), { ...EMPTY_FILTERS, artist: 'Goose' });
  assert.strictEqual(matches, false);
});

test('date range is inclusive on both ends', () => {
  const s = show({ date: '2023-07-15' });
  assert.strictEqual(matchShow(s, { ...EMPTY_FILTERS, dateFrom: '2023-07-15', dateTo: '2023-07-15' }).matches, true);
  assert.strictEqual(matchShow(s, { ...EMPTY_FILTERS, dateFrom: '2023-07-16' }).matches, false);
  assert.strictEqual(matchShow(s, { ...EMPTY_FILTERS, dateTo: '2023-07-14' }).matches, false);
});

test('minimum rating excludes lower-rated and unrated shows', () => {
  assert.strictEqual(matchShow(show({ rating: 7 }), { ...EMPTY_FILTERS, minRating: 8 }).matches, false);
  assert.strictEqual(matchShow(show({ rating: 9 }), { ...EMPTY_FILTERS, minRating: 8 }).matches, true);
  assert.strictEqual(matchShow(show({ rating: null }), { ...EMPTY_FILTERS, minRating: 1 }).matches, false);
});

test('notes filter searches the comment field and reports as matched', () => {
  const { matches, matchedFields } = matchShow(show({ comment: 'Best show ever' }), { ...EMPTY_FILTERS, notes: 'best show' });
  assert.strictEqual(matches, true);
  assert.ok(matchedFields.includes('notes'));
});

test('song filter matches any song in the setlist', () => {
  assert.strictEqual(matchShow(show(), { ...EMPTY_FILTERS, song: 'tweezer' }).matches, true);
  assert.strictEqual(matchShow(show(), { ...EMPTY_FILTERS, song: 'Ghost' }).matches, false);
});

test('friend filter matches tagged friend uid', () => {
  assert.strictEqual(matchShow(show(), { ...EMPTY_FILTERS, friendUid: 'friend-1' }).matches, true);
  assert.strictEqual(matchShow(show(), { ...EMPTY_FILTERS, friendUid: 'friend-2' }).matches, false);
});

test('tour filter uses the provided showId set, not raw text matching', () => {
  const s = show({ id: 'abc' });
  const matchedContext = { tourShowIds: new Set(['abc']) };
  const missContext = { tourShowIds: new Set(['other']) };
  assert.strictEqual(matchShow(s, { ...EMPTY_FILTERS, tourKey: 'some-tour' }, matchedContext).matches, true);
  assert.strictEqual(matchShow(s, { ...EMPTY_FILTERS, tourKey: 'some-tour' }, missContext).matches, false);
});

test('multiple filters combine with AND', () => {
  const s = show({ artist: 'Phish', rating: 9 });
  assert.strictEqual(matchShow(s, { ...EMPTY_FILTERS, artist: 'Phish', minRating: 9 }).matches, true);
  assert.strictEqual(matchShow(s, { ...EMPTY_FILTERS, artist: 'Phish', minRating: 10 }).matches, false);
});

test('filterShows returns only matching shows with their matchedFields', () => {
  const shows = [show({ id: 's1', artist: 'Phish' }), show({ id: 's2', artist: 'Goose' })];
  const results = filterShows(shows, { ...EMPTY_FILTERS, artist: 'Phish' });
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].show.id, 's1');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
