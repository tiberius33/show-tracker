/**
 * admin-resync-setlists — walks every user's shows, finds the ones whose
 * artist resolves to a band source, and re-fetches their setlists from that
 * source.
 *
 * Shaped after admin-populate-setlist.js: admin-only, Authorization: Bearer
 * {idToken} verified against ADMIN_EMAILS, CORS headers, firebase-admin
 * server-side.
 *
 * POST body:
 *   {
 *     dryRun?: boolean,   // DEFAULT TRUE. See below.
 *     limit?: number,     // max shows to consider (default 50, max 1000)
 *     userId?: string,    // restrict to one account
 *     source?: string,    // restrict to one band source id
 *     delayMs?: number,   // override the inter-request delay
 *   }
 *
 * ── dryRun defaults to TRUE, on purpose ──────────────────────────────
 *
 * This is a data migration over show documents people care about. The
 * default has to be the harmless one, so that forgetting a parameter
 * reports a plan instead of rewriting a few thousand setlists. Writing
 * requires `dryRun: false` explicitly.
 *
 * A dry run writes NOTHING and returns, per show: user, show id, date,
 * venue, current source, current song count, incoming song count, and the
 * diff summary from lib/bandSetlistMerge — songs added, songs removed,
 * songs whose set or position changed, fields newly populated, and what
 * user-authored data was carried over. That summary is produced by the same
 * merge rule a real run would use, so the plan is not an approximation of
 * what would happen; it is what would happen.
 *
 * ── Rate limiting ─────────────────────────────────────────────────────
 *
 * elgoose.net and phish.net are small community projects and this walks
 * every show in the database. Two things keep that civil:
 *
 *   1. The cache in band-setlist.js means each distinct (source, date) is
 *      fetched upstream once, however many users attended that night. On a
 *      jam-band tracker that is a big multiplier — a Goose run at the Cap
 *      might be logged by dozens of users and costs one request.
 *   2. DEFAULT_DELAY_MS between requests regardless. 1200ms, which is
 *      under one request per second sustained. That is slower than it needs
 *      to be for correctness and deliberately so: there is no deadline on a
 *      backfill, and the polite ceiling costs nothing but wall-clock time.
 *      The delay is skipped entirely on a cache hit, since that never
 *      touches the upstream host.
 *
 * A Netlify function's execution window means a full backfill runs as
 * several `limit`-bounded invocations rather than one. That is what `limit`
 * and the returned `nextCursor` are for.
 */

const https = require('https');

const { mergeBandSetlist, describeSummary } = require('./lib/bandSetlistMergeRule');

const ADMIN_EMAILS = ['phillip.leonard@gmail.com'];

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Under one request per second sustained. See the header.
const DEFAULT_DELAY_MS = 1200;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

// ── The artist → source registry, mirrored for CommonJS ───────────────
//
// lib/setlistSources.js is the registry, but it is an ESM module written
// against the `@/lib` alias and this is a Netlify function with no build
// step to resolve it — the same situation festivalMatchRule.js exists for.
// This is deliberately the *minimum* mirror: the name keys and nothing
// else, because that is all a server-side walk over show documents needs
// (show docs store a plain artist string with no mbid, so the mbid branch
// of resolveSource can never fire here).
//
// KEEP IN STEP with SETLIST_SOURCES in lib/setlistSources.js. Adding a
// source or an act there means adding it here too.
const BAND_SOURCE_NAME_KEYS = {
  goose: { source: 'elgoose', artistId: 'goose' },
  phish: { source: 'phishnet', artistId: '1' },
};

// artistKeyFor's name branch, from lib/wishlist.js, with the same
// leading trim artistNameKey in lib/setlistSources.js applies — and for the
// same reason: artistKeyFor collapses whitespace to hyphens *before* it
// trims, so an untrimmed "  Goose  " becomes "-goose-" and matches nothing.
function artistNameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

function resolveBandSource(artist) {
  return BAND_SOURCE_NAME_KEYS[artistNameKey(artist)] || null;
}

function initFirebase() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (getApps().length > 0) return;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!privateKey || !clientEmail || !projectId) throw new Error('Firebase env vars not configured');
  initializeApp({ credential: cert({ privateKey, clientEmail, projectId }), projectId });
}

async function verifyAdmin(token) {
  initFirebase();
  const { getAuth } = require('firebase-admin/auth');
  const decoded = await getAuth().verifyIdToken(token);
  if (!ADMIN_EMAILS.includes(decoded.email)) throw new Error('Forbidden');
  return decoded;
}

/**
 * Calls our own band-setlist function rather than the adapters directly, so
 * the backfill goes through the same cache, the same TTL ceiling, the same
 * disambiguation and the same key handling as every other caller. One code
 * path to the upstream, not two.
 */
