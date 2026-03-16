/**
 * Native authentication helpers for Capacitor iOS app.
 *
 * Uses @capacitor-firebase/authentication for native Google/Apple Sign-In
 * since signInWithPopup() doesn't work reliably in WKWebView.
 *
 * On web, falls back to standard Firebase popup auth.
 */

import { signInWithCredential, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
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
    if (!idToken) {
      throw new Error('No ID token received from native Google Sign-In');
    }

    // Create Firebase credential and sign in to the JS SDK
    const credential = GoogleAuthProvider.credential(idToken);
    return await signInWithCredential(auth, credential);
  } catch (err) {
    // If user cancelled, re-throw with Firebase-like code
    if (err.message?.includes('cancel') || err.message?.includes('dismissed')) {
      const cancelErr = new Error('Sign in cancelled');
      cancelErr.code = 'auth/popup-closed-by-user';
      throw cancelErr;
    }
    throw err;
  }
}

/**
 * Sign in with Apple using native iOS sign-in sheet on Capacitor,
 * or return null to indicate the caller should use the web popup flow.
 *
 * @returns {Promise<import('firebase/auth').UserCredential | null>}
 *   UserCredential on native success, null if web fallback should be used.
 */
export async function nativeAppleSignIn() {
  if (!isNative) return null;

  try {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithApple();

    const idToken = result.credential?.idToken;
    const rawNonce = result.credential?.nonce;
    if (!idToken) {
      throw new Error('No ID token received from native Apple Sign-In');
    }

    // Create Firebase OAuthProvider credential for Apple
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken, rawNonce });
    return await signInWithCredential(auth, credential);
  } catch (err) {
    if (err.message?.includes('cancel') || err.message?.includes('dismissed')) {
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
