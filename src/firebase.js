import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC5PQErQtSFAIkG779kfK_UhaS5hYflwuY",
  authDomain: "show-tracker-d7a4d.firebaseapp.com",
  projectId: "show-tracker-d7a4d",
  storageBucket: "show-tracker-d7a4d.firebasestorage.app",
  messagingSenderId: "580565525718",
  appId: "1:580565525718:web:b9a2aa57320a007dad1577",
  measurementId: "G-GY590XJX2Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Cloud Firestore
export const db = getFirestore(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
