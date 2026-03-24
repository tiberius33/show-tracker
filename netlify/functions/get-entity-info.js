const https = require('https');

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// --- Firebase Admin (lazy init, graceful degradation if env vars missing) ---

function getDb() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!json || !projectId) return null;
  try {
    const { getApps, initializeApp, cert } = require('firebase-admin/app');
    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(json)), projectId });
    }
    const { getFirestore } = require('firebase-admin/firestore');
    return getFirestore();
  } catch (e) {
    console.warn('[WIKI CACHE] Firebase init failed:', e.message);
    return null;
  }
}

// --- Promisified HTTPS GET ---

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MySetlistsApp/1.0 (show-tracker; contact@mysetlists.net)',
      },
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`Failed to parse Wikipedia response: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// --- Handler ---

exports.handler = async function (event) {
  // OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  // Method validation
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Parameter extraction
  const { name, type } = event.queryStringParameters || {};

  if (!name) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing name parameter' }),
    };
  }

  if (type && type !== 'artist' && type !== 'venue') {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'type must be "artist" or "venue"' }),
    };
  }

  // Build cache key
  const cacheKey = `wiki_${(type || 'entity')}_${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_')}`;

  try {
    // Check Firestore cache
    const db = getDb();
    if (db) {
      try {
        const snap = await db.collection('wikiCache').doc(cacheKey).get();
        if (snap.exists) {
          const cached = snap.data();
          const cachedAt = cached.cachedAt?.toMillis ? cached.cachedAt.toMillis() : 0;
          if (Date.now() - cachedAt < CACHE_TTL_MS) {
            return {
              statusCode: 200,
              headers: { ...CORS_HEADERS, 'X-Cache': 'HIT' },
              body: cached.response,
            };
          }
        }
      } catch (_) {
        // Cache read failed — continue to Wikipedia
      }
    }

    // Build Wikipedia URL: replace spaces with underscores
    const wikiTitle = encodeURIComponent(name.trim().replace(/\s+/g, '_'));
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`;

    const { statusCode, body } = await httpsGet(wikiUrl);

    // No Wikipedia article found
    if (statusCode === 404) {
      const notFound = { found: false, name, type: type || 'entity' };
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(notFound),
      };
    }

    if (statusCode !== 200) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `Wikipedia API returned ${statusCode}` }),
      };
    }

    // Handle disambiguation pages
    if (body.type === 'disambiguation') {
      const disambiguation = { found: false, disambiguation: true, name, type: type || 'entity' };
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(disambiguation),
      };
    }

    // Shape the response to only what the frontend needs
    const result = {
      found: true,
      name: body.title || name,
      type: type || 'entity',
      summary: body.extract || '',
      description: body.description || '',
      image: body.thumbnail?.source || null,
      imageWidth: body.thumbnail?.width || null,
      imageHeight: body.thumbnail?.height || null,
      url: body.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${wikiTitle}`,
    };

    const responseBody = JSON.stringify(result);

    // Write to Firestore cache (fire-and-forget)
    if (db) {
      const { Timestamp } = require('firebase-admin/firestore');
      db.collection('wikiCache').doc(cacheKey).set({
        response: responseBody,
        cachedAt: Timestamp.now(),
        queryName: name,
        queryType: type || 'entity',
      }).catch(() => {});
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'X-Cache': 'MISS' },
      body: responseBody,
    };
  } catch (err) {
    console.error('get-entity-info error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
