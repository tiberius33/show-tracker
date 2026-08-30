/**
 * Privacy-gate tests for the public-page Netlify Functions, using a mocked
 * Firestore (no real credentials/network involved) since this is the most
 * safety-critical logic in the app: a bug here means private show data
 * leaking to the public internet.
 *
 * Run with: node lib/__tests__/publicPages.test.js
 *
 * Mocks firebase-admin/app and firebase-admin/firestore via Module._load
 * interception (same reason lib/__tests__/popupManager.test.js avoids a
 * real import — no bundler/env-var setup available for a plain `node` run)
 * and sets FIREBASE_* env vars so getDb() doesn't short-circuit to null.
 */

const assert = require('assert');
const Module = require('module');

process.env.FIREBASE_PRIVATE_KEY = 'fake';
process.env.FIREBASE_CLIENT_EMAIL = 'fake@example.com';
process.env.FIREBASE_PROJECT_ID = 'fake-project';

// ── In-memory fake Firestore ─────────────────────────────────────────────
let fakeData; // { collectionName: { docId: data } }

// `fakeData.users.{uid}.shows.{showId}` doubles as both the top-level
// `users` collection's doc data AND the source for its `shows` subcollection
// — collection() below supports exactly one level of subcollection nesting,
// which is all public-profile.js/public-show.js ever need
// (users/{uid}/shows[/{showId}]).
function makeFakeDb() {
  function collectionAt(name, subPath = []) {
    return {
      doc(id) {
        const fullPath = [...subPath, id];
        return {
          async get() {
            let data = fakeData[name];
            for (const seg of fullPath) data = data?.[seg];
            return { exists: !!data, id, data: () => data };
          },
          collection(subName) {
            return collectionAt(name, [...fullPath, subName]);
          },
        };
      },
      async where() {
        // Only used by sitemap.js — return a query-like object.
        const all = Object.entries(fakeData[name] || {})
          .filter(([, v]) => v.publicProfile === true)
          .map(([id, v]) => ({ id, data: () => v }));
        return { docs: all };
      },
      async get() {
        let container = fakeData[name];
        for (const seg of subPath) container = container?.[seg];
        const all = Object.entries(container || {}).map(([id, v]) => ({ id, data: () => v }));
        return { docs: all };
      },
    };
  }
  return { collection: (name) => collectionAt(name) };
}

const origLoad = Module._load;
Module._load = function (request, ...args) {
  if (request === 'firebase-admin/app') {
    return { getApps: () => [1], initializeApp: () => {}, cert: () => ({}) };
  }
  if (request === 'firebase-admin/firestore') {
    return { getFirestore: () => makeFakeDb() };
  }
  return origLoad.call(this, request, ...args);
};

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const publicProfileFn = require(path.join(ROOT, 'netlify/functions/public-profile'));
const publicShowFn = require(path.join(ROOT, 'netlify/functions/public-show'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  return (async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${name}`);
      console.error(`    ${e.message}`);
    }
  })();
}

async function run() {
  // ── Profile privacy gate ────────────────────────────────────────────
  await test('a handle with publicProfile: false returns 404, not the profile', async () => {
    fakeData = {
      handles: { janedoe: { uid: 'u1' } },
      userProfiles: { u1: { displayName: 'Jane', handle: 'janedoe', handleLower: 'janedoe', publicProfile: false } },
      users: {},
    };
    const res = await publicProfileFn.handler({ queryStringParameters: { handle: 'janedoe' } });
    assert.strictEqual(res.statusCode, 404);
    assert.ok(!res.body.includes('Jane'), 'private display name must not leak into a 404 response');
  });

  await test('a handle that does not exist at all returns the SAME 404 shape as a private profile', async () => {
    fakeData = { handles: {}, userProfiles: {}, users: {} };
    const notFoundHandle = await publicProfileFn.handler({ queryStringParameters: { handle: 'nobody' } });

    fakeData = {
      handles: { janedoe: { uid: 'u1' } },
      userProfiles: { u1: { displayName: 'Jane', handle: 'janedoe', handleLower: 'janedoe', publicProfile: false } },
      users: {},
    };
    const privateHandle = await publicProfileFn.handler({ queryStringParameters: { handle: 'janedoe' } });

    assert.strictEqual(notFoundHandle.statusCode, privateHandle.statusCode);
    // Bodies should read identically to an outside observer (both generic "not found").
    assert.strictEqual(notFoundHandle.body, privateHandle.body);
  });

  await test('a handle with publicProfile: true renders the profile with real content', async () => {
    fakeData = {
      handles: { janedoe: { uid: 'u1' } },
      userProfiles: { u1: { displayName: 'Jane', handle: 'janedoe', handleLower: 'janedoe', publicProfile: true } },
      users: {},
    };
    fakeData.users = { u1: { shows: {} } };
    const res = await publicProfileFn.handler({ queryStringParameters: { handle: 'janedoe' } });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.includes('Jane'), 'public profile should render the display name');
  });

  // ── Show page privacy gate + field stripping ────────────────────────
  const showFixture = {
    artist: 'Phish', venue: "Dick's", city: 'Commerce City, CO', date: '2023-07-14', rating: 9,
    comment: 'MY SECRET NOTE THAT MUST NEVER APPEAR PUBLICLY',
    setlist: [{ id: 's1', name: 'Wilson', rating: 8, comment: 'ANOTHER SECRET SONG NOTE' }],
    taggedFriendUids: ['friendPublic', 'friendPrivate'],
  };

  await test('a show under a PRIVATE profile is not reachable even with a correct showId', async () => {
    fakeData = {
      handles: { janedoe: { uid: 'u1' } },
      userProfiles: { u1: { displayName: 'Jane', publicProfile: false } },
      users: { u1: { shows: { show1: showFixture } } },
    };
    const res = await publicShowFn.handler({ queryStringParameters: { handle: 'janedoe', showId: 'show1' } });
    assert.strictEqual(res.statusCode, 404);
  });

  await test('a show under a PUBLIC profile renders but strips show.comment and song.comment', async () => {
    fakeData = {
      handles: { janedoe: { uid: 'u1' } },
      userProfiles: {
        u1: { displayName: 'Jane', publicProfile: true },
        friendPublic: { displayName: 'Public Friend', handle: 'pubfriend', handleLower: 'pubfriend', publicProfile: true },
        friendPrivate: { displayName: 'Private Friend', publicProfile: false },
      },
      users: { u1: { shows: { show1: showFixture } } },
    };

    const res = await publicShowFn.handler({ queryStringParameters: { handle: 'janedoe', showId: 'show1' } });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.includes('Wilson'), 'setlist song should render');
    assert.ok(!res.body.includes('MY SECRET NOTE'), 'show.comment must never appear in public HTML');
    assert.ok(!res.body.includes('ANOTHER SECRET SONG NOTE'), 'song.comment must never appear in public HTML');
    assert.ok(res.body.includes('Public Friend'), 'a tagged friend who opted their own profile public should be named');
    assert.ok(!res.body.includes('Private Friend'), 'a tagged friend who did NOT opt in must never be named');
  });

  Module._load = origLoad;
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
