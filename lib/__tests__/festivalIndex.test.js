/**
 * Unit tests for lib/festivalIndex.js — festival grouping.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/festivalIndex.test.js
 */

import assert from 'assert';
import { buildFestivalIndex } from '@/lib/festivalIndex';

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

function show(id, date, artist, venue, overrides = {}) {
  return { id, date, artist, venue, city: 'City', setlist: [], ...overrides };
}

test('two different artists sharing a tour name form one festival', () => {
  const shows = [
    show('s1', '2023-06-15', 'Foo Fighters', 'Great Stage Park', { tour: 'Bonnaroo 2023' }),
    show('s2', '2023-06-16', 'Billy Strings', 'Great Stage Park', { tour: 'Bonnaroo 2023' }),
  ];
  const festivals = Object.values(buildFestivalIndex(shows));
  assert.strictEqual(festivals.length, 1);
  assert.strictEqual(festivals[0].artistCount, 2);
  assert.strictEqual(festivals[0].showCount, 2);
});

test('a single artist with a tour name is NOT treated as a festival', () => {
  const shows = [
    show('s1', '2023-06-15', 'Phish', 'MSG', { tour: 'Summer Tour 2023' }),
    show('s2', '2023-06-16', 'Phish', 'MSG', { tour: 'Summer Tour 2023' }),
  ];
  const festivals = Object.values(buildFestivalIndex(shows));
  assert.strictEqual(festivals.length, 0);
});

test('shows with no tour name are ignored', () => {
  const shows = [
    show('s1', '2023-06-15', 'Foo Fighters', 'Great Stage Park'),
    show('s2', '2023-06-16', 'Billy Strings', 'Great Stage Park'),
  ];
  const festivals = Object.values(buildFestivalIndex(shows));
  assert.strictEqual(festivals.length, 0);
});

test('festival date range spans first to last day', () => {
  const shows = [
    show('s1', '2023-06-16', 'Billy Strings', 'Great Stage Park', { tour: 'Bonnaroo 2023' }),
    show('s2', '2023-06-15', 'Foo Fighters', 'Great Stage Park', { tour: 'Bonnaroo 2023' }),
  ];
  const festival = Object.values(buildFestivalIndex(shows))[0];
  assert.strictEqual(festival.dateRange.start, '2023-06-15');
  assert.strictEqual(festival.dateRange.end, '2023-06-16');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
