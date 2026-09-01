/**
 * Unit tests for lib/bustOuts.js — severity bands and the bust-out
 * detection calculation.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/bustOuts.test.js
 */

import assert from 'assert';
import { getBustOutSeverity, computeShowBustOuts, DEFAULT_BUSTOUT_THRESHOLD_DAYS } from '@/lib/bustOuts';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`✗ ${name}\n  ${err.message}`);
  }
}

function songHistoryFor(name, plays) {
  return { songs: [{ name, count: plays.length, plays }] };
}

// ── Severity bands ───────────────────────────────────────────────────────

test('under threshold is not a bust-out', () => {
  assert.strictEqual(getBustOutSeverity(30, 90), null);
});

test('90-179 days at the default threshold is minor', () => {
  assert.strictEqual(getBustOutSeverity(150, 90), 'minor');
});

test('180-364 days is major', () => {
  assert.strictEqual(getBustOutSeverity(200, 90), 'major');
  assert.strictEqual(getBustOutSeverity(364, 90), 'major');
});

test('365+ days is epic', () => {
  assert.strictEqual(getBustOutSeverity(365, 90), 'epic');
  assert.strictEqual(getBustOutSeverity(1900, 90), 'epic');
});

test('a lower user threshold widens the minor band instead of shifting it', () => {
  assert.strictEqual(getBustOutSeverity(65, 60), 'minor');
  assert.strictEqual(getBustOutSeverity(200, 60), 'major');
});

test('a threshold at/above 180 skips straight from none to major', () => {
  assert.strictEqual(getBustOutSeverity(179, 180), null);
  assert.strictEqual(getBustOutSeverity(180, 180), 'major');
});

test('null/undefined days is not a bust-out', () => {
  assert.strictEqual(getBustOutSeverity(null, 90), null);
  assert.strictEqual(getBustOutSeverity(undefined, 90), null);
});

// ── computeShowBustOuts ──────────────────────────────────────────────────

test('a song last played 200 days ago is flagged major with the correct day count', () => {
  const setlist = [{ name: 'Tweezer' }];
  const songHistory = songHistoryFor('Tweezer', [{ date: '2024-01-15', venue: 'MSG', city: 'New York' }]);
  const result = computeShowBustOuts({ setlist, showDate: '2024-08-03', songHistory }); // 201 days later
  const entry = result.get('tweezer');
  assert.ok(entry, 'expected Tweezer to be flagged');
  assert.strictEqual(entry.severity, 'major');
  assert.strictEqual(entry.days, 201);
  assert.strictEqual(entry.lastVenue, 'MSG');
});

test('a song last played 30 days ago is not flagged at the default 90-day threshold', () => {
  const setlist = [{ name: 'Divided Sky' }];
  const songHistory = songHistoryFor('Divided Sky', [{ date: '2024-06-04', venue: 'Alpine Valley' }]);
  const result = computeShowBustOuts({ setlist, showDate: '2024-07-04', songHistory });
  assert.strictEqual(result.has('divided sky'), false);
});

test('a song last played 5 years ago is flagged epic', () => {
  const setlist = [{ name: 'Fluffhead' }];
  const songHistory = songHistoryFor('Fluffhead', [{ date: '2019-08-03', venue: 'Dick\'s' }]);
  const result = computeShowBustOuts({ setlist, showDate: '2024-08-03', songHistory });
  const entry = result.get('fluffhead');
  assert.ok(entry);
  assert.strictEqual(entry.severity, 'epic');
});

test('changing the threshold to 60 flags a song that was previously under the 90-day default', () => {
  const setlist = [{ name: 'Sample in a Jar' }];
  const songHistory = songHistoryFor('Sample in a Jar', [{ date: '2024-01-01' }]);
  const showDate = '2024-03-15'; // ~74 days later
  const at90 = computeShowBustOuts({ setlist, showDate, songHistory, thresholdDays: 90 });
  const at60 = computeShowBustOuts({ setlist, showDate, songHistory, thresholdDays: 60 });
  assert.strictEqual(at90.has('sample in a jar'), false);
  assert.strictEqual(at60.get('sample in a jar').severity, 'minor');
});

test('a song with no prior play anywhere in songHistory or personal history is not flagged', () => {
  const setlist = [{ name: 'Brand New Song' }];
  const songHistory = songHistoryFor('Some Other Song', [{ date: '2020-01-01' }]);
  const result = computeShowBustOuts({ setlist, showDate: '2024-08-03', songHistory });
  assert.strictEqual(result.size, 0);
});

test('personal performance history fills in a song missing from setlist.fm data', () => {
  const setlist = [{ name: 'Harry Hood' }];
  const personalPerformances = new Map([['harry hood', [new Date(2023, 0, 1)]]]);
  const result = computeShowBustOuts({
    setlist,
    showDate: '2024-08-03',
    songHistory: null,
    personalPerformances,
  });
  const entry = result.get('harry hood');
  assert.ok(entry, 'expected personal history fallback to flag Harry Hood');
  assert.strictEqual(entry.severity, 'epic');
});

test('only the most recent prior play (not an older one) determines the gap', () => {
  const setlist = [{ name: 'You Enjoy Myself' }];
  const songHistory = songHistoryFor('You Enjoy Myself', [
    { date: '2020-01-01' }, // much older
    { date: '2024-05-01' }, // most recent — 94 days before the show
  ]);
  const result = computeShowBustOuts({ setlist, showDate: '2024-08-03', songHistory });
  const entry = result.get('you enjoy myself');
  assert.strictEqual(entry.severity, 'minor');
});

test('future/same-day plays in songHistory are ignored when computing the prior gap', () => {
  const setlist = [{ name: 'Also Sprach Zarathustra' }];
  const songHistory = songHistoryFor('Also Sprach Zarathustra', [
    { date: '2024-08-03' }, // same date as this show — not a prior play
    { date: '2019-01-01' },
  ]);
  const result = computeShowBustOuts({ setlist, showDate: '2024-08-03', songHistory });
  assert.strictEqual(result.get('also sprach zarathustra').severity, 'epic');
});

test('duplicate songs in the setlist (e.g. set-break repeats) are only evaluated once', () => {
  const setlist = [{ name: 'Wilson' }, { name: 'Wilson' }];
  const songHistory = songHistoryFor('Wilson', [{ date: '2019-01-01' }]);
  const result = computeShowBustOuts({ setlist, showDate: '2024-08-03', songHistory });
  assert.strictEqual(result.size, 1);
});

test('DEFAULT_BUSTOUT_THRESHOLD_DAYS is 90', () => {
  assert.strictEqual(DEFAULT_BUSTOUT_THRESHOLD_DAYS, 90);
});

// ── Summary ─────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
