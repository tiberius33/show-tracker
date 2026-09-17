/**
 * The handle format rules exist twice — lib/handles.js for the inline
 * error under the field, and a CommonJS copy inside
 * netlify/functions/moderate-content.js which is the one that actually
 * decides. Same arrangement as contentFilterRule.js, and the same risk:
 * two copies drift, and the drift is invisible until someone claims a
 * handle the client rejected or the server lets through one it should
 * not.
 *
 * Unlike contentFilterRule.js the server copy is not generated (it lives
 * inside a handler that also does five other things), so this is the only
 * thing keeping them honest.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  HANDLE_MIN_LENGTH, HANDLE_MAX_LENGTH, RESERVED_HANDLES,
  normalizeHandle, handleFormatError,
} from '@/lib/handles';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

// The server copy is a plain function body inside a CommonJS handler, so
// it is read and evaluated rather than imported — requiring the handler
// would pull in firebase-admin and the whole Netlify runtime.
const source = fs.readFileSync(
  path.join(process.cwd(), 'netlify', 'functions', 'moderate-content.js'),
  'utf8',
);

function extract(name) {
  // From `function name(` to the first line that is a lone closing brace.
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `${name} not found in moderate-content.js`);
  const end = source.indexOf('\n}', start);
  assert.ok(end !== -1, `${name} has no closing brace in moderate-content.js`);
  return source.slice(start, end + 2);
}

const serverModule = new Function(`
  ${source.match(/const HANDLE_MIN_LENGTH = \d+;/)[0]}
  ${source.match(/const HANDLE_MAX_LENGTH = \d+;/)[0]}
  ${source.match(/const RESERVED_HANDLES = \[[\s\S]*?\];/)[0]}
  ${extract('normalizeHandle')}
  ${extract('handleFormatError')}
  return { HANDLE_MIN_LENGTH, HANDLE_MAX_LENGTH, RESERVED_HANDLES, normalizeHandle, handleFormatError };
`)();

console.log('\nhandle rules are identical on both sides');

test('the length bounds match', () => {
  assert.strictEqual(serverModule.HANDLE_MIN_LENGTH, HANDLE_MIN_LENGTH);
  assert.strictEqual(serverModule.HANDLE_MAX_LENGTH, HANDLE_MAX_LENGTH);
});

test('the reserved list matches exactly, including order', () => {
  assert.deepStrictEqual(serverModule.RESERVED_HANDLES, RESERVED_HANDLES);
});

test('both normalize the same way', () => {
  for (const raw of ['  Alice  ', 'BOB', 'c_3', '', null, undefined, 'MiXeD_Case_9']) {
    assert.strictEqual(
      serverModule.normalizeHandle(raw), normalizeHandle(raw),
      `normalizeHandle disagreed on ${JSON.stringify(raw)}`,
    );
  }
});

test('both accept and reject the same handles', () => {
  const cases = [
    'ab',                       // too short
    'a'.repeat(21),             // too long
    'has space', 'has-dash', 'HasUpper', 'has.dot', 'has@at',
    'admin', 'profile', 'u', 'terms', 'mysetlists',   // reserved
    'alice', 'bob_99', 'jordanmills', 'a_b_c', 'x'.repeat(20),
    '', '   ',
  ];
  for (const raw of cases) {
    assert.strictEqual(
      serverModule.handleFormatError(raw), handleFormatError(raw),
      `handleFormatError disagreed on ${JSON.stringify(raw)}`,
    );
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
