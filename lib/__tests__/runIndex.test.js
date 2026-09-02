/**
 * Unit tests for lib/runIndex.js — run clustering, repeats/no-repeat, and
 * tour grouping.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/runIndex.test.js
 */

import assert from 'assert';
import { buildRunIndex, buildTourIndex, newSongsOnTour, tourHref } from '@/lib/runIndex';
import { buildSongIndex } from '@/lib/songIndex';

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

function song(name, overrides = {}) {
  return { id: overrides.id || `${name}-${Math.random()}`, name, ...overrides };
}

function show(id, date, artist, venue, setlist, overrides = {}) {
  return { id, date, artist, venue, city: 'City', setlist, ...overrides };
}

function onlyRun(index) {
  const runs = Object.values(index);
  assert.strictEqual(runs.length, 1, `expected exactly 1 run, got ${runs.length}`);
  return runs[0];
}

// ── Basic clustering ─────────────────────────────────────────────────

test('three consecutive nights, same artist/venue -> one 3-night run', () => {
  const shows = [
    show('s1', '2023-07-14', 'Phish', "Dick's Sporting Goods Park", [song('Wilson')]),
    show('s2', '2023-07-15', 'Phish', "Dick's Sporting Goods Park", [song('Reba')]),
    show('s3', '2023-07-16', 'Phish', "Dick's Sporting Goods Park", [song('Harry Hood')]),
  ];
  const run = onlyRun(buildRunIndex(shows));
  assert.strictEqual(run.nightCount, 3);
});

test('two shows a week apart at the same venue are NOT a run', () => {
  const shows = [
    show('s1', '2023-07-14', 'Phish', "Dick's Sporting Goods Park", [song('Wilson')]),
    show('s2', '2023-07-21', 'Phish', "Dick's Sporting Goods Park", [song('Reba')]),
  ];
  const runs = Object.values(buildRunIndex(shows));
  assert.strictEqual(runs.length, 0);
});

test('a single show never renders as a run', () => {
  const shows = [show('s1', '2023-07-14', 'Phish', "Dick's", [song('Wilson')])];
  const runs = Object.values(buildRunIndex(shows));
  assert.strictEqual(runs.length, 0);
});

test('a run spanning a year boundary groups correctly', () => {
  const shows = [
    show('s1', '2023-12-30', 'Phish', 'MSG', [song('Auld Lang Syne')]),
    show('s2', '2023-12-31', 'Phish', 'MSG', [song('Auld Lang Syne')]),
    show('s3', '2024-01-01', 'Phish', 'MSG', [song('Wilson')]),
  ];
  const run = onlyRun(buildRunIndex(shows));
  assert.strictEqual(run.nightCount, 3);
  assert.strictEqual(run.dateRange.start, '2023-12-30');
  assert.strictEqual(run.dateRange.end, '2024-01-01');
});

test('a venue renamed slightly between nights (sponsor change) does not split the run', () => {
  const shows = [
    show('s1', '2023-07-14', 'Phish', "Dick's Sporting Goods Park", [song('Wilson')]),
    show('s2', '2023-07-15', 'Phish', "Dick's Sporting Goods Park at Dry Creek", [song('Reba')]),
  ];
  const run = onlyRun(buildRunIndex(shows));
  assert.strictEqual(run.nightCount, 2);
});

test('different artists at the same venue on consecutive nights do not merge into one run', () => {
  const shows = [
    show('s1', '2023-07-14', 'Phish', "Dick's", [song('Wilson')]),
    show('s2', '2023-07-15', 'Goose', "Dick's", [song('Arcadia')]),
  ];
  const runs = Object.values(buildRunIndex(shows));
  assert.strictEqual(runs.length, 0); // each is a lone show for its own artist
});

// ── No-repeat / repeats ──────────────────────────────────────────────

