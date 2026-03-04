/**
 * Firebase App Check initialization using reCAPTCHA v3 provider.
 *
 * App Check protects your backend resources from abuse by ensuring that requests
 * originate from legitimate instances of your app.
 *
 * Usage:
 *   Import and call initAppCheck() once in your app entry point (e.g. index.js)
 *   before any Firebase service calls are made.
 *
 * Setup:
 *   1. Enable App Check in Firebase Console → App Check
 *   2. Register your web app with a reCAPTCHA v3 site key
 *   3. Set the REACT_APP_RECAPTCHA_SITE_KEY environment variable
 */

import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import app from '../firebase';

let appCheckInstance = null;

/**
 * Initializes Firebase App Check with the reCAPTCHA v3 provider.
 * Call this once at app startup before any Firebase service calls.
 *
 * @returns {object|null} The App Check instance, or null if not configured.
 */
export function initAppCheck() {
  if (appCheckInstance) return appCheckInstance;

  const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    console.warn(
      '[AppCheck] REACT_APP_RECAPTCHA_SITE_KEY is not set. ' +
      'App Check is disabled. Set this variable to enable protection.'
    );
    return null;
  }

  appCheckInstance = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    // Automatically refresh App Check tokens
    isTokenAutoRefreshEnabled: true,
  });

  console.log('[AppCheck] Initialized with reCAPTCHA v3 provider.');
  return appCheckInstance;
}

export default appCheckInstance;
