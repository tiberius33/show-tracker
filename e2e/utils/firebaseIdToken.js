/**
 * Sign the test account in over Firebase Auth's REST API and return
 * { idToken, uid } — for API-level tests of functions that now require a
 * Firebase ID token (send-email, admin-*). No browser needed.
 *
 * The web API key is the public one the app ships with (lib/firebase.js).
 */

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC5PQErQtSFAIkG779kfK_UhaS5hYflwuY';

async function getIdToken(request, email = process.env.TEST_EMAIL, password = process.env.TEST_PASSWORD) {
  if (!email || !password) return null;
  const res = await request.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { data: { email, password, returnSecureToken: true } },
  );
  if (!res.ok()) throw new Error(`Test sign-in failed: HTTP ${res.status()}`);
  const body = await res.json();
  return { idToken: body.idToken, uid: body.localId, email: body.email };
}

module.exports = { getIdToken };
