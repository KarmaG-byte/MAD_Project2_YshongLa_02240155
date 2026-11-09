import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase WEB app configuration for TshongLa 2, registered in the SAME
// Firebase project as the original TshongLa Android application.
// Firebase web config values are public app identifiers, NOT admin credentials.
// Protect user data with Firebase Authentication and Firestore Security Rules.
// Optional EXPO_PUBLIC_* environment variables can override these values.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDASCctAxaIIMt7nhGilpYunFNEseKahbg',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'tshongla-77361.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'tshongla-77361',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'tshongla-77361.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '908666555712',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:908666555712:web:35579f74f5097e2cb53ea5',
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Fail fast (instead of retrying for 10 minutes) when Storage is not set up for the project.
storage.maxUploadRetryTime = 15000;

let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Reuse Auth if it was initialized already (e.g., after Expo Fast Refresh).
  authInstance = getAuth(app);
}
export const auth = authInstance;
