import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyDMJvNKvgwfEvymuLaXhGQwJr-Id4yExYU",
  authDomain: "gigto-c0c83.firebaseapp.com",
  projectId: "gigto-c0c83",
  storageBucket: "gigto-c0c83.firebasestorage.app",
  messagingSenderId: "190454381677",
  appId: "1:190454381677:web:458b1638c984ababcdd364",
  measurementId: "G-3WQKM1M1F9"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functionsInstance = getFunctions(app, 'us-central1');

// Connect to local Firebase Emulators when REACT_APP_USE_EMULATOR=true.
// Run: npm run start:emulator   (from react-app/)
// This lets the whole team test with real credentials locally — no cloud
// project access or service-account key required.
if (process.env.REACT_APP_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functionsInstance, 'localhost', 5001);
  console.log('🔧 Firebase Emulators connected (Auth:9099, Firestore:8080, Functions:5001)');
} else {
  console.log('✅ Firebase initialized (cloud project: gigto-c0c83)');
}

console.log('📁 Project ID:', firebaseConfig.projectId);

export default app;
