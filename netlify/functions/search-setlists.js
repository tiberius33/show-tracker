exports.handler = async function(event, context) {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const artistName = event.queryStringParameters.artistName;
  
  if (!artistName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Artist name is required' })
    };
  }

  try {
    const response = await fetch(
      `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artistName)}&p=1`,
      {
        headers: {
          'x-api-key': 'VmDr8STg4UbyNE7Jgiubx2D_ojbliDuoYMgQ',
          'Accept': 'application/json'
        }
      }
    );

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Failed to fetch setlists', details: error.message })
    };
  }
};
