/**
 * Unit tests for lib/meetups.js's pure helper.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/meetups.test.js
 */

import assert from 'assert';
import { meetupIdFor } from '@/lib/meetups';

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

test('produces a Firestore-doc-id-safe string from a pipe-joined concertKey', () => {
  const id = meetupIdFor('phish|dick\'s sporting goods park|2023-07-15');
  assert.ok(!id.includes('/'), 'must not contain a slash');
  assert.ok(!id.includes('|'), 'must not contain a pipe');
  assert.strictEqual(id, 'phish_dick_s_sporting_goods_park_2023_07_15');
});

test('a slash in the artist name (e.g. "AC/DC") cannot break the doc id', () => {
  const id = meetupIdFor('ac/dc|msg|2023-07-15');
  assert.ok(!id.includes('/'));
});

test('is deterministic for the same concertKey', () => {
  const key = 'goose|radio city music hall|2023-11-01';
  assert.strictEqual(meetupIdFor(key), meetupIdFor(key));
});

test('a setlist.fm id concertKey passes through safely too', () => {
  const id = meetupIdFor('63d1a9b0');
  assert.strictEqual(id, '63d1a9b0');
});

test('an empty concertKey returns null rather than an empty doc id', () => {
  assert.strictEqual(meetupIdFor(''), null);
  assert.strictEqual(meetupIdFor(null), null);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
