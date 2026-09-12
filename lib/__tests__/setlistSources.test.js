/**
 * Unit tests for lib/setlistSources.js — the artist → setlist source
 * registry and its resolver.
 *
 * The thing worth pinning down here is the DEFAULT. setlist.fm has to be
 * what every unclaimed artist resolves to, because the alternative — an
 * artist quietly getting routed to an archive that has never heard of
 * them — is invisible until someone notices their setlists stopped
 * updating. So most of these tests are about artists that must NOT match.
 *
 * Run with:
 *   node --experimental-loader ./lib/__tests__/alias-loader.mjs lib/__tests__/setlistSources.test.js
 */

import assert from 'assert';
import {
  SETLIST_SOURCES, SETLISTFM_SOURCE_ID, artistNameKey, hasBandSource,
  resolveSource, sourceHomeUrl, sourceLabel,
} from '@/lib/setlistSources';
import { artistKeyFor } from '@/lib/wishlist';

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

// ── The default ───────────────────────────────────────────────────────

test('an unclaimed artist resolves to setlist.fm', () => {
  const r = resolveSource('The Strokes');
  assert.strictEqual(r.id, SETLISTFM_SOURCE_ID);
  assert.strictEqual(r.isBandSource, false);
  assert.strictEqual(r.matchedOn, 'default');
});

test('artists adjacent to a claimed one do NOT match', () => {
  // Nothing in this registry is fuzzy. "Goose Island", "Mother Goose" and
  // "Phish Food" are different artists and must stay on setlist.fm.
  ['Goose Island', 'Mother Goose', 'Gooseberry', 'Phishing', 'Phish Food', 'The Phish']
    .forEach((name) => {
      assert.strictEqual(resolveSource(name).id, SETLISTFM_SOURCE_ID, `${name} must not match`);
    });
});

test('the side projects stay on setlist.fm until someone verifies them', () => {
  // Deliberate: elgoose.net carries Orebolo and phish.net covers Trey
  // Anastasio Band, but neither was verifiable against a live API response
  // when this was written, and an unverified guess is exactly what the
  // registry exists to avoid. They resolve to setlist.fm, which is what
  // they did before this change, so nothing regresses by waiting.
  ['Orebolo', 'Trey Anastasio Band', 'Trey Anastasio', 'Goose Acoustic', 'TAB']
    .forEach((name) => {
      assert.strictEqual(resolveSource(name).id, SETLISTFM_SOURCE_ID, `${name} must not match yet`);
    });
});

test('an empty, null or junk artist resolves to setlist.fm without throwing', () => {
  [undefined, null, '', '   ', {}, { name: '' }, { name: null }].forEach((input) => {
    assert.strictEqual(resolveSource(input).id, SETLISTFM_SOURCE_ID);
  });
});

test('resolveSource never returns null', () => {
  [undefined, null, 'Goose', { name: 'Phish', mbid: 'x' }].forEach((input) => {
    assert.ok(resolveSource(input), 'must always return an object');
  });
});

// ── The two claimed artists ───────────────────────────────────────────

test('Goose resolves to elgoose, by name', () => {
  const r = resolveSource('Goose');
  assert.strictEqual(r.id, 'elgoose');
  assert.strictEqual(r.isBandSource, true);
  assert.strictEqual(r.matchedOn, 'name');
  assert.strictEqual(r.sourceArtistFilter, 'goose');
});

test('Phish resolves to phishnet, with the artistid the API wants', () => {
  const r = resolveSource('Phish');
  assert.strictEqual(r.id, 'phishnet');
  assert.strictEqual(r.isBandSource, true);
  assert.strictEqual(r.sourceArtistFilter, '1');
  assert.strictEqual(r.requiresApiKey, true);
});

test('elgoose needs no API key; phishnet does', () => {
  assert.strictEqual(resolveSource('Goose').requiresApiKey, false);
  assert.strictEqual(resolveSource('Phish').requiresApiKey, true);
});

test('casing and surrounding whitespace do not affect the match', () => {
  ['goose', 'GOOSE', '  Goose  ', 'gOOsE'].forEach((name) => {
    assert.strictEqual(resolveSource(name).id, 'elgoose', `${JSON.stringify(name)} must match`);
  });
});

test('an artist object is accepted as well as a bare name', () => {
  assert.strictEqual(resolveSource({ name: 'Goose' }).id, 'elgoose');
  assert.strictEqual(resolveSource('Goose').id, 'elgoose');
});

test('hasBandSource is the same decision as resolveSource', () => {
  assert.strictEqual(hasBandSource('Goose'), true);
  assert.strictEqual(hasBandSource('Phish'), true);
  assert.strictEqual(hasBandSource('The Strokes'), false);
  assert.strictEqual(hasBandSource(''), false);
});

// ── Name normalization reuses the app's one normalizer ────────────────

test('artistNameKey trims first, working around artistKeyFor\'s hyphen-then-trim order', () => {
  // artistKeyFor collapses whitespace to hyphens BEFORE it trims, so an
  // untrimmed '  Goose  ' becomes '-goose-' and would match nothing.
  assert.strictEqual(artistKeyFor({ name: '  Goose  ' }), '-goose-', 'documenting the quirk being guarded against');
  assert.strictEqual(artistNameKey('  Goose  '), 'goose');
});

test('artistNameKey is artistKeyFor\'s name branch, not a second normalizer', () => {
  // The registry must key off the same normalization the wishlist and the
  // song index use, or a link built from one would point at a key the other
  // never produces.
  ['Goose', 'Phish', 'The Disco Biscuits', 'Umphrey\'s McGee', 'STS9', 'Guster']
    .forEach((name) => {
      assert.strictEqual(artistNameKey(name), artistKeyFor({ name }), `${name} disagrees`);
    });
});

