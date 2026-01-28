const https = require('https');

exports.handler = async function(event, context) {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const { artistName, year, venueName, cityName, p } = event.queryStringParameters || {};

  if (!artistName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Artist name is required' })
    };
  }

  const params = new URLSearchParams({ artistName, p: p || '1' });
  if (year) params.set('year', year);
  if (venueName) params.set('venueName', venueName);
  if (cityName) params.set('cityName', cityName);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.setlist.fm',
      path: `/rest/1.0/search/setlists?${params.toString()}`,
      method: 'GET',
      headers: {
        'x-api-key': 'VmDr8STg4UbyNE7Jgiubx2D_ojbliDuoYMgQ',
        'Accept': 'application/json',
        'User-Agent': 'ShowTrackerApp/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(parsedData)
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode || 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Failed to parse response', details: error.message, raw: data })
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Request failed', details: error.message })
      });
    });

    req.end();
  });
};
