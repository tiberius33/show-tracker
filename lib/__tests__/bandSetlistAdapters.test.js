/**
 * Unit tests for the band-source adapters —
 * netlify/functions/lib/elgooseAdapter.js and phishnetAdapter.js — and the
 * shape logic they share in bandSetlistShape.js.
 *
 * These exercise the mapping and grouping logic against fixture responses
 * WITHOUT going near the network: readEnvelope, groupRowsByShow and mapShow
 * are all pure, and fetchSetlists is the only function that opens a socket.
 *
 * READ THE PROVENANCE NOTE in fixtures/bandSetlistFixtures.js before
 * trusting a green run here. The fixtures are constructed to the documented
 * row shape rather than captured from a live response, so they cannot prove
 * the upstream field names are right — they prove the logic layered on top
 * of the mapping, which is where the complexity actually is.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/bandSetlistAdapters.test.js
 */

import assert from 'assert';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const elgoose = require('../../netlify/functions/lib/elgooseAdapter.js');
const phishnet = require('../../netlify/functions/lib/phishnetAdapter.js');
const shape = require('../../netlify/functions/lib/bandSetlistShape.js');
const bandSetlist = require('../../netlify/functions/band-setlist.js');
const fx = require('./fixtures/bandSetlistFixtures.js');

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

// Runs an adapter's pure pipeline — envelope, group, map — the way
// fetchSetlists does once the HTTP response is in hand.
function mapAll(adapter, payload) {
  const envelope = adapter.readEnvelope(payload);
  if (!envelope.ok) return { ok: false, message: envelope.message, shows: [] };
  const shows = adapter.groupRowsByShow(envelope.rows).map(adapter.mapShow);
  return { ok: true, message: '', shows };
}

const titles = (songs) => songs.map(s => s.name);
const labels = (songs) => songs.map(s => s.set);
const byName = (songs, name) => songs.find(s => s.name === name);

// ── The envelope: 0 vs false ──────────────────────────────────────────
// The one documented difference between the two APIs, and the reason each
// adapter tests its own error node rather than sharing one check.

test('elgoose: error 0 is success', () => {
  assert.strictEqual(elgoose.readEnvelope(fx.ELGOOSE_RADIO_CITY).ok, true);
});

test('elgoose: error 1 is a failure, carrying error_message', () => {
  const e = elgoose.readEnvelope(fx.ELGOOSE_ERROR);
  assert.strictEqual(e.ok, false);
  assert.strictEqual(e.message, 'No results found');
});

test('phishnet: error false (a boolean, not 0) is success', () => {
  assert.strictEqual(fx.PHISHNET_HAMPTON.error, false, 'fixture must use a boolean');
  assert.strictEqual(phishnet.readEnvelope(fx.PHISHNET_HAMPTON).ok, true);
});

test('phishnet: error true is a failure, carrying error_message', () => {
  const e = phishnet.readEnvelope(fx.PHISHNET_ERROR);
  assert.strictEqual(e.ok, false);
  assert.strictEqual(e.message, 'Invalid API key');
});

test('phishnet: a STRING "true" error is still a failure — not tested truthily', () => {
  // The trap: "true" is a truthy string but `0`/`false` are both falsy, so
  // a truthy check happens to work for the documented values and silently
  // breaks the day either API quotes them.
  const e = phishnet.readEnvelope(fx.PHISHNET_ERROR_STRING);
  assert.strictEqual(e.ok, false);
});

test('both adapters reject a non-object payload rather than throwing', () => {
  assert.strictEqual(elgoose.readEnvelope(null).ok, false);
  assert.strictEqual(phishnet.readEnvelope(undefined).ok, false);
  assert.strictEqual(elgoose.readEnvelope('nope').ok, false);
});

test('a payload with a non-array data node yields no rows, not a crash', () => {
  assert.deepStrictEqual(elgoose.readEnvelope({ error: 0, data: 'x' }).rows, []);
});

