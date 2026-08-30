/**
 * Unit tests for lib/handles.js format validation and reserved-word list.
 * The Firestore-transaction claim path itself needs a real Firestore
 * connection and isn't covered here — see lib/__tests__/publicPages.test.js
 * for the privacy-critical logic that IS covered with a mocked Firestore.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/handles.test.js
 */

import assert from 'assert';
import { handleFormatError, RESERVED_HANDLES, normalizeHandle } from '@/lib/handles';

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

test('a valid handle passes format validation', () => {
  assert.strictEqual(handleFormatError('jane_doe22'), null);
});

test('too short is rejected', () => {
  assert.ok(handleFormatError('ab'));
});

test('too long is rejected', () => {
  assert.ok(handleFormatError('a'.repeat(21)));
});

test('mixed-case input is normalized rather than rejected (handles are case-insensitive)', () => {
  assert.strictEqual(handleFormatError('JaneDoe'), null);
});

test('symbols other than underscore are rejected', () => {
  assert.ok(handleFormatError('jane-doe'));
  assert.ok(handleFormatError('jane.doe'));
  assert.ok(handleFormatError('jane doe'));
});

test('every existing app route is on the reserved list', () => {
  const mustBeReserved = ['shows', 'stats', 'venues', 'songs', 'runs', 'wishlist', 'friends', 'profile', 'api', 'admin', 'settings', 'privacy', 'terms', 'cookies', 'shared', 'roadmap', 'support'];
  mustBeReserved.forEach(h => assert.ok(RESERVED_HANDLES.includes(h), `${h} should be reserved`));
});

test('impersonation-risk words are reserved', () => {
  assert.ok(RESERVED_HANDLES.includes('mysetlists'));
  assert.ok(RESERVED_HANDLES.includes('official'));
});

test('a reserved handle is rejected by format check even if otherwise valid', () => {
  assert.ok(handleFormatError('admin'));
});

test('normalizeHandle lowercases and trims', () => {
  assert.strictEqual(normalizeHandle('  JaneDoe  '), 'janedoe');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
