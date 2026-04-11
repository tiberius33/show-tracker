import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, browserLocalPersistence, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getAnalytics } from "firebase/analytics";

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

// Initialize Firebase Cloud Messaging (only in browser with service worker support)
let messaging = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.log('Firebase Messaging not supported in this browser');
  }
}
export { messaging };

// Auth Providers
// Only Google Sign-In is supported. Apple Sign-In has been removed.
export const authProviders = {
  google: new GoogleAuthProvider(),
};

// Legacy export for backward compatibility
export const googleProvider = authProviders.google;

// FCM helper functions
export async function requestNotificationPermission() {
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
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

export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}

// Initialize Firebase Analytics (browser-only)
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.log('Firebase Analytics not available');
  }
}
export { analytics };