test('a genuine no-repeat run (every song played exactly once) is identified', () => {
  const shows = [
    show('s1', '2023-07-14', 'Phish', "Dick's", [song('Wilson'), song('Reba')]),
    show('s2', '2023-07-15', 'Phish', "Dick's", [song('Harry Hood'), song('Divided Sky')]),
  ];
  const run = onlyRun(buildRunIndex(shows));
  assert.strictEqual(run.noRepeat, true);
  assert.strictEqual(run.repeats.length, 0);
  assert.strictEqual(run.uniqueSongs, 4);
  assert.strictEqual(run.totalSongs, 4);
});

test('a run with a repeated song is not no-repeat, and the repeat lists both nights', () => {
  const shows = [
    show('s1', '2023-07-14', 'Phish', "Dick's", [song('Wilson'), song('Reba')]),
    show('s2', '2023-07-15', 'Phish', "Dick's", [song('Wilson'), song('Divided Sky')]),
  ];
  const run = onlyRun(buildRunIndex(shows));
  assert.strictEqual(run.noRepeat, false);
  assert.strictEqual(run.repeats.length, 1);
  assert.strictEqual(run.repeats[0].title, 'Wilson');
  assert.deepStrictEqual(run.repeats[0].nightNumbers, [1, 2]);
});

test('two spellings of the same song across nights count as one repeat, not two unique songs', () => {
  const shows = [
    show('s1', '2023-07-14', 'Phish', "Dick's", [song('Ashes//Dust')]),
    show('s2', '2023-07-15', 'Phish', "Dick's", [song('Ashes // Dust')]),
  ];
  const run = onlyRun(buildRunIndex(shows));
  assert.strictEqual(run.uniqueSongs, 1);
  assert.strictEqual(run.noRepeat, false);
});

test('a run with one night missing its setlist reports incomplete data, not a false no-repeat', () => {
  const shows = [
    show('s1', '2023-07-14', 'Phish', "Dick's", [song('Wilson'), song('Reba')]),
    show('s2', '2023-07-15', 'Phish', "Dick's", []), // setlist not logged yet
  ];
  const run = onlyRun(buildRunIndex(shows));
  assert.strictEqual(run.hasIncompleteData, true);
  assert.strictEqual(run.noRepeat, null);
});

// ── Best night ───────────────────────────────────────────────────────

test('best night is picked when ratings differ', () => {
  const shows = [
    show('s1', '2023-07-14', 'Phish', "Dick's", [song('Wilson')], { rating: 7 }),
    show('s2', '2023-07-15', 'Phish', "Dick's", [song('Reba')], { rating: 9 }),
  ];
  const run = onlyRun(buildRunIndex(shows));
  assert.strictEqual(run.bestNightIndex, 1);
});

test('best night is omitted when all rated nights are tied', () => {
  const shows = [
    show('s1', '2023-07-14', 'Phish', "Dick's", [song('Wilson')], { rating: 8 }),
    show('s2', '2023-07-15', 'Phish', "Dick's", [song('Reba')], { rating: 8 }),
  ];
  const run = onlyRun(buildRunIndex(shows));
  assert.strictEqual(run.bestNightIndex, null);
});

test('best night is omitted when no nights are rated', () => {
  const shows = [
    show('s1', '2023-07-14', 'Phish', "Dick's", [song('Wilson')]),
    show('s2', '2023-07-15', 'Phish', "Dick's", [song('Reba')]),
  ];
  const run = onlyRun(buildRunIndex(shows));
  assert.strictEqual(run.bestNightIndex, null);
});

// ── Tours ────────────────────────────────────────────────────────────

test('shows with the same artist and tour name group into one tour', () => {
  const shows = [
    show('s1', '2023-07-01', 'Phish', 'Venue A', [song('Wilson')], { tour: '2023 Summer Tour' }),
    show('s2', '2023-07-14', 'Phish', 'Venue B', [song('Reba')], { tour: '2023 Summer Tour' }),
  ];
  const tours = Object.values(buildTourIndex(shows));
  assert.strictEqual(tours.length, 1);
  assert.strictEqual(tours[0].stopCount, 2);
});

