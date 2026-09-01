/**
 * Unit tests for lib/festivalGrouping.js — stats/grouping for a festival's
 * attached shows.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/festivalGrouping.test.js
 */

import assert from 'assert';
import { buildFestivalStats } from '@/lib/festivalGrouping';

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

function show(id, date, artist, overrides = {}) {
  return { id, date, artist, venue: 'Great Stage Park', city: 'Manchester', setlist: [], ...overrides };
}

test('empty input produces zeroed stats, not a crash', () => {
  const stats = buildFestivalStats([]);
  assert.strictEqual(stats.showCount, 0);
  assert.strictEqual(stats.artistCount, 0);
  assert.strictEqual(stats.avgRating, null);
  assert.strictEqual(stats.dayCount, 0);
  assert.deepStrictEqual(stats.groupedByDay, []);
});

test('counts distinct artists, not distinct shows', () => {
  const shows = [
    show('s1', '2023-06-15', 'Foo Fighters'),
    show('s2', '2023-06-15', 'Foo Fighters'),
    show('s3', '2023-06-16', 'Billy Strings'),
  ];
  const stats = buildFestivalStats(shows);
  assert.strictEqual(stats.showCount, 3);
  assert.strictEqual(stats.artistCount, 2);
});

test('avgRating averages only rated shows', () => {
  const shows = [
    show('s1', '2023-06-15', 'A', { rating: 8 }),
    show('s2', '2023-06-16', 'B', { rating: 6 }),
    show('s3', '2023-06-17', 'C'), // unrated
  ];
  const stats = buildFestivalStats(shows);
  assert.strictEqual(stats.avgRating, 7);
});

test('groups two same-day shows into one day bucket', () => {
  const shows = [
    show('s1', '2023-06-15', 'Afternoon Act'),
    show('s2', '2023-06-15', 'Headliner'),
  ];
  const stats = buildFestivalStats(shows);
  assert.strictEqual(stats.dayCount, 1);
  assert.strictEqual(stats.groupedByDay[0].shows.length, 2);
});

test('groups correctly across a year boundary (Dec 30 - Jan 2)', () => {
  const shows = [
    show('s1', '2023-12-30', 'A'),
    show('s2', '2023-12-31', 'B'),
    show('s3', '2024-01-01', 'C'),
    show('s4', '2024-01-02', 'D'),
  ];
  const stats = buildFestivalStats(shows);
  assert.strictEqual(stats.dayCount, 4);
  assert.deepStrictEqual(
    stats.groupedByDay.map(d => d.date),
    ['2023-12-30', '2023-12-31', '2024-01-01', '2024-01-02']
  );
});

test('groupedByDay is sorted chronologically regardless of input order', () => {
  const shows = [
    show('s1', '2023-06-17', 'C'),
    show('s2', '2023-06-15', 'A'),
    show('s3', '2023-06-16', 'B'),
  ];
  const stats = buildFestivalStats(shows);
  assert.deepStrictEqual(
    stats.groupedByDay.map(d => d.date),
    ['2023-06-15', '2023-06-16', '2023-06-17']
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
