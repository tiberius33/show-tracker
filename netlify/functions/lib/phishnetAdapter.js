/**
 * netlify/functions/lib/phishnetAdapter.js
 *
 * phish.net API v5 — the community archive for Phish, same lineage as
 * elgoose.net and the same richness, plus show-level setlist notes and
 * official gap data going back to 1983. Free, but key-gated.
 *
 *   GET https://api.phish.net/v5/setlists/showdate/<YYYY-MM-DD>.json?apikey=…
 *
 * Same three-node envelope as elgoose.net, `{ error, error_message, data }`,
 * and the same flat array of one-row-per-song `data` with set membership on
 * the row rather than nested — but with ONE difference the docs call out
 * specifically: `error` here is a boolean `false`, not the number `0`.
 *
 * That difference is why readEnvelope below tests it explicitly, against
 * both spellings, rather than relying on truthiness. `0` and `false` are
 * both falsy in JavaScript so a truthy check happens to work today for
 * both — which is exactly what makes it a trap: the day either API starts
 * returning `"0"` or `"false"` as a string, a truthy check silently treats
 * a hard failure as a successful empty result and the merge rules dutifully
 * write nothing while reporting success. Tested for real instead.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ THE FIELD NAMES BELOW ARE UNVERIFIED.                               │
 * │                                                                     │
 * │ Transcribed from the documented row shape, NOT read off a live      │
 * │ response: the branch this was written on had no network route to    │
 * │ api.phish.net or docs.phish.net (the egress proxy refused CONNECT   │
 * │ with a 403), and no PHISHNET_API_KEY to call it with even if it     │
 * │ had. Check this map against one real response before trusting it —  │
 * │ 1997-11-22 (Hampton) is a good one to eyeball, and a multi-encore   │
 * │ show is worth checking too, to confirm how `set` spells a second    │
 * │ encore.                                                             │
 * │                                                                     │
 * │ Every upstream key is named exactly once, in FIELDS below, so a     │
 * │ correction is a one-line edit that touches nothing else.            │
 * └─────────────────────────────────────────────────────────────────────┘
 */

const https = require('https');
const { buildSetlist, pickSetLabel, setSortKey, toBool, toIntOrNull } = require('./bandSetlistShape');

const HOSTNAME = 'api.phish.net';
const API_PATH = '/v5/setlists/showdate';

const USER_AGENT = 'MySetlists/5.33 (+https://mysetlists.net)';
const REQUEST_TIMEOUT_MS = 10000;

// ── The one place an upstream key name appears ────────────────────────
const FIELDS = {
  showId: 'showid',
  showDate: 'showdate',
  permalink: 'permalink',
  venue: 'venue',
  city: 'city',
  state: 'state',
  country: 'country',
  tourName: 'tourname',
  setlistNotes: 'setlistnotes',
  set: 'set',
  position: 'position',
  songName: 'song',
  songId: 'songid',
  transition: 'transmark',
  footnote: 'footnote',
  gap: 'gap',
  jamchart: 'isjamchart',
  jamchartNote: 'jamchart_description',
  soundcheck: 'soundcheck',
  artistId: 'artistid',
};

function get(row, field) {
  return row ? row[FIELDS[field]] : undefined;
}

/**
 * phish.net packs set identity into a single `set` value rather than the
 * separate settype/setnumber pair elgoose.net uses. It is a short code:
 * '1', '2', '3' for regular sets, 'e' for the encore, and 'e2' (or '2'
 * within an encore context) for a second one.
 *
 * Split into the (type, number) pair pickSetLabel and setSortKey both take,
 * so the canonical-label logic stays in one place for every source. A show
 * with two encores must come out 'Encore' then 'Encore II' — which is what
 * makes the e/e2 spelling worth parsing rather than passing through.
 */
function splitSetCode(raw) {
  const code = String(raw == null ? '' : raw).trim().toLowerCase();

  if (!code) return { setType: 'set', setNumber: 1 };

  if (code.startsWith('soundcheck') || code === 'sc') {
    return { setType: 'soundcheck', setNumber: 1 };
  }

  if (code.startsWith('e')) {
    const n = Number.parseInt(code.slice(1), 10);
    return { setType: 'encore', setNumber: Number.isFinite(n) && n > 0 ? n : 1 };
  }

  const n = Number.parseInt(code, 10);
  return { setType: 'set', setNumber: Number.isFinite(n) && n > 0 ? n : 1 };
}

