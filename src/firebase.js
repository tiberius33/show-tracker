import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyC5PQErQtSFAIkG779kfK_UhaS5hYflwuY",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "show-tracker-d7a4d.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "show-tracker-d7a4d",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "show-tracker-d7a4d.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "580565525718",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:580565525718:web:b9a2aa57320a007dad1577",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-GY590XJX2Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

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

// Auth Providers - centralized for easy extension
// To add Apple: import { OAuthProvider } from 'firebase/auth'; then add: apple: new OAuthProvider('apple.com')
// To add Facebook: import { FacebookAuthProvider } from 'firebase/auth'; then add: facebook: new FacebookAuthProvider()
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
      // Get FCM token - VAPID key is optional, will work without it for basic notifications
      const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
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
