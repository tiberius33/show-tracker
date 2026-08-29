// netlify/functions/find-show-poster.js
//
// Step 1 of the poster-art waterfall: best-effort match against Ticketmaster
// and SeatGeek event data (cheapest, most reliable — no AI involved). Both
// APIs are live ticket-marketplace catalogs rather than historical archives,
// so this step is expected to miss for most shows that already happened —
// that's a normal outcome, not an error.

const https = require('https');

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const USER_AGENT = 'MySetlistsApp/1.0';

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`Failed to parse response from ${url}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function normalize(s) {
  return (s || '').trim().toLowerCase();
}

// Accepts DD-MM-YYYY or YYYY-MM-DD, always returns YYYY-MM-DD.
function normalizeDate(date) {
  if (!date) return date;
  const ddmmyyyy = date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  return date;
}

function venuesMatch(a, b) {
  if (!a || !b) return false;
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

// --- Ticketmaster ------------------------------------------------------

async function searchTicketmaster({ artist, venue, date }) {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return null;

  const normalizedArtist = normalize(artist);

  // Resolve attraction ID (same approach as ticketmaster-events.js)
  let attractionId = null;
  try {
    const attrParams = new URLSearchParams({
      keyword: artist, apikey: apiKey, classificationName: 'music', size: '10',
    });
    const { body } = await httpsGetJson(`https://app.ticketmaster.com/discovery/v2/attractions.json?${attrParams}`);
    const attractions = body?._embedded?.attractions || [];
    const exact = attractions.find((a) => normalize(a.name) === normalizedArtist);
    if (exact) attractionId = exact.id;
  } catch (_) {
    // fall through — no attraction match, nothing more we can do for TM
  }
  if (!attractionId) return null;

  // Fetch all known events for this attraction — intentionally no startDateTime
  // floor, since we're matching against a specific (possibly past) show date.
  try {
    const eventParams = new URLSearchParams({
      attractionId, apikey: apiKey, size: '100', sort: 'date,asc',
    });
    const { body } = await httpsGetJson(`https://app.ticketmaster.com/discovery/v2/events.json?${eventParams}`);
    const events = body?._embedded?.events || [];
    const match = events.find((e) => {
      const eDate = e.dates?.start?.localDate;
      const eVenue = e._embedded?.venues?.[0]?.name;
      return eDate === date && (!venue || venuesMatch(eVenue, venue));
    });
    if (!match || !Array.isArray(match.images) || !match.images.length) return null;

    const best = [...match.images].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    if (!best?.url) return null;

    return { posterUrl: best.url, posterSourceUrl: match.url || null, posterSource: 'ticketmaster' };
  } catch (_) {
    return null;
  }
}

// --- SeatGeek ------------------------------------------------------------

async function searchSeatGeek({ artist, venue, date }) {
  const clientId = process.env.SEATGEEK_CLIENT_ID;
  if (!clientId) return null;

  const normalizedArtist = normalize(artist);

  try {
    const params = new URLSearchParams({
      q: artist, type: 'concert', client_id: clientId, per_page: '50', sort: 'datetime_local.asc',
    });
    const { body } = await httpsGetJson(`https://api.seatgeek.com/2/events?${params}`);
    const events = Array.isArray(body?.events) ? body.events : [];
    const match = events.find((e) => {
      const eDate = (e.datetime_local || '').split('T')[0];
      const performers = Array.isArray(e.performers) ? e.performers : [];
      const hasArtist = performers.some((p) => normalize(p.name) === normalizedArtist);
      return hasArtist && eDate === date && (!venue || venuesMatch(e.venue?.name, venue));
    });
    if (!match) return null;

    // SeatGeek doesn't have dedicated tour-poster artwork — the performer photo
    // is the closest thing it returns. Best-effort, per the source-order design.
    const performer = (match.performers || []).find((p) => normalize(p.name) === normalizedArtist);
    const posterUrl = performer?.image || null;
    if (!posterUrl) return null;

    return { posterUrl, posterSourceUrl: match.url || null, posterSource: 'seatgeek' };
  } catch (_) {
    return null;
  }
}

// --- Handler ---------------------------------------------------------------

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
      body: '',
    };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { artist, venue, city } = event.queryStringParameters || {};
  const date = normalizeDate(event.queryStringParameters?.date);
  if (!artist || !date) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'artist and date are required' }) };
  }

  try {
    const [tm, sg] = await Promise.allSettled([
      searchTicketmaster({ artist, venue, date, city }),
      searchSeatGeek({ artist, venue, date, city }),
    ]);

    const tmResult = tm.status === 'fulfilled' ? tm.value : null;
    const sgResult = sg.status === 'fulfilled' ? sg.value : null;
    const result = tmResult || sgResult;

    if (!result) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: true, ...result }) };
  } catch (err) {
    console.error('find-show-poster error:', err);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false }) };
  }
};
