/**
 * band-setlist — one date-addressed setlist fetch, whichever band source
 * owns the artist.
 *
 *   GET /api/band-setlist?source=elgoose&artist=Goose&date=2025-07-18
 *   GET /api/band-setlist?source=phishnet&artist=Phish&date=1997-11-22&venue=Hampton%20Coliseum
 *
 * `source` is a band-source id from lib/setlistSources.js ('elgoose' or
 * 'phishnet'). The per-source fetch and field mapping live in
 * netlify/functions/lib/{elgoose,phishnet}Adapter.js, one file per source,
 * so adding Grateful Dead later is a new adapter plus a new branch in
 * ADAPTERS below and nothing else.
 *
 * ── Why this is so much smaller than the setlist.fm path ─────────────
 *
 * Both APIs are addressable by show date. That is the real win. Finding one
 * night on setlist.fm means scanForMissingSetlists's loop: up to three
 * pages × three artist-name variants, each page 20 results, reversing
 * setlist.fm's DD-MM-YYYY into YYYY-MM-DD to compare, hoping the night is
 * in there somewhere. Here it is one request for one date, and either the
 * archive has the show or it doesn't.
 *
 * ── Caching ───────────────────────────────────────────────────────────
 *
 * Mirrors search-setlists.js: Firestore-backed, age-derived TTL, X-Cache:
 * HIT|MISS|STALE, stale-on-upstream-failure fallback, hit counting, and the
 * same getDb() lazy-init-with-graceful-degradation — if the Firebase env
 * vars are missing the function still works, just uncached.
 *
 * The one deliberate difference is the TTL ceiling. determineTtlHours in
 * search-setlists.js gives a show more than two years old a 7-day TTL,
 * which is right for setlist.fm and wrong here: phish.net's docs are
 * explicit that you should cache locally but for no longer than 24 hours,
 * because setlists get corrected after review. A corrected Phish setlist
 * should reach the app the next day, not the next week — so the ceiling is
 * 24h for both sources, since elgoose.net is a reviewed archive too and
 * there is no reason to treat it differently.
 *
 * A separate collection (`bandSetlistCache`) keyed by source + artist +
 * date, so it cannot collide with `setlistCache`.
 *
 * ── The API key ───────────────────────────────────────────────────────
 *
 * PHISHNET_API_KEY, read server-side only, with NO `||` literal fallback.
 * search-setlists.js and admin-populate-setlist.js both do
 * `process.env.SETLISTFM_API_KEY || '<a real key>'`, which puts a live key
 * in the repository and in the function bundle. That pattern is not
 * repeated here: a missing key returns a 503 saying so. elgoose.net needs
 * no key at all.
 */

const crypto = require('crypto');

const elgooseAdapter = require('./lib/elgooseAdapter');
const phishnetAdapter = require('./lib/phishnetAdapter');

const CORS_HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

const CACHE_COLLECTION = 'bandSetlistCache';

// phish.net's documented ceiling, applied to both sources. See the header.
const MAX_TTL_HOURS = 24;

const ADAPTERS = {
  elgoose: {
    requiresApiKey: false,
    fetch: (date) => elgooseAdapter.fetchSetlists(date),
  },
  phishnet: {
    requiresApiKey: true,
    apiKeyEnvVar: 'PHISHNET_API_KEY',
    fetch: (date, { apiKey, artistId }) => phishnetAdapter.fetchSetlists(date, { apiKey, artistId }),
  },
};

// --- Firebase Admin (lazy init, graceful degradation if env vars missing) ---
// Verbatim from search-setlists.js, deliberately: the point of that pattern
// is that a cache is an optimization and its absence must not be an outage.

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

// --- Cache helpers ---

