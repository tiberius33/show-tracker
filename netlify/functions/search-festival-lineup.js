// netlify/functions/search-festival-lineup.js
//
// "Who played this festival?" — returns every distinct artist/date setlist
// logged at a venue inside a date window, so the app can offer them as a
// bulk-selectable lineup.
//
// WHY THIS SHAPE: setlist.fm has no first-class "festival" entity. Its
// /search/setlists endpoint takes artistName/artistMbid, venueName,
// venueId, cityName and year — there is no festival parameter and no
// date-range parameter (only an exact `date`). What festivals *do* have is
// a venue: a multi-day festival's sets are logged individually per
// artist/date at the festival's grounds ("Great Stage Park", "Empire Polo
// Club", ...), and many festival grounds are also registered under the
// festival's own name. So a festival lookup here is:
//
//   1. /search/venues?name=<query>  -> candidate venues for the typed name
//   2. /search/setlists?venueId=<id>&year=<year> -> every artist that
//      played there that year, all artists, paged
//   3. filter to the requested date window and collapse to one entry per
//      artist+date (an artist with two sets on one day is one entry)
//
// Step 1 is skipped when the caller passes an explicit venueId. If venue
// resolution finds nothing, we still try a plain venueName search before
// giving up, since /search/setlists matches venue names loosely. An empty
// result is a 200 with `results: []`, never an error — the caller falls
// back to picking from the user's own already-logged shows.
//
// Caching reuses the same `setlistCache` Firestore collection as
// search-setlists.js (different key namespace), with the same
// graceful-degradation-if-env-vars-missing behaviour.

const https = require('https');
const crypto = require('crypto');

const SETLISTFM_API_KEY = process.env.SETLISTFM_API_KEY || 'VmDr8STg4UbyNE7Jgiubx2D_ojbliDuoYMgQ';
const CORS_HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

// A festival weekend is a handful of pages at 20 setlists each; cap the
// work so one lookup can't fan out into dozens of upstream calls.
const MAX_SETLIST_PAGES = 5;
const MAX_VENUE_CANDIDATES = 3;
const CACHE_TTL_HOURS = 24;

function getDb() {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!privateKey || !clientEmail || !projectId) return null;
  try {
    const { getApps, initializeApp, cert } = require('firebase-admin/app');
    if (!getApps().length) {
      initializeApp({ credential: cert({ privateKey, clientEmail, projectId }), projectId });
    }
    const { getFirestore } = require('firebase-admin/firestore');
    return getFirestore();
  } catch (e) {
    console.warn('[CACHE] Firebase init failed:', e.message);
    return null;
  }
}

function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.setlist.fm',
      path,
      method: 'GET',
      headers: {
        'x-api-key': SETLISTFM_API_KEY,
        Accept: 'application/json',
        'User-Agent': 'ShowTrackerApp/1.0',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          // setlist.fm answers "nothing found" with a non-JSON 404 body on
          // some endpoints — treat that as an empty result, not a crash.
          resolve({ status: res.statusCode, data: null });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// setlist.fm returns dd-MM-yyyy; everything in this app stores yyyy-MM-dd.
function toIsoDate(eventDate) {
  const parts = (eventDate || '').split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function countSongs(setlist) {
  return (setlist?.sets?.set || []).reduce((acc, s) => acc + (s.song?.length || 0), 0);
}

async function searchVenues(name) {
  const params = new URLSearchParams({ name, p: '1' });
  const { status, data } = await fetchJSON(`/rest/1.0/search/venues?${params}`);
  if (status !== 200 || !data?.venue?.length) return [];
  return data.venue.map(v => ({
    id: v.id,
    name: v.name || '',
    city: v.city?.name || '',
    state: v.city?.stateCode || v.city?.state || '',
    country: v.city?.country?.name || '',
  }));
}

// Pages through one venue's setlists for a year. `venueId` is preferred;
// `venueName` is the looser fallback when nothing resolved.
async function fetchSetlists({ venueId, venueName, year }) {
  const collected = [];
  for (let page = 1; page <= MAX_SETLIST_PAGES; page++) {
    const params = new URLSearchParams({ p: String(page) });
    if (venueId) params.set('venueId', venueId);
    else if (venueName) params.set('venueName', venueName);
    if (year) params.set('year', year);

    const { status, data } = await fetchJSON(`/rest/1.0/search/setlists?${params}`);
    if (status !== 200 || !data?.setlist?.length) break;
    collected.push(...data.setlist);

    const total = data.total || 0;
    const perPage = data.itemsPerPage || 20;
    if (page * perPage >= total) break;
  }
  return collected;
}

// One entry per artist+date. Prefers the richest setlist when an artist has
// two logged sets on the same day (a main-stage set and a late-night one
// both count as "they played" — the fuller one is the better import).
function toLineup(setlists, { from, to }) {
  const byKey = new Map();

  setlists.forEach(sl => {
    const artist = sl.artist?.name || '';
    const date = toIsoDate(sl.eventDate);
    if (!artist || !date) return;
    if (from && date < from) return;
    if (to && date > to) return;

    const key = `${artist.toLowerCase()}|${date}`;
    const songCount = countSongs(sl);
    const existing = byKey.get(key);
    if (existing && existing.songCount >= songCount) return;

    byKey.set(key, {
      setlistfmId: sl.id,
      artist,
      artistMbid: sl.artist?.mbid || null,
      date,
      venue: sl.venue?.name || '',
      city: sl.venue?.city?.name || '',
      country: sl.venue?.city?.country?.name || '',
      tour: sl.tour?.name || null,
      songCount,
      sets: sl.sets || null,
    });
  });

  return Array.from(byKey.values()).sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.artist.localeCompare(b.artist))
  );
}

