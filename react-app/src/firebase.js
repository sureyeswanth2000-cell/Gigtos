import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
} from 'firebase/app-check';
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDMJvNKvgwfEvymuLaXhGQwJr-Id4yExYU",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "gigto-c0c83.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "gigto-c0c83",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "gigtos-user-uploads-gigto-c0c83",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "190454381677",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:190454381677:web:458b1638c984ababcdd364",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-3WQKM1M1F9",
};

const app = initializeApp(firebaseConfig);

const defaultAppCheckEnterpriseSiteKey = '6LfJzvQsAAAAAO7eO16Wm4hWii7iIIOML_Q-Lnom';
const appCheckEnterpriseSiteKey =
  process.env.REACT_APP_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY ||
  defaultAppCheckEnterpriseSiteKey;
const appCheckSiteKey = process.env.REACT_APP_APPCHECK_RECAPTCHA_SITE_KEY || '';
const appCheckDebugToken = process.env.REACT_APP_APPCHECK_DEBUG_TOKEN || '';
const isProductionRuntime =
  process.env.NODE_ENV === 'production' ||
  process.env.REACT_APP_DEPLOY_ENV === 'production';
const canUseAppCheck =
  typeof window !== 'undefined' &&
  process.env.NODE_ENV !== 'test';
const appCheckProvider = canUseAppCheck && appCheckEnterpriseSiteKey
  ? new ReCaptchaEnterpriseProvider(appCheckEnterpriseSiteKey)
  : canUseAppCheck && appCheckSiteKey
    ? new ReCaptchaV3Provider(appCheckSiteKey)
    : null;

if (
  typeof window !== 'undefined' &&
  appCheckDebugToken &&
  !isProductionRuntime
) {
  window.FIREBASE_APPCHECK_DEBUG_TOKEN =
    appCheckDebugToken === 'true' ? true : appCheckDebugToken;
}

export const appCheckInstance =
  canUseAppCheck && appCheckProvider
    ? initializeAppCheck(app, {
        provider: appCheckProvider,
        isTokenAutoRefreshEnabled: true,
      })
    : null;

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const functionsInstance = getFunctions(app, 'us-central1');

export const storage = getStorage(app);

export default app;
