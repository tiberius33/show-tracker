const https = require('https');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const { artistName } = event.queryStringParameters || {};

  if (!artistName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'artistName is required' })
    };
  }

  const apiKey = process.env.TICKETMASTER_API_KEY;
  const affiliateId = process.env.TICKETMASTER_AFFILIATE_ID;

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Ticketmaster API key not configured' })
    };
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const params = new URLSearchParams({
    keyword: artistName,
    apikey: apiKey,
    size: '5',
    sort: 'date,asc',
    segmentName: 'Music',
    startDateTime: `${today}T00:00:00Z`
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'app.ticketmaster.com',
      path: `/discovery/v2/events.json?${params.toString()}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MySetlistsApp/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => { data += chunk; });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const rawEvents = parsed._embedded && parsed._embedded.events
            ? parsed._embedded.events
            : [];

          const events = rawEvents.map((e) => {
            const venue = e._embedded && e._embedded.venues && e._embedded.venues[0]
              ? e._embedded.venues[0]
              : {};
            const priceRange = e.priceRanges && e.priceRanges[0] ? e.priceRanges[0] : null;

            // Build affiliate URL
            let url = e.url || '';
            if (url && affiliateId) {
              url += (url.includes('?') ? '&' : '?') + `camefrom=${encodeURIComponent(affiliateId)}`;
            }

            return {
              id: e.id,
              name: e.name,
              date: e.dates && e.dates.start ? e.dates.start.localDate : null,
              time: e.dates && e.dates.start ? e.dates.start.localTime : null,
              venue: venue.name || null,
              city: venue.city ? venue.city.name : null,
              state: venue.state ? (venue.state.stateCode || venue.state.name) : null,
              country: venue.country ? venue.country.countryCode : null,
              url,
              minPrice: priceRange ? priceRange.min : null,
              maxPrice: priceRange ? priceRange.max : null
            };
          });

          resolve({
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ events })
          });
        } catch (err) {
          resolve({
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Failed to parse Ticketmaster response', events: [] })
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Request to Ticketmaster failed', details: err.message, events: [] })
      });
    });

    req.end();
  });
};
