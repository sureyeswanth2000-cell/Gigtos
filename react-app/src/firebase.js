import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDMJvNKvgwfEvymuLaXhGQwJr-Id4yExYU",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "gigto-c0c83.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "gigto-c0c83",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "gigto-c0c83.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "190454381677",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:190454381677:web:458b1638c984ababcdd364",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-3WQKM1M1F9",
};

const app = initializeApp(firebaseConfig);


export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const functionsInstance = getFunctions(app, 'us-central1');

export const storage = getStorage(app);

export default app;