test('shows with no tour name do not create a "No Tour" bucket', () => {
  const shows = [
    show('s1', '2023-07-01', 'Phish', 'Venue A', [song('Wilson')]),
    show('s2', '2023-07-14', 'Phish', 'Venue B', [song('Reba')]),
  ];
  const tours = Object.values(buildTourIndex(shows));
  assert.strictEqual(tours.length, 0);
});

test('a tour spanning a year boundary reports both years', () => {
  const shows = [
    show('s1', '2023-12-30', 'Phish', 'Venue A', [song('Wilson')], { tour: 'NYE Run' }),
    show('s2', '2024-01-01', 'Phish', 'Venue A', [song('Reba')], { tour: 'NYE Run' }),
  ];
  const tours = Object.values(buildTourIndex(shows));
  assert.deepStrictEqual(tours[0].years, ['2023', '2024']);
});

test('tourHref points at the query-param route, not a dynamic segment', () => {
  assert.strictEqual(tourHref('phish:summer-tour'), '/tours/?tour=phish%3Asummer-tour');
});

// ── New songs heard on a tour ────────────────────────────────────────

test('a song first heard on a tour stop is listed as new on that tour', () => {
  const shows = [
    show('s1', '2022-07-01', 'Phish', 'Venue A', [song('Wilson')]),
    show('s2', '2023-07-01', 'Phish', 'Venue B', [song('Wilson'), song('Reba')], { tour: '2023 Summer Tour' }),
  ];
  const tour = Object.values(buildTourIndex(shows))[0];
  const newSongs = newSongsOnTour(tour, buildSongIndex(shows));
  assert.deepStrictEqual(newSongs.map(s => s.title), ['Reba']);
  assert.strictEqual(newSongs[0].firstSeen.showId, 's2');
});

test('a tour of entirely previously-heard songs reports no new songs', () => {
  const shows = [
    show('s1', '2022-07-01', 'Phish', 'Venue A', [song('Wilson'), song('Reba')]),
    show('s2', '2023-07-01', 'Phish', 'Venue B', [song('Wilson'), song('Reba')], { tour: '2023 Summer Tour' }),
  ];
  const tour = Object.values(buildTourIndex(shows))[0];
  assert.deepStrictEqual(newSongsOnTour(tour, buildSongIndex(shows)), []);
});

test('another artist first-heard elsewhere never counts as new on this tour', () => {
  const shows = [
    show('s1', '2023-07-01', 'Phish', 'Venue A', [song('Wilson')], { tour: '2023 Summer Tour' }),
    show('s2', '2023-07-02', 'Phish', 'Venue B', [song('Reba')], { tour: '2023 Summer Tour' }),
    show('s3', '2023-07-03', 'Goose', 'Venue C', [song('Arrow')]),
  ];
  const tour = Object.values(buildTourIndex(shows))[0];
  const titles = newSongsOnTour(tour, buildSongIndex(shows)).map(s => s.title);
  assert.deepStrictEqual(titles, ['Wilson', 'Reba']);
});

test('new songs are ordered by the date they were first heard', () => {
  const shows = [
    show('s1', '2023-07-02', 'Phish', 'Venue A', [song('Reba')], { tour: 'T' }),
    show('s2', '2023-07-01', 'Phish', 'Venue B', [song('Wilson')], { tour: 'T' }),
  ];
  const tour = Object.values(buildTourIndex(shows))[0];
  const titles = newSongsOnTour(tour, buildSongIndex(shows)).map(s => s.title);
  assert.deepStrictEqual(titles, ['Wilson', 'Reba']);
});

test('newSongsOnTour on a tour with no stops returns an empty list', () => {
  assert.deepStrictEqual(newSongsOnTour({ artistSlug: 'phish', stops: [] }, {}), []);
});

// ── Summary ─────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
