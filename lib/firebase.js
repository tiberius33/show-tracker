import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  OAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC5PQErQtSFAIkG779kfK_UhaS5hYflwuY",
  // Auth domain is our own domain, served by the /__/auth/* proxy rewrite in
  // netlify.toml. Google's sign-in screen shows the app name only for
  // brand-verified OAuth clients; unverified ones fall back to the host of the
  // redirect URI, which is why users saw "show-tracker-d7a4d.firebaseapp.com"
  // even after the consent screen's App name was set to MySetlists. With the
  // proxy, the redirect URI is https://mysetlists.net/__/auth/handler, so that
  // is what Google displays — and authDomain is same-origin with the app,
  // which is what Firebase recommends for browsers that block third-party
  // storage (Safari ITP).
  //
  // Deploy this together with the netlify.toml rewrite, and only after
  // https://mysetlists.net/__/auth/handler is an authorized redirect URI on
  // the OAuth client. Instant rollback without a code change: set
  // NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=show-tracker-d7a4d.firebaseapp.com in
  // Netlify and redeploy.
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mysetlists.net",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "show-tracker-d7a4d",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "show-tracker-d7a4d.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "580565525718",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:580565525718:web:b9a2aa57320a007dad1577",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-GY590XJX2Q",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
// Use initializeAuth with browserLocalPersistence on Capacitor/native to avoid
// IndexedDB issues in WKWebView under custom URL schemes (mysetlists://)
//
// On web, deliberately omit `popupRedirectResolver` here rather than using
// getAuth() (which attaches browserPopupRedirectResolver by default). Firebase
// Auth's browser resolver has `_shouldInitProactively = true` on mobile
// browsers and Safari, which makes auth initialization eagerly load and await
// the `__/auth/iframe.js` + gapi.iframes machinery before the first
// onAuthStateChanged callback fires — gating first paint behind ~130KB of
// Google sign-in plumbing that most page loads never use. The resolver is
// passed explicitly instead at each signInWithPopup() call site, so it's only
// fetched when a user actually attempts Google sign-in.
let auth;
try {
  const { Capacitor } = require('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } else {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    });
  }
} catch {
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
  });
}
export { auth };
export { browserPopupRedirectResolver };

// Popup sign-in warm-up.
//
// Because the resolver is deliberately not attached at initializeAuth() time
// (see the note above), the first signInWithPopup() call has to initialize it
// — which fetches `__/auth/iframe.js` from the auth domain over the network —
// before it can call window.open(). That round trip outlives the click's
// user-activation window, so the browser blocks the popup: the user gets
// "popup blocked" and only the second click works, because the resolver is
// warm by then. Calling this once while the sign-in UI is on screen does that
// initialization ahead of the click, so window.open() runs while the gesture
// is still trusted. It also consumes any pending redirect result, which
// nothing else in the app does.
let popupResolverWarmup = null;
export function warmAuthPopupResolver() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!popupResolverWarmup) {
    popupResolverWarmup = import('firebase/auth')
      .then(({ getRedirectResult }) => getRedirectResult(auth, browserPopupRedirectResolver))
      .catch(() => null);
  }
  return popupResolverWarmup;
}

// Initialize Cloud Firestore
//
// Deliberately WITHOUT offline persistence. 5.36.4 added
// `enableIndexedDbPersistence(db)` here to stop the native app losing edits
// made on a flaky connection, and it took the whole app down: when the
// IndexedDB layer fails to come up, the client does not throw — every
// `getDocs` and `onSnapshot` simply never settles. `loadShows` awaits one of
// those inside a try/finally, so `setIsLoading(false)` never ran and every
// data-driven page sat on a spinner with no error anywhere.
//
// Whatever replaces it has to fail loudly rather than hang, and be verified
// against a real device before it ships.
export const db = getFirestore(app);

// Initialize Cloud Storage — used by lib/photos.js for concert photo/video
// uploads. Nothing in the app used Storage before this, despite
// `storageBucket` already being present in the config above.
export const storage = getStorage(app);

// Auth Providers
//
// Apple is back. It was removed after the 2026-03-24 rejection rather than
// fixed, but the entitlement and the Capacitor provider config were left in
// place, and Guideline 4.8 wants a privacy-respecting alternative alongside
// Google. On native this OAuthProvider is never used for a popup —
// lib/native-auth.js drives Apple through the native sheet — but it is what
// the web build signs in with, and what declares the scopes.
export const authProviders = {
  google: new GoogleAuthProvider(),
  apple: (() => {
    const apple = new OAuthProvider('apple.com');
    apple.addScope('email');
    apple.addScope('name');
    return apple;
  })(),
};

// Legacy export for backward compatibility
export const googleProvider = authProviders.google;

// Firebase Cloud Messaging and Analytics are not needed for first paint or
// interaction (notification opt-in and event logging both happen well after
// the user is already looking at real content), so their SDK chunks are
// dynamically imported and initialized lazily on first actual use instead of
// being parsed/executed at app bootstrap on every route.
let messagingPromise = null;
function getMessagingLazy() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return Promise.resolve(null);
  }
  if (!messagingPromise) {
    messagingPromise = import('firebase/messaging')
      .then(({ getMessaging }) => getMessaging(app))
      .catch((error) => {
        console.log('Firebase Messaging not supported in this browser', error);
        return null;
      });
  }
  return messagingPromise;
}

let analyticsPromise = null;
export function getFirebaseAnalytics() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!analyticsPromise) {
    analyticsPromise = import('firebase/analytics')
      .then(({ getAnalytics }) => getAnalytics(app))
      .catch((error) => {
        console.log('Firebase Analytics not available', error);
        return null;
      });
  }
  return analyticsPromise;
}

// FCM helper functions
export async function requestNotificationPermission() {
  const messaging = await getMessagingLazy();
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const { getToken } = await import('firebase/messaging');
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      const token = await getToken(messaging, vapidKey ? { vapidKey } : undefined);
      return token;
    }
    return null;
  } catch (error) {
    console.error('Failed to get notification token:', error);
    return null;
  }
}

export async function onForegroundMessage(callback) {
  const messaging = await getMessagingLazy();
  if (!messaging) return () => {};
  const { onMessage } = await import('firebase/messaging');
  return onMessage(messaging, callback);
}
