/**
 * netlify/functions/lib/elgooseAdapter.js
 *
 * elgoose.net — the community archive for Goose, running the Songfish
 * engine. Free, public, no key and no auth.
 *
 *   GET https://elgoose.net/api/v2/setlists/showdate/<YYYY-MM-DD>.json
 *
 * The response is a three-node envelope, `{ error, error_message, data }`,
 * where `error` is 0 or 1 (a number, not a boolean — phish.net's v5 differs
 * here, which is why each adapter tests its own error node rather than
 * sharing one truthiness check) and `data` is a FLAT array of song rows,
 * one row per song, with no nested set structure. Set and encore membership
 * lives on each row as `settype` + `setnumber`.
 *
 * Being date-addressable is the whole point. One request per show date, no
 * paging, no DD-MM-YYYY reversal, and none of the three-page /
 * three-name-variant match loop scanForMissingSetlists has to run against
 * setlist.fm's search to find a single night.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ THE FIELD NAMES BELOW ARE UNVERIFIED.                               │
 * │                                                                     │
 * │ They are transcribed from the documented row shape, NOT read off a  │
 * │ live response — the branch this was written on had no network route │
 * │ to elgoose.net (the egress proxy refused CONNECT with a 403), so no │
 * │ real response could be fetched and printed. Songfish's own docs are │
 * │ thin, so treat this map as a best-effort starting point.            │
 * │                                                                     │
 * │ Every upstream key this adapter reads is named exactly once, in     │
 * │ FIELDS just below, for precisely that reason: correcting a          │
 * │ mis-transcribed key is a one-line edit there and touches nothing    │
 * │ else. Check it against one real response before trusting the        │
 * │ mapping — elgoose.net/api/v2/setlists/showdate/2023-12-30.json      │
 * │ (Goose at Radio City) is a good one to eyeball.                     │
 * └─────────────────────────────────────────────────────────────────────┘
 */

const https = require('https');
const { buildSetlist, pickSetLabel, setSortKey, toBool, toIntOrNull } = require('./bandSetlistShape');

const HOSTNAME = 'elgoose.net';
const API_PATH = '/api/v2/setlists/showdate';

// A real User-Agent identifying the app, as the existing functions do. This
// is a volunteer-run archive; an anonymous scraper is a bad neighbour.
const USER_AGENT = 'MySetlists/5.33 (+https://mysetlists.net)';

const REQUEST_TIMEOUT_MS = 10000;

// ── The one place an upstream key name appears ────────────────────────
// Left side: what the app calls it. Right side: what elgoose.net calls it.
// If a key turns out to be spelled differently on a live response, fix it
// here and nowhere else.
const FIELDS = {
  showDate: 'showdate',
  permalink: 'permalink',
  venue: 'venuename',
  city: 'city',
  state: 'state',
  country: 'country',
  setType: 'settype',
  setNumber: 'setnumber',
  position: 'position',
  songName: 'songname',
  transition: 'transition',
  footnote: 'footnote',
  jamchart: 'isjamchart',
  jamchartNote: 'jamchart_description',
  soundcheck: 'soundcheck',
  opener: 'opener',
  isOriginal: 'isoriginal',
  gap: 'gap',
  tourName: 'tourname',
  showId: 'show_id',
  uniqueId: 'uniqueid',
  artistId: 'artist_id',
  slug: 'slug',
};

function get(row, field) {
  return row ? row[FIELDS[field]] : undefined;
}

function fetchShowDate(date) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOSTNAME,
      path: `${API_PATH}/${encodeURIComponent(date)}.json`,
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
          reject(new Error(`Failed to parse elgoose.net response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('elgoose.net request timed out'));
    });
    req.end();
  });
}

/**
 * elgoose.net signals failure with `error: 1` and a message in
 * `error_message`. Tested as a number against 0 rather than truthily,
 * because that is what this API actually returns — phish.net's v5 uses a
 * boolean for the same node and the two must not be conflated.
 */
function readEnvelope(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'Empty response from elgoose.net', rows: [] };
  }
  const failed = Number(payload.error) === 1;
  if (failed) {
    return { ok: false, message: payload.error_message || 'elgoose.net reported an error', rows: [] };
  }
  const rows = Array.isArray(payload.data) ? payload.data : [];
  return { ok: true, message: '', rows };
}

/**
 * Groups the flat row array by show, because one date can carry more than
 * one (a festival day where Goose played twice, or a late show). Grouping
 * on the upstream show id rather than on venue name, since that is the
 * source's own notion of "one show"; venue is what the caller then
 * disambiguates on.
 */
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
    const setType = get(row, 'setType');
    const setNumber = get(row, 'setNumber');
    // The row-level soundcheck flag and a 'Soundcheck' settype are two
    // spellings of the same thing; either one drops the row.
    const isSoundcheck = toBool(get(row, 'soundcheck'));
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
      // `isoriginal` is about authorship, not about this performance being a
      // cover *of someone else*, and elgoose.net does not name the covered
      // artist on the setlist row — so `cover` stays null rather than being
      // filled with a guess. A Goose show's covers are still visible in the
      // footnote, which is where the archive puts that detail.
      cover: null,
      // No `debut` from this source. elgoose.net's setlist row carries no
      // debut flag, and the obvious inference from `gap` does not hold: a
      // gap of 0 means "played at the previous show", which is the exact
      // opposite of a debut. Guessing here would be the same mistake
      // admin-populate-setlist.js's regex over setlist.fm's free-text
      // `info` field makes, just with a different input — so the field is
      // left unset and `sourceGap` carries the real number instead.
      // Revisit once a live response shows how a genuine debut is marked.
      debut: false,
      opener: get(row, 'opener'),
      songId: get(row, 'uniqueId'),
      songSlug: get(row, 'slug'),
    };
  });

  const { songs, droppedSoundcheckCount } = buildSetlist(mapped);

  return {
    source: 'elgoose',
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
    // elgoose.net has no show-level prose field on the setlist row — that
    // is a phish.net feature. Empty rather than absent so both adapters
    // return the same shape.
    setlistNotes: '',
    sourceArtistId: String(get(first, 'artistId') || ''),
  };
}

/**
 * fetchSetlists(date) -> { ok, message, shows: [normalizedShow] }
 *
 * Returns every show elgoose.net has for that date. Picking between them is
 * the caller's job, not the adapter's — band-setlist.js disambiguates on
 * venue and says in the response when it had to.
 */
async function fetchSetlists(date) {
  const { statusCode, data } = await fetchShowDate(date);

  if (statusCode !== 200) {
    return { ok: false, message: `elgoose.net returned HTTP ${statusCode}`, shows: [] };
  }

  const envelope = readEnvelope(data);
  if (!envelope.ok) return { ok: false, message: envelope.message, shows: [] };

  const shows = groupRowsByShow(envelope.rows)
    .map(mapShow)
    .filter((show) => show.songs.length > 0 || show.droppedSoundcheckCount > 0);

  return { ok: true, message: '', shows };
}

module.exports = { FIELDS, fetchSetlists, mapShow, readEnvelope, groupRowsByShow };