// Exported for lib/__tests__/festivalLineup.test.js — the grouping is the
// part with real logic in it, and it's pure.
exports._toLineup = toLineup;
exports._toIsoDate = toIsoDate;

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { name = '', venueId = '', year = '', from = '', to = '' } = event.queryStringParameters || {};
  if (!name.trim() && !venueId) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'A festival/venue name or venueId is required' }) };
  }

  // Derive the year from the date window when the caller didn't pass one —
  // setlist.fm has no date-range filter, so `year` is what keeps the paged
  // fetch bounded to the festival's own edition.
  const effectiveYear = year || (from || to).slice(0, 4) || '';

  const cacheKey = crypto
    .createHash('md5')
    .update(JSON.stringify({ n: name.toLowerCase().trim(), v: venueId, y: effectiveYear, f: from, t: to }))
    .digest('hex');
  const db = getDb();

  if (db) {
    try {
      const snap = await db.collection('setlistCache').doc(`festival_${cacheKey}`).get();
      if (snap.exists) {
        const cached = snap.data();
        if ((cached.expiresAt?.toMillis?.() || 0) > Date.now()) {
          return { statusCode: 200, headers: { ...CORS_HEADERS, 'X-Cache': 'HIT' }, body: cached.response };
        }
      }
    } catch (e) {
      console.warn('[CACHE] Read error:', e.message);
    }
  }

  try {
    let venues = [];
    if (venueId) {
      venues = [{ id: venueId, name: name || '', city: '', state: '', country: '' }];
    } else {
      venues = (await searchVenues(name.trim())).slice(0, MAX_VENUE_CANDIDATES);
    }

    let setlists = [];
    for (const venue of venues) {
      setlists.push(...await fetchSetlists({ venueId: venue.id, year: effectiveYear }));
    }

    // Nothing resolved by venue id — try the looser name match before
    // reporting an empty lineup.
    if (setlists.length === 0 && name.trim()) {
      setlists = await fetchSetlists({ venueName: name.trim(), year: effectiveYear });
    }

    const results = toLineup(setlists, { from, to });
    const responseBody = JSON.stringify({ venues, results, total: results.length });

    if (db) {
      const { Timestamp } = require('firebase-admin/firestore');
      db.collection('setlistCache').doc(`festival_${cacheKey}`).set({
        response: responseBody,
        fetchedAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000)),
        ttlHours: CACHE_TTL_HOURS,
        queryParams: { name: name.toLowerCase().trim(), venueId, year: effectiveYear, from, to },
        hitCount: 0,
      }).catch(e => console.warn('[CACHE] Write error:', e.message));
    }

    return { statusCode: 200, headers: { ...CORS_HEADERS, 'X-Cache': 'MISS' }, body: responseBody };
  } catch (e) {
    console.error('[search-festival-lineup] failed:', e.message);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Request failed', details: e.message }) };
  }
};
