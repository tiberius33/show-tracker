/**
 * Unit tests for lib/anniversaries.js.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/anniversaries.test.js
 */

import assert from 'assert';
import { nextOccurrence, buildUpcomingAnniversaries } from '@/lib/anniversaries';

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

test('next occurrence is this year when the month-day is still ahead', () => {
  assert.strictEqual(nextOccurrence('2019-12-25', '2024-06-01'), '2024-12-25');
});

test('next occurrence rolls to next year when the month-day already passed', () => {
  assert.strictEqual(nextOccurrence('2019-01-15', '2024-06-01'), '2025-01-15');
});

test("next occurrence is today's date when the month-day is today", () => {
  assert.strictEqual(nextOccurrence('2019-06-01', '2024-06-01'), '2024-06-01');
});

test('a show happening today has no anniversary yet (0 years is not upcoming)', () => {
  const shows = [{ id: 's1', date: '2024-06-01' }];
  const upcoming = buildUpcomingAnniversaries(shows, '2024-06-01');
  assert.strictEqual(upcoming.length, 0);
});

test('a past show produces one upcoming anniversary with correct years-ago', () => {
  const shows = [{ id: 's1', artist: 'Phish', date: '2019-07-15' }];
  const upcoming = buildUpcomingAnniversaries(shows, '2024-06-01');
  assert.strictEqual(upcoming.length, 1);
  assert.strictEqual(upcoming[0].occurrence, '2024-07-15');
  assert.strictEqual(upcoming[0].yearsAgo, 5);
});

test('results are sorted soonest-first', () => {
  const shows = [
    { id: 's1', date: '2019-12-25' },
    { id: 's2', date: '2019-06-10' },
  ];
  const upcoming = buildUpcomingAnniversaries(shows, '2024-06-01');
  assert.strictEqual(upcoming[0].show.id, 's2');
  assert.strictEqual(upcoming[1].show.id, 's1');
});

test('shows with no date are ignored', () => {
  const shows = [{ id: 's1' }];
  assert.strictEqual(buildUpcomingAnniversaries(shows, '2024-06-01').length, 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
