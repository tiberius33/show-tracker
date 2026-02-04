import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

// Auth Providers - centralized for easy extension
// To add Apple: import { OAuthProvider } from 'firebase/auth'; then add: apple: new OAuthProvider('apple.com')
// To add Facebook: import { FacebookAuthProvider } from 'firebase/auth'; then add: facebook: new FacebookAuthProvider()
export const authProviders = {
  google: new GoogleAuthProvider(),
};

// Legacy export for backward compatibility
export const googleProvider = authProviders.google;
