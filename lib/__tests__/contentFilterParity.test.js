/**
 * Parity test for the two copies of the content filter — the ESM module
 * the browser uses (lib/contentFilter.js) and the CommonJS module the
 * Netlify functions require (netlify/functions/lib/contentFilterRule.js).
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/contentFilterParity.test.js
 *
 * WHY THIS EXISTS. The filter has to answer the same question in two
 * places: in the browser, so a user gets an inline error rather than a
 * rejected write, and on the server, so the check cannot be skipped by
 * writing to Firestore directly. Two copies that disagree is the worst of
 * both — either the client refuses text the server would accept, or the
 * server refuses text the user was told was fine, after they wrote it.
 *
 * The same drift already bit this repo once: the bound that stops a
 * mistyped year absorbing unrelated festivals had to be applied by hand to
 * each inline copy of the festival match rule, and a copy that missed it
 * would have gone on mis-merging silently (see v5.31.0). That rule is now
 * guarded by lib/__tests__/festivalMatchParity.test.js; this is the same
 * guard for the same reason.
 *
 * Two things are checked:
 *   1. The generated file is not stale (the generator's --check mode).
 *   2. Both copies give identical answers over a grid of inputs, including
 *      every blocked term and every obfuscation the normalizer handles.
 */

import assert from 'assert';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import * as esm from '@/lib/contentFilter';

const require = createRequire(import.meta.url);
const cjs = require('../../netlify/functions/lib/contentFilterRule.js');

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

console.log('\nthe generated copy is current');

test('scripts/generate-content-filter-rule.js --check passes', () => {
  // If this fails, lib/contentFilter.js was edited without re-running the
  // generator. Fix: node scripts/generate-content-filter-rule.js
  execFileSync('node', ['scripts/generate-content-filter-rule.js', '--check'], { stdio: 'pipe' });
});

console.log('\nboth copies export the same surface');

test('the same names are exported from both', () => {
  const esmNames = Object.keys(esm).filter((k) => k !== 'default').sort();
  const cjsNames = Object.keys(cjs).sort();
  assert.deepStrictEqual(cjsNames, esmNames);
});

test('the wordlist and allowlist are identical', () => {
  assert.deepStrictEqual(cjs.BLOCKED_TERMS, esm.BLOCKED_TERMS);
  assert.deepStrictEqual(cjs.LINK_ALLOWLIST, esm.LINK_ALLOWLIST);
});

console.log('\nboth copies answer identically');

// The obfuscations the normalizer is supposed to see through. Applied to
// every blocked term, so adding a term to the list automatically extends
// this grid rather than needing its own case.
const OBFUSCATIONS = [
  (t) => t,
  (t) => t.toUpperCase(),
  (t) => t.split('').join('.'),
  (t) => t.split('').join(' '),
  (t) => t.replace(/o/g, '0').replace(/i/g, '1').replace(/e/g, '3').replace(/a/g, '@'),
  (t) => t.replace(/(.)/, '$1$1$1'),
  (t) => `a comment that says ${t} in the middle of it`,
  (t) => `${t}s`,
];

// Ordinary text the filter must leave alone, plus the spam shapes it must
// catch — so parity is checked on both answers, not just rejections.
const PLAIN_INPUTS = [
  '', '   ', 'great show', 'Cum On Feel the Noize', 'Ho Hey by the Lumineers',
  'saw Dick Dale at the Fillmore', 'Scunthorpe United', 'a classic set',
  'the assassin of the encore', 'bass solo', 'rated it 9.5 out of 10',
  '2026-09-04 was the best night', '9/4/2026 at Red Rocks',
  'caught them 1965 1966 1967 1968', 'call me 555 867 5309',
  '+44 20 7946 0958', 'bob@example.com', 'bob (at) example (dot) com',
  'https://setlist.fm/setlist/x', 'https://www.youtube.com/watch?v=abc',
  'scalper-deals.biz', 'http://totally-not-a-scam.example/win',
  'setlist.fm and youtu.be both fine',
];

test('identical answers over every term x every obfuscation', () => {
  let compared = 0;
  for (const term of esm.BLOCKED_TERMS) {
    for (const obfuscate of OBFUSCATIONS) {
      const input = obfuscate(term);
      assert.deepStrictEqual(
        cjs.checkContent(input), esm.checkContent(input),
        `disagreement on ${JSON.stringify(input)}`,
      );
      compared++;
    }
  }
  assert.ok(compared >= esm.BLOCKED_TERMS.length * OBFUSCATIONS.length,
    'fixture: the grid should cover every term');
  console.log(`    (${compared} cases compared)`);
});

test('identical answers on ordinary text and spam shapes', () => {
  for (const input of PLAIN_INPUTS) {
    assert.deepStrictEqual(
      cjs.checkContent(input), esm.checkContent(input),
      `disagreement on ${JSON.stringify(input)}`,
    );
  }
});

test('the individual detectors agree too, not just checkContent', () => {
  // checkContent short-circuits — profanity is answered before the link
  // check ever runs — so agreeing there does not prove the later
  // detectors agree. Compare them directly.
  for (const input of PLAIN_INPUTS) {
    assert.strictEqual(cjs.normalize(input), esm.normalize(input), `normalize: ${input}`);
    assert.strictEqual(cjs.findBlockedTerm(input), esm.findBlockedTerm(input), `findBlockedTerm: ${input}`);
    assert.strictEqual(cjs.findPhoneNumber(input), esm.findPhoneNumber(input), `findPhoneNumber: ${input}`);
    assert.strictEqual(cjs.findDisallowedLink(input), esm.findDisallowedLink(input), `findDisallowedLink: ${input}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
