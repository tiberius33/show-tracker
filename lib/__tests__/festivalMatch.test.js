/**
 * Unit tests for lib/festivalMatch.js — the shared-festival match rule.
 *
 * The case this file exists to protect: Bonnaroo 2025 and Bonnaroo 2026
 * have identical names and must never match each other.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/festivalMatch.test.js
 */

import assert from 'assert';
import {
  normalizeFestivalName,
  nameSimilarity,
  namesAreClose,
  datesAreClose,
  normalizeLocation,
  locationsAgree,
  festivalsMatch,
  findFestivalMatches,
  MAX_START_DATE_GAP_DAYS,
} from '@/lib/festivalMatch';

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

const fest = (name, startDate, endDate, location = '') => ({ name, startDate, endDate, location });

console.log('\nlib/festivalMatch.js\n');

// ── Normalization ─────────────────────────────────────────────────────

test('lowercases, strips punctuation and collapses whitespace', () => {
  assert.strictEqual(normalizeFestivalName('  Bonnaroo!!  Music   Festival '), 'bonnaroo music festival');
});

test('strips a leading article', () => {
  assert.strictEqual(normalizeFestivalName('The Bonnaroo'), 'bonnaroo');
  assert.strictEqual(normalizeFestivalName('A Perfect Weekend'), 'perfect weekend');
});

test('strips a trailing year but keeps a leading one', () => {
  assert.strictEqual(normalizeFestivalName('Bonnaroo 2026'), 'bonnaroo');
  assert.strictEqual(normalizeFestivalName('1964 Revival'), '1964 revival');
});

test('expands & so "Music & Arts" and "Music and Arts" agree', () => {
  assert.strictEqual(normalizeFestivalName('Music & Arts'), normalizeFestivalName('Music and Arts'));
});

// ── Name closeness ────────────────────────────────────────────────────

test('a short name is contained by its long form', () => {
  assert.strictEqual(namesAreClose('Bonnaroo', 'Bonnaroo Music and Arts Festival'), true);
  assert.strictEqual(namesAreClose('Bonnaroo 2026', 'The Bonnaroo Music & Arts Festival'), true);
});

test('containment is by whole token, not raw substring', () => {
  assert.strictEqual(namesAreClose('roo', 'Bonnaroo'), false);
});

test('unrelated names of the same shape stay apart', () => {
  assert.strictEqual(namesAreClose('Summer Camp', 'Summer Solstice'), false);
  assert.strictEqual(namesAreClose('Coachella', 'Bonnaroo'), false);
});

test('similarity is 0 when either name is empty', () => {
  assert.strictEqual(nameSimilarity('', 'Bonnaroo'), 0);
  assert.strictEqual(namesAreClose('', ''), false);
});

// ── Dates: the edition gate ───────────────────────────────────────────

test('THE case: Bonnaroo 2025 and Bonnaroo 2026 never match', () => {
  const a = fest('Bonnaroo 2025', '2025-06-12', '2025-06-15', 'Manchester, TN');
  const b = fest('Bonnaroo 2026', '2026-06-11', '2026-06-14', 'Manchester, TN');
  assert.strictEqual(namesAreClose(a.name, b.name), true, 'names should be identical after normalization');
  assert.strictEqual(datesAreClose(a, b), false, 'a year apart must fail the date gate');
  assert.strictEqual(festivalsMatch(a, b), false);
});

test('overlapping windows match', () => {
  assert.strictEqual(
    datesAreClose(fest('x', '2026-06-11', '2026-06-14'), fest('x', '2026-06-13', '2026-06-16')),
    true
  );
});

test('starts within the allowed gap match even without overlap', () => {
  // Two one-day festivals MAX_START_DATE_GAP_DAYS apart.
  assert.strictEqual(MAX_START_DATE_GAP_DAYS, 3);
  assert.strictEqual(
    datesAreClose(fest('x', '2026-06-11', '2026-06-11'), fest('x', '2026-06-14', '2026-06-14')),
    true
  );
  assert.strictEqual(
    datesAreClose(fest('x', '2026-06-11', '2026-06-11'), fest('x', '2026-06-15', '2026-06-15')),
    false
  );
});

test('single-day festivals (start == end) match correctly', () => {
  const a = fest('Field Day', '2026-08-01', '2026-08-01');
  const b = fest('Field Day', '2026-08-01', '2026-08-01');
  assert.strictEqual(festivalsMatch(a, b), true);
});