// ── El Goose: flat rows to a normalized setlist ───────────────────────

test('elgoose: one date, one show, flat rows grouped into it', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_RADIO_CITY);
  assert.strictEqual(shows.length, 1);
  assert.strictEqual(shows[0].venue, 'Radio City Music Hall');
  assert.strictEqual(shows[0].source, 'elgoose');
  assert.strictEqual(shows[0].sourceShowId, '1601');
});

test('elgoose: settype/setnumber map onto the app canonical labels', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_RADIO_CITY);
  assert.deepStrictEqual(labels(shows[0].songs), ['Set I', 'Set I', 'Set I', 'Set II', 'Encore']);
});

test('elgoose: the soundcheck row is dropped and counted, not stored', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_RADIO_CITY);
  assert.strictEqual(shows[0].droppedSoundcheckCount, 1);
  assert.ok(!titles(shows[0].songs).includes('Arcadia'), 'soundcheck song must not be in the setlist');
});

test('elgoose: transition marks — > and -> segue, comma and empty do not', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_RADIO_CITY);
  const songs = shows[0].songs;

  assert.strictEqual(byName(songs, 'Hot Tea').tape, true);
  assert.strictEqual(byName(songs, 'Hot Tea').transitionMark, '>');

  // '->' is preserved rather than collapsed to '>': the two mean
  // different things to the people who maintain these archives.
  assert.strictEqual(byName(songs, 'Arrow').tape, true);
  assert.strictEqual(byName(songs, 'Arrow').transitionMark, '->');

  assert.strictEqual(byName(songs, 'Madhuvan').tape, false);
  assert.strictEqual(byName(songs, 'Madhuvan').transitionMark, undefined);

  assert.strictEqual(byName(songs, 'Tumble').tape, false);
});

test('elgoose: footnotes, jam chart flag and note land on the right songs', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_RADIO_CITY);
  const songs = shows[0].songs;

  assert.strictEqual(byName(songs, 'Hot Tea').footnote, 'With a Tom Sawyer tease');
  assert.strictEqual(byName(songs, 'Time to Flee').footnote, 'Guest: Marcus King on guitar');

  assert.strictEqual(byName(songs, 'Arrow').jamchart, true);
  assert.strictEqual(byName(songs, 'Arrow').jamchartNote, 'Patient, melodic build into a full-band peak.');

  // Not flagged means the key is absent entirely, not `false` — a
  // setlist.fm-sourced song has no such key and the two must look alike.
  assert.strictEqual('jamchart' in byName(songs, 'Hot Tea'), false);
  assert.strictEqual('footnote' in byName(songs, 'Arrow'), false);
});

test('elgoose: sourceGap carries the official number, and 0 survives', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_RADIO_CITY);
  const songs = shows[0].songs;
  assert.strictEqual(byName(songs, 'Hot Tea').sourceGap, 3);
  assert.strictEqual(byName(songs, 'Arrow').sourceGap, 8);
  // A gap of 0 is meaningful ("played at the previous show") and must not
  // be swallowed by a falsy check.
  assert.strictEqual(byName(songs, 'Madhuvan').sourceGap, 0);
  // null gap means no key rather than a null value.
  assert.strictEqual('sourceGap' in byName(songs, 'Tumble'), true);
});

test('elgoose: songId and songSlug come through for future song-page links', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_RADIO_CITY);
  const hotTea = byName(shows[0].songs, 'Hot Tea');
  assert.strictEqual(hotTea.songId, 'eg-hot-tea');
  assert.strictEqual(hotTea.songSlug, 'hot-tea');
});

test('elgoose: no setlistNotes — that is a phish.net field', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_RADIO_CITY);
  assert.strictEqual(shows[0].setlistNotes, '');
});

test('elgoose: tour name is read off the show', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_RADIO_CITY);
  assert.strictEqual(shows[0].tour, 'Fall Tour 2023');
});

