/**
 * Unit tests for lib/contentFilter.js — the pre-publication gate for
 * App Store Guideline 1.2.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/contentFilter.test.js
 *
 * The false-positive half of this file matters more than the true-positive
 * half. Rejecting "fuck" is easy; the ways a filter goes wrong are
 * Scunthorpe, Slade song titles and show dates read as phone numbers, and
 * every one of those is a legitimate post refused for no reason.
 */

import assert from 'assert';
import {
  checkContent, contentProblem, normalize, deObfuscate,
  findBlockedTerm, findPhoneNumber, findDisallowedLink,
  BLOCKED_TERMS, LINK_ALLOWLIST,
} from '@/lib/contentFilter';

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

function blocked(text, code) {
  const result = checkContent(text);
  assert.strictEqual(result.ok, false, `expected ${JSON.stringify(text)} to be rejected`);
  if (code) assert.strictEqual(result.code, code, `expected code ${code}, got ${result.code}`);
  assert.ok(result.message, 'a rejection must carry a message for the inline error');
}

function allowed(text) {
  const result = checkContent(text);
  assert.strictEqual(result.ok, true,
    `expected ${JSON.stringify(text)} to be allowed, got ${result.code} (${result.term || ''})`);
}

console.log('\nnormalization');

test('strips diacritics so an accented spelling reaches the plain entry', () => {
  assert.strictEqual(normalize('fück'), 'fuck');
  assert.strictEqual(normalize('FÜCK'), 'fuck');
});

test('expands leet substitutions', () => {
  assert.strictEqual(normalize('sh1t'), 'shit');
  assert.strictEqual(normalize('@sshole'), 'ashole');
});

test('collapses repeated characters on both sides of the match', () => {
  // The collapse is only safe because the wordlist gets it too: "ass"
  // normalizes to "as", and so does "aaasss".
  assert.strictEqual(normalize('fuuuuck'), 'fuck');
  assert.strictEqual(normalize('aaasss'), 'as');
  assert.strictEqual(normalize('ass'), 'as');
});

test('punctuation becomes a separator', () => {
  assert.strictEqual(normalize('f.u.c.k'), 'f u c k');
});

test('deObfuscate rejoins three or more single letters but not two', () => {
  assert.strictEqual(deObfuscate('f u c k'), 'fuck');
  assert.strictEqual(deObfuscate('a b'), 'a b');
});

console.log('\nblocked terms');

test('catches a plain term', () => blocked('what the fuck was that', 'profanity'));
test('catches a stretched term', () => blocked('fuuuuuck', 'profanity'));
test('catches a leet term', () => blocked('total sh1t show', 'profanity'));
test('catches an accented term', () => blocked('fück this', 'profanity'));
test('catches a spaced term', () => blocked('f u c k', 'profanity'));
test('catches a punctuated term', () => blocked('f.u.c.k.', 'profanity'));

test('catches inflected forms without listing each one', () => {
  assert.ok(!BLOCKED_TERMS.includes('fucking'), 'fixture: the suffix rule is what should catch this');
  blocked('fucking terrible', 'profanity');
  blocked('what a bitchy set', 'profanity');
});

test('reports which term matched, for the admin queue', () => {
  assert.strictEqual(findBlockedTerm('what the fuck'), 'fuck');
  assert.strictEqual(findBlockedTerm('lovely evening'), '');
});

console.log('\nfalse positives — the half that actually matters');

test('Scunthorpe and friends are not profanity', () => {
  // Substring matching is what makes a filter reject these; this list is
  // the regression test for ever switching back to it.
  allowed('Scunthorpe United');
  allowed('a classic set');
  allowed('the assassin of the encore');
  allowed('Dickinson was on fire');
  allowed('bass solo into cocktail hour');
});

test('real song and artist names survive', () => {
  // Every one of these was rejected by the first draft of the wordlist.
  allowed('Cum On Feel the Noize');
  allowed('Ho Hey by the Lumineers');
  allowed('saw Dick Dale at the Fillmore');
  allowed('David Lynch introduced the band');
  allowed('Piss Up A Rope was the closer');
});

test('a show date is not a phone number', () => {
  allowed('2026-09-04 was the best night of the tour');
  allowed('9/4/2026 at Red Rocks');
  allowed('caught them 1965 1966 1967 1968, every year');
});

test('setlist sources stay linkable', () => {
  LINK_ALLOWLIST.forEach((domain) => {
    allowed(`full setlist at https://${domain}/whatever`);
  });
  allowed('https://www.youtube.com/watch?v=abc123');
});

console.log('\ncontact-harvesting spam');

test('rejects an email address', () => {
  blocked('hit me up at bob@example.com', 'email');
  blocked('bob (at) example (dot) com', 'email');
});

test('rejects a phone number', () => {
  blocked('call me 555 867 5309', 'phone');
  blocked('+44 20 7946 0958', 'phone');
  assert.strictEqual(findPhoneNumber('555-867-5309'), '555-867-5309');
});

test('rejects a link outside the allowlist', () => {
  blocked('cheap tickets at scalper-deals.biz', 'link');
  blocked('http://totally-not-a-scam.example/win', 'link');
  assert.strictEqual(findDisallowedLink('see setlist.fm/x'), '');
});

test('a decimal or a date is not a domain', () => {
  assert.strictEqual(findDisallowedLink('rated it 9.5 out of 10'), '');
  assert.strictEqual(findDisallowedLink('on 2026.09.04'), '');
});

console.log('\ncall-site contract');

test('empty and whitespace-only text is allowed, not rejected', () => {
  // Callers guard emptiness themselves (a Post button is disabled on an
  // empty box); the filter must not turn "nothing typed yet" into an error.
  allowed('');
  allowed('   ');
  allowed(null);
  allowed(undefined);
});

test('contentProblem returns the inline error string, or empty', () => {
  assert.strictEqual(contentProblem('great show'), '');
  assert.ok(contentProblem('what the fuck').length > 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