test('a festival spanning a year boundary matches its twin', () => {
  const a = fest('Decadence', '2026-12-30', '2027-01-01');
  const b = fest('Decadence', '2026-12-31', '2027-01-01');
  assert.strictEqual(festivalsMatch(a, b), true);
});

test('a year-boundary festival does not match the next edition', () => {
  const a = fest('Decadence', '2026-12-30', '2027-01-01');
  const b = fest('Decadence', '2027-12-30', '2028-01-01');
  assert.strictEqual(festivalsMatch(a, b), false);
});

test('the day either side of a month boundary is counted exactly', () => {
  // Jan 31 -> Feb 1 is one day, not a month.
  assert.strictEqual(
    datesAreClose(fest('x', '2026-01-31', '2026-01-31'), fest('x', '2026-02-01', '2026-02-01')),
    true
  );
});

test('a malformed or missing date fails the gate rather than matching everything', () => {
  assert.strictEqual(datesAreClose(fest('x', '', ''), fest('x', '2026-06-11', '2026-06-14')), false);
  assert.strictEqual(datesAreClose(fest('x', 'June 2026'), fest('x', '2026-06-11')), false);
});

test('a missing end date is treated as a single day, not an open window', () => {
  assert.strictEqual(
    datesAreClose(fest('x', '2026-06-11', undefined), fest('x', '2026-06-11', '2026-06-14')),
    true
  );
  assert.strictEqual(
    datesAreClose(fest('x', '2026-06-11', undefined), fest('x', '2026-09-01', '2026-09-04')),
    false
  );
});

test('an inverted window is treated as a single day rather than matching nothing', () => {
  assert.strictEqual(
    datesAreClose(fest('x', '2026-06-14', '2026-06-11'), fest('x', '2026-06-14', '2026-06-16')),
    true
  );
});

// ── Location: tiebreaker, never an equality test ──────────────────────

test('a blank location never splits two records of the same festival', () => {
  assert.strictEqual(locationsAgree('', 'Manchester, TN'), true);
  assert.strictEqual(
    festivalsMatch(
      fest('Bonnaroo', '2026-06-11', '2026-06-14', ''),
      fest('Bonnaroo', '2026-06-11', '2026-06-14', 'Manchester, TN')
    ),
    true
  );
});

test('normalizeLocation takes the city out of free text', () => {
  assert.strictEqual(normalizeLocation('Manchester, TN'), 'manchester');
  assert.strictEqual(normalizeLocation('  Chicago , IL '), 'chicago');
});

test('a differing city does not reject a candidate on its own', () => {
  const chicago = fest('Lollapalooza', '2026-08-01', '2026-08-04', 'Chicago, IL');
  const berlin = fest('Lollapalooza', '2026-08-01', '2026-08-04', 'Berlin');
  assert.strictEqual(locationsAgree(chicago.location, berlin.location), false);
  assert.strictEqual(festivalsMatch(chicago, berlin), true, 'still a candidate — the user chooses');
});

// ── findFestivalMatches ───────────────────────────────────────────────

test('same name and dates in two cities returns both, city-agreeing first', () => {
  const draft = fest('Lollapalooza', '2026-08-01', '2026-08-04', 'Berlin');
  const catalog = [
    { id: 'chi', ...fest('Lollapalooza', '2026-08-01', '2026-08-04', 'Chicago, IL') },
    { id: 'ber', ...fest('Lollapalooza', '2026-08-01', '2026-08-04', 'Berlin') },
  ];
  const matches = findFestivalMatches(draft, catalog);
  assert.strictEqual(matches.length, 2);
  assert.strictEqual(matches[0].festival.id, 'ber');
  assert.strictEqual(matches[1].festival.id, 'chi');
});

test('the previous edition is never returned as a match', () => {
  const draft = fest('Bonnaroo 2026', '2026-06-11', '2026-06-14', 'Manchester, TN');
  const catalog = [
    { id: 'y2025', ...fest('Bonnaroo 2025', '2025-06-12', '2025-06-15', 'Manchester, TN') },
    { id: 'y2026', ...fest('Bonnaroo', '2026-06-11', '2026-06-14', 'Manchester, TN') },
  ];
  const matches = findFestivalMatches(draft, catalog);
  assert.deepStrictEqual(matches.map(m => m.festival.id), ['y2026']);
});

test('no candidates returns an empty list, not a throw', () => {
  assert.deepStrictEqual(findFestivalMatches(fest('Bonnaroo', '2026-06-11', '2026-06-14'), []), []);
  assert.strictEqual(festivalsMatch(null, fest('x', '2026-01-01')), false);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