test('elgoose: two shows on one date come back as two shows', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_TWO_SHOWS_ONE_DATE);
  assert.strictEqual(shows.length, 2);
  assert.deepStrictEqual(shows.map(s => s.venue).sort(), ['Bonnaroo', 'The Gorge Amphitheatre']);
});

// ── Phish.net ─────────────────────────────────────────────────────────

test('phishnet: the single `set` code maps onto canonical labels', () => {
  const { shows } = mapAll(phishnet, fx.PHISHNET_HAMPTON);
  assert.deepStrictEqual(labels(shows[0].songs), ['Set I', 'Set I', 'Set II', 'Encore', 'Encore II']);
});

test('phishnet: a second encore is "Encore II", which CANONICAL_ORDER sorts', () => {
  const { shows } = mapAll(phishnet, fx.PHISHNET_HAMPTON);
  const rocky = byName(shows[0].songs, 'Rocky Top');
  assert.strictEqual(rocky.set, 'Encore II');
});

test('phishnet: splitSetCode handles set numbers, e, e2 and soundcheck', () => {
  assert.deepStrictEqual(phishnet.splitSetCode('1'), { setType: 'set', setNumber: 1 });
  assert.deepStrictEqual(phishnet.splitSetCode('3'), { setType: 'set', setNumber: 3 });
  assert.deepStrictEqual(phishnet.splitSetCode('e'), { setType: 'encore', setNumber: 1 });
  assert.deepStrictEqual(phishnet.splitSetCode('e2'), { setType: 'encore', setNumber: 2 });
  assert.deepStrictEqual(phishnet.splitSetCode('E3'), { setType: 'encore', setNumber: 3 });
  assert.deepStrictEqual(phishnet.splitSetCode('soundcheck'), { setType: 'soundcheck', setNumber: 1 });
  // An empty or unparseable code is a regular first set rather than a throw.
  assert.deepStrictEqual(phishnet.splitSetCode(''), { setType: 'set', setNumber: 1 });
  assert.deepStrictEqual(phishnet.splitSetCode(null), { setType: 'set', setNumber: 1 });
});

test('phishnet: transmark parses the same way elgoose transition does', () => {
  const { shows } = mapAll(phishnet, fx.PHISHNET_HAMPTON);
  const songs = shows[0].songs;
  assert.strictEqual(byName(songs, 'Mikes Song').transitionMark, '>');
  assert.strictEqual(byName(songs, 'Mikes Song').tape, true);
  assert.strictEqual(byName(songs, 'Simple').transitionMark, '->');
  assert.strictEqual(byName(songs, 'Halleys Comet').tape, false);
  assert.strictEqual(byName(songs, 'Rocky Top').tape, false);
});

test('phishnet: setlistnotes becomes the show-level setlistNotes', () => {
  const { shows } = mapAll(phishnet, fx.PHISHNET_HAMPTON);
  assert.strictEqual(shows[0].setlistNotes, 'This show was officially released as Hampton Comes Alive.');
});

test('phishnet: show-level fields — permalink, showid, venue, tour', () => {
  const { shows } = mapAll(phishnet, fx.PHISHNET_HAMPTON);
  const s = shows[0];
  assert.strictEqual(s.source, 'phishnet');
  assert.strictEqual(s.venue, 'Hampton Coliseum');
  assert.strictEqual(s.city, 'Hampton');
  assert.strictEqual(s.tour, '1997 Fall Tour');
  assert.strictEqual(s.sourceShowId, '1252344800');
  assert.ok(s.sourcePermalink.startsWith('https://phish.net/setlists/'));
});

test('phishnet: jam chart flag and its description', () => {
  const { shows } = mapAll(phishnet, fx.PHISHNET_HAMPTON);
  const simple = byName(shows[0].songs, 'Simple');
  assert.strictEqual(simple.jamchart, true);
  assert.strictEqual(simple.jamchartNote, 'Uncommonly patient Simple.');
  assert.strictEqual(simple.footnote, 'Unfinished.');
});

