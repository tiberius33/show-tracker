/**
 * unsubscribe — Public endpoint for one-click email unsubscribe.
 *
 * GET /api/unsubscribe?token=<base64-encoded-uid>
 *
 * Sets emailOptOut: true on the user's profile and returns an HTML confirmation page.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function initFirebase() {
  const { getApps, initializeApp, cert } = require('firebase-admin/app');
  if (getApps().length > 0) return;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!privateKey || !clientEmail || !projectId) throw new Error('Firebase env vars not configured');
  initializeApp({ credential: cert({ privateKey, clientEmail, projectId }), projectId });
}

function encodeToken(uid) {
  return Buffer.from(uid).toString('base64url');
}

function decodeToken(token) {
  return Buffer.from(token, 'base64url').toString('utf8');
}

function htmlPage(title, message, success = true) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - MySetlists</title>
  <style>
    body { margin:0; padding:0; background:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#e2e8f0; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#1e293b; border-radius:16px; padding:48px 32px; max-width:440px; text-align:center; }
    .icon { font-size:48px; margin-bottom:16px; }
    h1 { color:${success ? '#4bc86a' : '#ef4444'}; font-size:24px; margin:0 0 12px; }
    p { color:#94a3b8; font-size:15px; line-height:1.6; margin:0 0 24px; }
    a { color:#4bc86a; text-decoration:none; font-weight:600; }
    a:hover { text-decoration:underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://mysetlists.net">Go to MySetlists</a>
  </div>
</body>
</html>`;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { 'Content-Type': 'text/html', ...CORS_HEADERS }, body: htmlPage('Error', 'Method not allowed', false) };
  }

  const token = event.queryStringParameters?.token;
  if (!token) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html', ...CORS_HEADERS },
      body: htmlPage('Invalid Link', 'This unsubscribe link is invalid or expired.', false),
    };
  }

  let uid;
  try {
    uid = decodeToken(token);
    if (!uid || uid.length < 10) throw new Error('Invalid token');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html', ...CORS_HEADERS },
      body: htmlPage('Invalid Link', 'This unsubscribe link is invalid or expired.', false),
    };
  }

  try {
    initFirebase();
    const { getFirestore } = require('firebase-admin/firestore');
    const db = getFirestore();

    // Verify user exists
    const profileDoc = await db.doc(`userProfiles/${uid}`).get();
    if (!profileDoc.exists) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html', ...CORS_HEADERS },
        body: htmlPage('Account Not Found', 'We could not find an account associated with this link.', false),
      };
    }

    // Set opt-out
    await db.doc(`userProfiles/${uid}`).set({ emailOptOut: true }, { merge: true });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html', ...CORS_HEADERS },
      body: htmlPage(
        'Unsubscribed',
        'You\'ve been unsubscribed from MySetlists emails. You can re-enable email notifications anytime from your profile settings.'
      ),
    };
  } catch (e) {
    console.error('unsubscribe error:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html', ...CORS_HEADERS },
      body: htmlPage('Something went wrong', 'Please try again later or contact support.', false),
    };
  }
};

// Export for use in email templates
exports.encodeToken = encodeToken;