function buildCacheKey(source, artist, date, venue) {
  const normalized = JSON.stringify({
    s: (source || '').toLowerCase().trim(),
    a: (artist || '').toLowerCase().trim(),
    d: (date || '').trim(),
    v: (venue || '').toLowerCase().trim(),
  });
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * TTL in hours for one show date. Same shape as search-setlists.js's
 * determineTtlHours — shorter for shows that haven't happened yet or only
 * just did, longer for settled history — but capped at MAX_TTL_HOURS rather
 * than running out to the 7-day tier.
 */
function determineTtlHours(showDate) {
  const d = new Date(`${showDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 1;

  const now = Date.now();
  if (d.getTime() > now) return 1; // upcoming show — the setlist isn't written yet

  const monthsAgo = (now - d.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsAgo < 1) return 6; // still being reviewed and corrected
  return MAX_TTL_HOURS;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// --- Handler ---

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { source, artist, date, venue, artistId } = event.queryStringParameters || {};

  if (!source || !ADAPTERS[source]) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: `Unknown source. Expected one of: ${Object.keys(ADAPTERS).join(', ')}` }),
    };
  }
  if (!date || !DATE_RE.test(date)) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'A date in YYYY-MM-DD form is required' }) };
  }

  const adapter = ADAPTERS[source];

  // The key, if this source needs one. No literal fallback — a missing key
  // is a configuration problem and says so, rather than silently working
  // off a credential committed to the repository.
  let apiKey = '';
  if (adapter.requiresApiKey) {
    apiKey = process.env[adapter.apiKeyEnvVar] || '';
    if (!apiKey) {
      console.warn(`[BAND-SETLIST] ${adapter.apiKeyEnvVar} is not set — refusing to fetch from ${source}`);
      return {
        statusCode: 503,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: `${source} is not configured on this deployment`,
          details: `${adapter.apiKeyEnvVar} is not set. Add it as a Netlify environment variable.`,
        }),
      };
    }
  }

  const label = `${source} ${artist || '?'} ${date}`;
  const cacheKey = buildCacheKey(source, artist, date, venue);
  const db = getDb();
  let staleDoc = null;

  // 1. Check cache
  if (db) {
    try {
      const snap = await db.collection(CACHE_COLLECTION).doc(cacheKey).get();
      if (snap.exists) {
        const cached = snap.data();
        const expired = (cached.expiresAt?.toMillis?.() || 0) < Date.now();
        if (!expired) {
          const newHits = (cached.hitCount || 0) + 1;
          console.log(`[CACHE HIT]  ${label} — hits: ${newHits}, ttl: ${cached.ttlHours}h`);
          snap.ref.update({ hitCount: newHits }).catch(() => {});
          return { statusCode: 200, headers: { ...CORS_HEADERS, 'X-Cache': 'HIT' }, body: cached.response };
        }
        console.log(`[CACHE EXPIRED] ${label}`);
        staleDoc = cached; // hold onto stale data for API failure fallback
      } else {
        console.log(`[CACHE MISS] ${label}`);
      }
    } catch (e) {
      console.warn('[CACHE] Read error:', e.message);
    }
  }

  // 2. Fetch from the band source
  try {
    const result = await adapter.fetch(date, { apiKey, artistId });

    if (!result.ok) {
      // An upstream that answered and said "no" is not an outage — it is an
      // answer, and the caller's merge rules treat an empty setlist as
      // "change nothing". Reported as 200 with `ok: false` rather than as a
      // 5xx so a bad date doesn't look like a broken function.
      const body = JSON.stringify({
        ok: false,
        source,
        date,
        message: result.message || 'Source returned an error',
        shows: [],
        songs: [],
      });
      return { statusCode: 200, headers: { ...CORS_HEADERS, 'X-Cache': 'MISS' }, body };
    }

    const payload = selectShow(result.shows, { source, date, venue });
    const responseBody = JSON.stringify(payload);

    // 3. Write to cache on success.
    //
    // Only when the source actually returned a show. Caching an empty
    // result for 24h would mean a show added to the archive tomorrow stays
    // invisible to the app for a day — and an empty result is cheap to
    // re-ask for, being one request rather than a nine-request search loop.
    if (db && payload.songs.length > 0) {
      const ttlHours = determineTtlHours(date);
      const { Timestamp } = require('firebase-admin/firestore');
      db.collection(CACHE_COLLECTION).doc(cacheKey).set({
        response: responseBody,
        fetchedAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + ttlHours * 3600 * 1000)),
        ttlHours,
        queryParams: {
          source,
          artistName: (artist || '').toLowerCase().trim(),
          date,
          venueName: (venue || '').toLowerCase().trim(),
        },
        hitCount: 0,
      }).then(() => {
        console.log(`[CACHE WRITE] ${label} → TTL: ${ttlHours}h`);
      }).catch(e => {
        console.warn('[CACHE] Write error:', e.message);
      });
    }

    return { statusCode: 200, headers: { ...CORS_HEADERS, 'X-Cache': 'MISS' }, body: responseBody };
  } catch (e) {
    // 4. Upstream failure — serve stale cache if we have any.
    //
    // This is the only path that serves data older than the 24h ceiling,
    // and it says so in the header. Better a day-old setlist than none
    // while a volunteer-run archive is down.
    if (staleDoc) {
      const ageHours = Math.round((Date.now() - (staleDoc.fetchedAt?.toMillis?.() || 0)) / 3600000);
      console.log(`[CACHE STALE] ${label} — source down, serving stale (age: ${ageHours}h)`);
      return { statusCode: 200, headers: { ...CORS_HEADERS, 'X-Cache': 'STALE' }, body: staleDoc.response };
    }
    console.warn(`[BAND-SETLIST] ${label} failed:`, e.message);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, source, date, message: e.message, shows: [], songs: [] }),
    };
  }
};

/**
 * Picks which show to return when a date carries more than one — a festival
 * day, or a two-a-day.
 *
 * Disambiguates on venue name when the caller supplied one, and SAYS SO in
 * the response either way rather than picking the first silently:
 * `ambiguous: true` plus a `candidates` list of every show on the date, so
 * a caller that got the wrong one can tell, and a human reading the
 * backfill's dry-run output can see it happened.
 */
function selectShow(shows, { source, date, venue }) {
  const base = { ok: true, source, date, ambiguous: false, candidates: [], message: '' };

  if (!shows || shows.length === 0) {
    return { ...base, songs: [], shows: [], message: `No show on ${date}` };
  }

  const candidates = shows.map((s) => ({
    venue: s.venue,
    city: s.city,
    state: s.state,
    sourceShowId: s.sourceShowId,
    sourcePermalink: s.sourcePermalink,
    songCount: s.songs.length,
  }));

  let chosen = shows[0];
  let ambiguous = false;
  let message = '';

  if (shows.length > 1) {
    ambiguous = true;
    const wanted = (venue || '').toLowerCase().trim();
    const matched = wanted
      ? shows.find((s) => {
          const v = (s.venue || '').toLowerCase().trim();
          return v && (v === wanted || v.includes(wanted) || wanted.includes(v));
        })
      : null;

    if (matched) {
      chosen = matched;
      message = `${shows.length} shows on ${date}; matched on venue "${chosen.venue}"`;
    } else {
      message = wanted
        ? `${shows.length} shows on ${date} and none matched venue "${venue}" — returning "${chosen.venue}". Check candidates.`
        : `${shows.length} shows on ${date} and no venue was supplied — returning "${chosen.venue}". Check candidates.`;
    }
  }

  return {
    ...base,
    ambiguous,
    candidates,
    message,
    // The normalized setlist, which is what callers actually want.
    songs: chosen.songs,
    droppedSoundcheckCount: chosen.droppedSoundcheckCount,
    // Show-level fields, stored on the show document.
    venue: chosen.venue,
    city: chosen.city,
    state: chosen.state,
    country: chosen.country,
    tour: chosen.tour,
    sourceShowId: chosen.sourceShowId,
    sourcePermalink: chosen.sourcePermalink,
    setlistNotes: chosen.setlistNotes,
  };
}

// Exported for the unit tests, which exercise selectShow's disambiguation
// without standing up the handler.
exports.selectShow = selectShow;
exports.determineTtlHours = determineTtlHours;
exports.buildCacheKey = buildCacheKey;
exports.MAX_TTL_HOURS = MAX_TTL_HOURS;
