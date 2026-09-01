/**
 * Unit tests for lib/bustOuts.js — severity bands (shows-since AND
 * days-since, whichever clears first) and the bust-out detection
 * calculation.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/bustOuts.test.js
 */

import assert from 'assert';
import { getBustOutSeverity, computeShowBustOuts, DEFAULT_BUSTOUT_SENSITIVITY } from '@/lib/bustOuts';

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

function songHistoryFor(name, plays, showDates) {
  return {
    songs: [{ name, count: plays.length, plays }],
    showDates: showDates || plays.map(p => p.date),
  };
}

// Builds a run of N daily show dates starting the day after `startDate`
// (a 'YYYY-MM-DD' string), for exercising "shows since" counts without
// needing real setlist.fm data.
function dailyShowDates(startDate, count) {
  const start = new Date(startDate);
  const dates = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ── Severity bands ───────────────────────────────────────────────────────

test('under every band is not a bust-out', () => {
  assert.strictEqual(getBustOutSeverity(30, 5), null);
});

test('50+ shows since is a minor bust-out even well under a year', () => {
  assert.strictEqual(getBustOutSeverity(100, 50), 'minor');
});

test('1+ year since is a minor bust-out even under 50 shows', () => {
  assert.strictEqual(getBustOutSeverity(365, 10), 'minor');
});

test('100+ shows since is a major bust-out even under 2 years', () => {
  assert.strictEqual(getBustOutSeverity(500, 100), 'major');
});

test('2+ years since is a major bust-out even under 100 shows', () => {
  assert.strictEqual(getBustOutSeverity(730, 20), 'major');
});

test('5+ years since is epic regardless of show count', () => {
  assert.strictEqual(getBustOutSeverity(1825, 10), 'epic');
  assert.strictEqual(getBustOutSeverity(1825, null), 'epic');
});

test('unknown shows-since falls back to days-only bands', () => {
  assert.strictEqual(getBustOutSeverity(400, null), 'minor');
  assert.strictEqual(getBustOutSeverity(800, null), 'major');
  assert.strictEqual(getBustOutSeverity(100, null), null);
});

test('sensitivity scales both dimensions of every band together', () => {
  // Half sensitivity: minor at 25 shows / ~183 days instead of 50 / 365.
  assert.strictEqual(getBustOutSeverity(100, 25, 0.5), 'minor');
  assert.strictEqual(getBustOutSeverity(100, 24, 0.5), null);
});

test('null days is not a bust-out', () => {
  assert.strictEqual(getBustOutSeverity(null, 100), null);
});

// ── computeShowBustOuts ──────────────────────────────────────────────────

test('50+ shows since (but under a year) flags minor with the correct show count', () => {
  const showDates = dailyShowDates('2024-01-01', 60); // 60 shows in 60 days, well under 365
  const setlist = [{ name: 'Tweezer' }];
  const songHistory = songHistoryFor('Tweezer', [{ date: '2024-01-01', venue: 'MSG', city: 'New York' }], showDates);
  const result = computeShowBustOuts({ setlist, showDate: showDates[showDates.length - 1], songHistory });
  const entry = result.get('tweezer');
  assert.ok(entry, 'expected Tweezer to be flagged');
  assert.strictEqual(entry.severity, 'minor');
  assert.strictEqual(entry.showsSince, 59);
});

test('a song last played under 50 shows and under a year ago is not flagged', () => {
  const showDates = dailyShowDates('2024-01-01', 20);
  const setlist = [{ name: 'Divided Sky' }];
  const songHistory = songHistoryFor('Divided Sky', [{ date: '2024-01-01' }], showDates);
  const result = computeShowBustOuts({ setlist, showDate: showDates[showDates.length - 1], songHistory });
  assert.strictEqual(result.has('divided sky'), false);
});

test('a song last played 5 years ago is flagged epic', () => {
  const setlist = [{ name: 'Fluffhead' }];
  const songHistory = songHistoryFor('Fluffhead', [{ date: '2019-08-03', venue: "Dick's" }]);
  const result = computeShowBustOuts({ setlist, showDate: '2024-08-03', songHistory });
  const entry = result.get('fluffhead');
  assert.ok(entry);
  assert.strictEqual(entry.severity, 'epic');
});

test('lower sensitivity flags a song sooner (both dimensions scale down)', () => {
  const showDates = dailyShowDates('2024-01-01', 30);
  const setlist = [{ name: 'Sample in a Jar' }];
  const songHistory = songHistoryFor('Sample in a Jar', [{ date: '2024-01-01' }], showDates);
  const showDate = showDates[showDates.length - 1]; // 29 shows since
  const standard = computeShowBustOuts({ setlist, showDate, songHistory, sensitivity: 1 });
  const sensitive = computeShowBustOuts({ setlist, showDate, songHistory, sensitivity: 0.5 });
  assert.strictEqual(standard.has('sample in a jar'), false);
  assert.strictEqual(sensitive.get('sample in a jar').severity, 'minor');
});

test('a song with no prior play anywhere in songHistory or personal history is not flagged', () => {
  const setlist = [{ name: 'Brand New Song' }];
  const songHistory = songHistoryFor('Some Other Song', [{ date: '2020-01-01' }]);
  const result = computeShowBustOuts({ setlist, showDate: '2024-08-03', songHistory });
  assert.strictEqual(result.size, 0);
});

test('personal performance history fills in a song missing from setlist.fm data, falling back to days-only', () => {
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
  assert.strictEqual(entry.severity, 'minor'); // ~580 days, no showsSince known
  assert.strictEqual(entry.showsSince, null);
});

test('only the most recent prior play (not an older one) determines the gap', () => {
  const showDates = [...dailyShowDates('2020-01-01', 5), ...dailyShowDates('2024-05-01', 5)];
  const setlist = [{ name: 'You Enjoy Myself' }];
  const songHistory = songHistoryFor('You Enjoy Myself', [
    { date: '2020-01-01' }, // much older
    { date: '2024-05-01' }, // most recent — 94 days before the show, few shows since
  ], showDates);
  const result = computeShowBustOuts({ setlist, showDate: '2024-08-03', songHistory });
  assert.strictEqual(result.has('you enjoy myself'), false);
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

test('DEFAULT_BUSTOUT_SENSITIVITY is 1', () => {
  assert.strictEqual(DEFAULT_BUSTOUT_SENSITIVITY, 1);
});

// ── Summary ─────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