test('artistNameKey ignores an mbid, unlike artistKeyFor', () => {
  // artistKeyFor returns the mbid when handed an mbid-bearing object, which
  // is not what a *name* key should be — the same distinction
  // artistSlugFromName draws in lib/songIndex.js.
  assert.strictEqual(artistNameKey('Goose'), 'goose');
  assert.strictEqual(artistKeyFor({ name: 'Goose', mbid: 'abc-123' }), 'abc-123');
});

// ── The mbid guard ────────────────────────────────────────────────────

test('an unrecognized mbid falls back to the name match, it does not deny', () => {
  // An mbid the registry has not catalogued is evidence the mbid lists are
  // incomplete, not evidence of a different artist — so prefer-mbid-then-
  // fall-back-to-name is what happens.
  const r = resolveSource({ name: 'Goose', mbid: 'some-uncatalogued-mbid' });
  assert.strictEqual(r.id, 'elgoose');
  assert.strictEqual(r.matchedOn, 'name');
});

test('a denied mbid overrules a name match — the Dutch Goose guard', () => {
  // The mechanism, exercised against an injected entry because no real
  // colliding mbid was verifiable when this was written. This is the branch
  // that protects against the Dutch electro act also called Goose once
  // someone has its mbid to put in deniedMbids.
  const original = SETLIST_SOURCES.elgoose.deniedMbids.slice();
  try {
    SETLIST_SOURCES.elgoose.deniedMbids.push('dutch-goose-mbid');
    const r = resolveSource({ name: 'Goose', mbid: 'dutch-goose-mbid' });
    assert.strictEqual(r.id, SETLISTFM_SOURCE_ID);
    assert.strictEqual(r.isBandSource, false);
    assert.strictEqual(r.matchedOn, 'mbid-denied');
  } finally {
    SETLIST_SOURCES.elgoose.deniedMbids.length = 0;
    SETLIST_SOURCES.elgoose.deniedMbids.push(...original);
  }
});

test('a known-good mbid matches with matchedOn "mbid", not the heuristic', () => {
  const original = SETLIST_SOURCES.phishnet.mbids.slice();
  try {
    SETLIST_SOURCES.phishnet.mbids.push('phish-mbid');
    // Matched on the mbid even though the name is spelled unusually.
    const r = resolveSource({ name: 'Phish', mbid: 'phish-mbid' });
    assert.strictEqual(r.id, 'phishnet');
    assert.strictEqual(r.matchedOn, 'mbid');
  } finally {
    SETLIST_SOURCES.phishnet.mbids.length = 0;
    SETLIST_SOURCES.phishnet.mbids.push(...original);
  }
});

// ── The registry is data, so a third source is an entry not a refactor ─

test('every entry carries the full config shape', () => {
  Object.entries(SETLIST_SOURCES).forEach(([key, source]) => {
    assert.strictEqual(source.id, key, `${key}: id must equal its key`);
    assert.ok(source.label, `${key}: needs a label for the attribution line`);
    assert.ok(source.homeUrl?.startsWith('https://'), `${key}: needs an https homeUrl`);
    assert.ok(Array.isArray(source.nameKeys) && source.nameKeys.length, `${key}: needs nameKeys`);
    assert.ok(Array.isArray(source.mbids), `${key}: needs an mbids array`);
    assert.ok(Array.isArray(source.deniedMbids), `${key}: needs a deniedMbids array`);
    assert.strictEqual(typeof source.requiresApiKey, 'boolean', `${key}: requiresApiKey must be a boolean`);
    // Every claimed name must have an upstream identifier, or a fetch for
    // it would go out without one.
    source.nameKeys.forEach((nameKey) => {
      assert.ok(source.sourceArtistFilter[nameKey], `${key}: ${nameKey} has no sourceArtistFilter`);
    });
  });
});

test('every nameKey is already normalized, so it can actually match', () => {
  Object.values(SETLIST_SOURCES).forEach((source) => {
    source.nameKeys.forEach((nameKey) => {
      assert.strictEqual(artistNameKey(nameKey), nameKey, `${nameKey} is not in normalized form`);
    });
  });
});

test('no two sources claim the same artist name', () => {
  const seen = new Set();
  Object.values(SETLIST_SOURCES).forEach((source) => {
    source.nameKeys.forEach((nameKey) => {
      assert.ok(!seen.has(nameKey), `${nameKey} is claimed twice`);
      seen.add(nameKey);
    });
  });
});

test('setlistfm is not itself an entry — it is the fallback, not a band source', () => {
  assert.strictEqual(SETLIST_SOURCES[SETLISTFM_SOURCE_ID], undefined);
});

// ── Attribution labels ────────────────────────────────────────────────

test('sourceLabel and sourceHomeUrl read the stored id, not the artist', () => {
  // Attribution must reflect where the data actually came from. An artist
  // added to the registry later must not retroactively relabel a show's
  // old setlist.fm setlist as coming from El Goose.
  assert.strictEqual(sourceLabel('elgoose'), 'El Goose');
  assert.strictEqual(sourceLabel('phishnet'), 'Phish.net');
  assert.strictEqual(sourceLabel('setlistfm'), 'setlist.fm');
  assert.strictEqual(sourceHomeUrl('elgoose'), 'https://elgoose.net');
});

test('an absent or unknown setlistSource labels as setlist.fm', () => {
  // Every show document written before v5.33.0 has no setlistSource field.
  [undefined, null, '', 'setlistfm', 'something-removed-later'].forEach((id) => {
    assert.strictEqual(sourceLabel(id), 'setlist.fm', `${JSON.stringify(id)} must fall back`);
    assert.strictEqual(sourceHomeUrl(id), 'https://www.setlist.fm');
  });
});

// ── Summary ─────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