// Awaited here rather than inside test(), whose runner is synchronous — an
// async callback would resolve after the summary printed and a failure
// would go unreported.
const noKeyResult = await phishnet.fetchSetlists('1997-11-22', {});
test('phishnet: fetchSetlists refuses to open a socket without an API key', () => {
  assert.strictEqual(noKeyResult.ok, false);
  assert.match(noKeyResult.message, /API key/i);
  assert.deepStrictEqual(noKeyResult.shows, []);
});

// ── The shared shape logic ────────────────────────────────────────────

test('pickSetLabel: regular sets get roman numerals', () => {
  assert.strictEqual(shape.pickSetLabel('Set', 1), 'Set I');
  assert.strictEqual(shape.pickSetLabel('Set', 2), 'Set II');
  assert.strictEqual(shape.pickSetLabel('set', 3), 'Set III');
  assert.strictEqual(shape.pickSetLabel('', 1), 'Set I');
});

test('pickSetLabel: encore 1 is "Encore", not "Encore I"', () => {
  // Matches extractSongsFromSetlist exactly, which is what makes
  // groupSongsBySet's CANONICAL_ORDER keep working.
  assert.strictEqual(shape.pickSetLabel('Encore', 1), 'Encore');
  assert.strictEqual(shape.pickSetLabel('Encore', 2), 'Encore II');
  assert.strictEqual(shape.pickSetLabel('encore', 3), 'Encore III');
});

test('pickSetLabel: a soundcheck returns null so the caller can drop it', () => {
  assert.strictEqual(shape.pickSetLabel('Soundcheck', 1), null);
});

test('setSortKey: every encore sorts after every regular set', () => {
  assert.ok(shape.setSortKey('Set', 4) < shape.setSortKey('Encore', 1));
  assert.ok(shape.setSortKey('Encore', 1) < shape.setSortKey('Encore', 2));
  assert.ok(shape.setSortKey('Soundcheck', 1) < shape.setSortKey('Set', 1));
});

test('buildSetlist: rows arriving out of order come out in performance order', () => {
  const rows = [
    { set: 'Encore', setSortKey: shape.setSortKey('Encore', 1), position: 1, name: 'Encore Song' },
    { set: 'Set II', setSortKey: shape.setSortKey('Set', 2), position: 2, name: 'Second Second' },
    { set: 'Set I', setSortKey: shape.setSortKey('Set', 1), position: 1, name: 'Opener' },
    { set: 'Set II', setSortKey: shape.setSortKey('Set', 2), position: 1, name: 'First Second' },
  ];
  const { songs } = shape.buildSetlist(rows);
  assert.deepStrictEqual(titles(songs), ['Opener', 'First Second', 'Second Second', 'Encore Song']);
});

test('parseTransition: only marks containing > are segues', () => {
  assert.deepStrictEqual(shape.parseTransition(' > '), { transitionMark: '>', tape: true });
  assert.deepStrictEqual(shape.parseTransition('->'), { transitionMark: '->', tape: true });
  assert.deepStrictEqual(shape.parseTransition(','), { transitionMark: '', tape: false });
  assert.deepStrictEqual(shape.parseTransition(''), { transitionMark: '', tape: false });
  assert.deepStrictEqual(shape.parseTransition(null), { transitionMark: '', tape: false });
});

test('toBool accepts the 0/1, "0"/"1" and true/false these APIs mix', () => {
  assert.strictEqual(shape.toBool(1), true);
  assert.strictEqual(shape.toBool('1'), true);
  assert.strictEqual(shape.toBool(true), true);
  assert.strictEqual(shape.toBool('true'), true);
  assert.strictEqual(shape.toBool(0), false);
  assert.strictEqual(shape.toBool('0'), false);
  assert.strictEqual(shape.toBool(''), false);
  assert.strictEqual(shape.toBool(null), false);
});

