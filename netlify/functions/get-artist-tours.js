const https = require('https');

// Fetch pages of setlists and extract tour information
async function fetchSetlists(mbid, page = 1) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.setlist.fm',
      path: `/rest/1.0/artist/${mbid}/setlists?p=${page}`,
      method: 'GET',
      headers: {
        'x-api-key': process.env.SETLISTFM_API_KEY || 'VmDr8STg4UbyNE7Jgiubx2D_ojbliDuoYMgQ',
        'Accept': 'application/json',
        'User-Agent': 'ShowTrackerApp/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ setlist: [] });
        }
      });
    });

    req.on('error', () => resolve({ setlist: [] }));
    req.end();
  });
}

function parseTours(setlists) {
  const tourMap = {};
  const shows = [];

  for (const sl of (setlists || [])) {
    const tourName = sl.tour?.name || 'No Tour Listed';
    const date = sl.eventDate; // dd-MM-yyyy format
    const venue = sl.venue?.name || '';
    const city = sl.venue?.city?.name || '';
    const country = sl.venue?.city?.country?.code || '';
    const songCount = (sl.sets?.set || []).reduce((acc, s) => acc + (s.song?.length || 0), 0);

    const show = { date, venue, city, country, songCount, tourName };
    shows.push(show);

    if (!tourMap[tourName]) {
      tourMap[tourName] = { name: tourName, shows: [], dates: [], songCounts: [] };
    }
    tourMap[tourName].shows.push(show);
    tourMap[tourName].dates.push(date);
    tourMap[tourName].songCounts.push(songCount);
  }

  // Process tours
  const tours = Object.values(tourMap).map(tour => {
    // Parse dates (dd-MM-yyyy -> Date)
    const parsedDates = tour.dates
      .map(d => {
        if (!d) return null;
        const [day, month, year] = d.split('-');
        return new Date(`${year}-${month}-${day}`);
      })
      .filter(Boolean)
      .sort((a, b) => a - b);

    return {
      name: tour.name,
      showCount: tour.shows.length,
      startDate: parsedDates[0]?.toISOString().split('T')[0] || null,
      endDate: parsedDates[parsedDates.length - 1]?.toISOString().split('T')[0] || null,
      avgSongCount: tour.songCounts.length
        ? Math.round(tour.songCounts.reduce((a, b) => a + b, 0) / tour.songCounts.length)
        : 0,
      shows: tour.shows.slice(0, 10), // Keep first 10 shows per tour
    };
  });

  // Sort by most recent start date
  tours.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  return { tours, totalShows: shows.length };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { mbid } = event.queryStringParameters || {};
  if (!mbid) {
    return { statusCode: 400, body: JSON.stringify({ error: 'mbid (MusicBrainz ID) is required' }) };
  }

  try {
    // Fetch first 3 pages of setlists (60 shows) to get good tour coverage
    const [page1, page2, page3] = await Promise.all([
      fetchSetlists(mbid, 1),
      fetchSetlists(mbid, 2),
      fetchSetlists(mbid, 3),
    ]);

    const allSetlists = [
      ...(page1.setlist || []),
      ...(page2.setlist || []),
      ...(page3.setlist || []),
    ];

    const result = parseTours(allSetlists);
    result.mbid = mbid;
    result.artistName = page1.setlist?.[0]?.artist?.name || '';
    result.fetchedAt = new Date().toISOString();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('get-artist-tours error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to fetch tour data', details: err.message }),
    };
  }
};
