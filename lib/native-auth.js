/**
 * Native authentication helpers for Capacitor iOS app.
 *
 * Uses @capacitor-firebase/authentication for native Google/Apple Sign-In
 * since signInWithPopup() doesn't work reliably in WKWebView.
 *
 * On web, falls back to standard Firebase popup auth.
 */

import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';

let isNative = false;
try {
  const { Capacitor } = require('@capacitor/core');
  isNative = Capacitor.isNativePlatform();
} catch {
  // Not available — we're on web
}

/**
 * Sign in with Google using native iOS sign-in sheet on Capacitor,
 * or return null to indicate the caller should use the web popup flow.
 *
 * @returns {Promise<import('firebase/auth').UserCredential | null>}
 *   UserCredential on native success, null if web fallback should be used.
 */
export async function nativeGoogleSignIn() {
  if (!isNative) return null;

  try {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithGoogle();

    // Get the ID token from the native sign-in
    const idToken = result.credential?.idToken;
    const accessToken = result.credential?.accessToken;
    if (!idToken) {
      throw new Error('No ID token received from native Google Sign-In');
    }

    // Create Firebase credential and sign in to the JS SDK
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    return await signInWithCredential(auth, credential);
  } catch (err) {
    // If user cancelled, re-throw with Firebase-like code
    if (
      err.message?.includes('cancel') ||
      err.message?.includes('dismissed') ||
      err.code === 'ERROR_CANCELED' ||
      err.message?.includes('12501')
    ) {
      const cancelErr = new Error('Sign in cancelled');
      cancelErr.code = 'auth/popup-closed-by-user';
      throw cancelErr;
    }
    throw err;
  }
}

/**
 * Check if we're running in a native Capacitor app.
 */
export function isNativePlatform() {
  return isNative;
}
