import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, browserLocalPersistence, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC5PQErQtSFAIkG779kfK_UhaS5hYflwuY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "show-tracker-d7a4d.firebaseapp.com",
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
let auth;
try {
  const { Capacitor } = require('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } else {
    auth = getAuth(app);
  }
} catch {
  auth = getAuth(app);
}
export { auth };

// Initialize Cloud Firestore
export const db = getFirestore(app);

// Auth Providers
// Only Google Sign-In is supported. Apple Sign-In has been removed.
export const authProviders = {
  google: new GoogleAuthProvider(),
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
