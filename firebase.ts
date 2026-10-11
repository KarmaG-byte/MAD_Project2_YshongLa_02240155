import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use the WEB app configuration from the SAME Firebase project as Project I.
// Never place a Firebase Admin SDK service-account private key in a mobile app.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'MISSING_API_KEY',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'missing-project-id',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'missing-app-id',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
};
export const firebaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID
);
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
let authInstance;
try {
  authInstance = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;