function fetchShowDate(date, apiKey) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ apikey: apiKey });
    const options = {
      hostname: HOSTNAME,
      path: `${API_PATH}/${encodeURIComponent(date)}.json?${params.toString()}`,
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`Failed to parse phish.net response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('phish.net request timed out'));
    });
    req.end();
  });
}

/**
 * v5's `error` node is a boolean `false` on success, where elgoose.net's is
 * the number 0. Both spellings are accepted here and both are tested for
 * explicitly — see the module header for why this is not a truthy check.
 */
function readEnvelope(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'Empty response from phish.net', rows: [] };
  }

  const raw = payload.error;
  const failed = raw === true || raw === 'true' || Number(raw) === 1;

  if (failed) {
    return { ok: false, message: payload.error_message || 'phish.net reported an error', rows: [] };
  }

  const rows = Array.isArray(payload.data) ? payload.data : [];
  return { ok: true, message: '', rows };
}

function groupRowsByShow(rows) {
  const byShow = new Map();
  for (const row of rows) {
    const key = String(get(row, 'showId') || get(row, 'permalink') || get(row, 'venue') || 'unknown');
    if (!byShow.has(key)) byShow.set(key, []);
    byShow.get(key).push(row);
  }
  return Array.from(byShow.values());
}

function mapShow(rows) {
  const first = rows[0] || {};

  const mapped = rows.map((row) => {
    const { setType, setNumber } = splitSetCode(get(row, 'set'));
    const isSoundcheck = setType === 'soundcheck' || toBool(get(row, 'soundcheck'));
    const gap = toIntOrNull(get(row, 'gap'));

    return {
      set: isSoundcheck ? null : pickSetLabel(setType, setNumber),
      setSortKey: setSortKey(setType, setNumber),
      position: toIntOrNull(get(row, 'position')) || 0,
      name: get(row, 'songName'),
      transition: get(row, 'transition'),
      footnote: get(row, 'footnote'),
      jamchart: get(row, 'jamchart'),
      jamchartNote: get(row, 'jamchartNote'),
      gap,
      // phish.net's setlist row names no covered artist either — cover
      // attribution lives on its song pages, not the setlist. Left null
      // rather than guessed; see the same note in elgooseAdapter.js.
      cover: null,
      // No `debut` from this source, for the reason spelled out in
      // elgooseAdapter.js: gap 0 means "played at the previous show", not
      // "never played before", and inferring a debut from it would be
      // guessing. `sourceGap` carries the real number instead.
      debut: false,
      songId: get(row, 'songId'),
      songSlug: '',
    };
  });

  const { songs, droppedSoundcheckCount } = buildSetlist(mapped);

  return {
    source: 'phishnet',
    songs,
    droppedSoundcheckCount,
    showDate: String(get(first, 'showDate') || ''),
    venue: String(get(first, 'venue') || ''),
    city: String(get(first, 'city') || ''),
    state: String(get(first, 'state') || ''),
    country: String(get(first, 'country') || ''),
    tour: String(get(first, 'tourName') || ''),
    sourceShowId: String(get(first, 'showId') || ''),
    sourcePermalink: String(get(first, 'permalink') || ''),
    // The show-level prose phish.net keeps and setlist.fm does not. Stored
    // on the show document as `setlistNotes` and rendered under the setlist.
    setlistNotes: String(get(first, 'setlistNotes') || '').trim(),
    sourceArtistId: String(get(first, 'artistId') || ''),
  };
}

/**
 * fetchSetlists(date, { apiKey, artistId }) -> { ok, message, shows: [...] }
 *
 * `artistId` filters to one act where the caller knows which — phish.net's
 * API is keyed by artistid and a date can carry rows for more than one of
 * the acts it covers. Omitted means "don't filter", which is the API's own
 * default of Phish itself.
 */
async function fetchSetlists(date, { apiKey, artistId } = {}) {
  if (!apiKey) {
    // Never reached in practice — band-setlist.js returns a 503 before
    // calling in — but an adapter that quietly fetched without a key would
    // be a worse failure than one that says so.
    return { ok: false, message: 'phish.net API key not configured', shows: [] };
  }

  const { statusCode, data } = await fetchShowDate(date, apiKey);

  if (statusCode !== 200) {
    return { ok: false, message: `phish.net returned HTTP ${statusCode}`, shows: [] };
  }

  const envelope = readEnvelope(data);
  if (!envelope.ok) return { ok: false, message: envelope.message, shows: [] };

  const rows = artistId
    ? envelope.rows.filter((row) => String(get(row, 'artistId') || '') === String(artistId))
    : envelope.rows;

  const shows = groupRowsByShow(rows)
    .map(mapShow)
    .filter((show) => show.songs.length > 0 || show.droppedSoundcheckCount > 0);

  return { ok: true, message: '', shows };
}

module.exports = { FIELDS, fetchSetlists, mapShow, readEnvelope, splitSetCode, groupRowsByShow };