test('every song gets a distinct id', () => {
  const { shows } = mapAll(phishnet, fx.PHISHNET_HAMPTON);
  const ids = shows[0].songs.map(s => s.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  ids.forEach(id => assert.ok(id && typeof id === 'string'));
});

// ── The function's TTL ceiling and disambiguation ─────────────────────

test('TTL is capped at 24h, honouring phish.net\'s caching policy', () => {
  assert.strictEqual(bandSetlist.MAX_TTL_HOURS, 24);
  // A 1997 show would get search-setlists.js's 7-day (168h) tier. Here the
  // ceiling holds, so a corrected setlist reaches the app the next day
  // rather than the next week.
  assert.strictEqual(bandSetlist.determineTtlHours('1997-11-22'), 24);
});

test('TTL is 1h for a show that has not happened yet', () => {
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  assert.strictEqual(bandSetlist.determineTtlHours(future), 1);
});

test('TTL is 6h for a show in the last month, while corrections land', () => {
  const recent = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  assert.strictEqual(bandSetlist.determineTtlHours(recent), 6);
});

test('TTL of an unparseable date falls back to 1h rather than the ceiling', () => {
  assert.strictEqual(bandSetlist.determineTtlHours('not-a-date'), 1);
});

test('cache keys separate source, artist and date', () => {
  const a = bandSetlist.buildCacheKey('elgoose', 'Goose', '2024-06-22', '');
  const b = bandSetlist.buildCacheKey('phishnet', 'Goose', '2024-06-22', '');
  const c = bandSetlist.buildCacheKey('elgoose', 'Goose', '2024-06-23', '');
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(a, c);
  // Case and padding in the artist name must not fragment the cache.
  assert.strictEqual(a, bandSetlist.buildCacheKey('elgoose', '  goose ', '2024-06-22', ''));
});

test('selectShow: one show on the date is unambiguous', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_RADIO_CITY);
  const picked = bandSetlist.selectShow(shows, { source: 'elgoose', date: '2023-12-30', venue: '' });
  assert.strictEqual(picked.ambiguous, false);
  assert.strictEqual(picked.venue, 'Radio City Music Hall');
});

test('selectShow: two shows on a date disambiguate on venue and say so', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_TWO_SHOWS_ONE_DATE);
  const picked = bandSetlist.selectShow(shows, { source: 'elgoose', date: '2024-06-22', venue: 'Bonnaroo' });
  assert.strictEqual(picked.ambiguous, true, 'must report the date was ambiguous even when it matched');
  assert.strictEqual(picked.venue, 'Bonnaroo');
  assert.deepStrictEqual(titles(picked.songs), ['Red Bird']);
  assert.match(picked.message, /matched on venue/i);
  assert.strictEqual(picked.candidates.length, 2);
});

test('selectShow: two shows and no venue is reported, not picked silently', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_TWO_SHOWS_ONE_DATE);
  const picked = bandSetlist.selectShow(shows, { source: 'elgoose', date: '2024-06-22', venue: '' });
  assert.strictEqual(picked.ambiguous, true);
  assert.match(picked.message, /no venue was supplied/i);
  assert.strictEqual(picked.candidates.length, 2);
});

test('selectShow: a venue that matches nothing still reports the candidates', () => {
  const { shows } = mapAll(elgoose, fx.ELGOOSE_TWO_SHOWS_ONE_DATE);
  const picked = bandSetlist.selectShow(shows, { source: 'elgoose', date: '2024-06-22', venue: 'Red Rocks' });
  assert.strictEqual(picked.ambiguous, true);
  assert.match(picked.message, /none matched venue/i);
});

test('selectShow: no shows yields an empty setlist, not a throw', () => {
  const picked = bandSetlist.selectShow([], { source: 'elgoose', date: '1999-01-01', venue: '' });
  assert.deepStrictEqual(picked.songs, []);
  assert.match(picked.message, /No show on/);
});

// ── Summary ─────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