function fetchViaBandSetlistFunction({ baseUrl, source, artist, date, venue, artistId }) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ source, artist, date });
    if (venue) params.set('venue', venue);
    if (artistId) params.set('artistId', artistId);

    const url = new URL(`${baseUrl}/api/band-setlist?${params.toString()}`);
    const req = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}?${url.search.replace(/^\?/, '')}`,
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'MySetlists/5.33 (admin-resync)' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              cache: res.headers['x-cache'] || '',
              data: JSON.parse(data),
            });
          } catch (e) {
            reject(new Error(`Parse error: ${e.message}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = (event.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    await verifyAdmin(token);
  } catch {
    return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const body = JSON.parse(event.body || '{}');

  // `=== false` rather than a truthy read. `dryRun: false` is the ONLY
  // thing that turns writing on — a missing field, a null, an empty string
  // or the string "false" all leave it a dry run. Getting this backwards
  // would rewrite production setlists on a malformed request.
  const dryRun = body.dryRun !== false;

  const limit = Math.min(Math.max(Number.parseInt(body.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const onlyUserId = body.userId || null;
  const onlySource = body.source || null;
  const delayMs = Number.isFinite(Number(body.delayMs)) ? Math.max(0, Number(body.delayMs)) : DEFAULT_DELAY_MS;

  // Where to reach our own band-setlist function. Netlify sets URL/
  // DEPLOY_URL on the build; falls back to the production host.
  const baseUrl = (process.env.URL || process.env.DEPLOY_URL || 'https://mysetlists.net').replace(/\/$/, '');

  const { getFirestore } = require('firebase-admin/firestore');
  const db = getFirestore();

  const report = {
    dryRun,
    limit,
    delayMs,
    baseUrl,
    scannedUsers: 0,
    scannedShows: 0,
    bandSourceShows: 0,
    considered: 0,
    wouldChange: 0,
    changed: 0,
    unchanged: 0,
    // The interesting ones: a bad date, a side project the registry sends
    // to the wrong place, or an artist-name false positive (the Dutch
    // Goose). Reported separately rather than lumped in with "unchanged"
    // precisely because they are the list worth reading.
    sourceReturnedNothing: [],
    ambiguousDates: [],
    errors: [],
    shows: [],
    truncated: false,
    nextCursor: null,
  };

  try {
    const userDocs = onlyUserId
      ? [await db.collection('users').doc(onlyUserId).get()].filter((d) => d.exists)
      : (await db.collection('users').get()).docs;

    let processed = 0;

    for (const userDoc of userDocs) {
      if (processed >= limit) {
        report.truncated = true;
        report.nextCursor = userDoc.id;
        break;
      }

      report.scannedUsers++;
      const userId = userDoc.id;

      const showsSnap = await db.collection('users').doc(userId).collection('shows').get();

      for (const showDoc of showsSnap.docs) {
        if (processed >= limit) {
          report.truncated = true;
          report.nextCursor = userId;
          break;
        }

        report.scannedShows++;
        const show = showDoc.data();

        if (!show.artist || !show.date) continue;

        const resolved = resolveBandSource(show.artist);
        if (!resolved) continue;
        if (onlySource && resolved.source !== onlySource) continue;

        report.bandSourceShows++;
        processed++;
        report.considered++;

        const row = {
          userId,
          showId: showDoc.id,
          date: show.date,
          venue: show.venue || '',
          artist: show.artist,
          currentSource: show.setlistSource || 'setlistfm',
          incomingSource: resolved.source,
          currentSongCount: (show.setlist || []).length,
          incomingSongCount: 0,
          cache: '',
          summary: null,
          note: '',
        };

        try {
          const { statusCode, cache, data } = await fetchViaBandSetlistFunction({
            baseUrl,
            source: resolved.source,
            artist: show.artist,
            date: show.date,
            venue: show.venue,
            artistId: resolved.artistId,
          });

          row.cache = cache;

          if (statusCode !== 200 || !data || data.ok === false) {
            const message = (data && data.message) || `HTTP ${statusCode}`;
            row.note = `source error: ${message}`;
            report.sourceReturnedNothing.push({ ...row });
            report.errors.push({ userId, showId: showDoc.id, date: show.date, message });
          } else {
            const incoming = Array.isArray(data.songs) ? data.songs : [];
            row.incomingSongCount = incoming.length;

            if (data.ambiguous) {
              row.note = data.message || 'more than one show on this date';
              report.ambiguousDates.push({ ...row, candidates: data.candidates || [] });
            }

            const { setlist, changed, summary } = mergeBandSetlist(show.setlist || [], incoming);
            row.summary = summary;

            if (!changed) {
              // The write-nothing rule. An empty incoming setlist leaves
              // the document alone, whether this is a dry run or not.
              row.note = row.note || 'source returned no songs — leaving the existing setlist alone';
              report.sourceReturnedNothing.push({ ...row });
              report.unchanged++;
            } else if (dryRun) {
              report.wouldChange++;
              console.log(`[RESYNC dry] ${userId}/${showDoc.id} ${show.artist} ${show.date} — ${describeSummary(summary)}`);
            } else {
              await showDoc.ref.update({
                setlist,
                setlistSource: resolved.source,
                sourceShowId: data.sourceShowId || '',
                sourcePermalink: data.sourcePermalink || '',
                setlistNotes: data.setlistNotes || '',
                setlistFetchedAt: new Date().toISOString(),
                isManual: false,
                ...(show.tour ? {} : (data.tour ? { tour: data.tour } : {})),
              });
              report.changed++;
              console.log(`[RESYNC write] ${userId}/${showDoc.id} ${show.artist} ${show.date} — ${describeSummary(summary)}`);
            }
          }
        } catch (err) {
          row.note = `fetch failed: ${err.message}`;
          report.errors.push({ userId, showId: showDoc.id, date: show.date, message: err.message });
        }

        report.shows.push(row);

        // Only pause when we actually went out to the upstream host. A
        // cache hit never touched elgoose.net or phish.net, so there is
        // nothing to be polite about.
        if (row.cache !== 'HIT' && delayMs > 0) await sleep(delayMs);
      }

      if (report.truncated) break;
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(report) };
  } catch (err) {
    console.error('[RESYNC] Error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message, partial: report }),
    };
  }
};
