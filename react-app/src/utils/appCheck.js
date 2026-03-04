/**
 * GIGTOS SECURITY — FIREBASE APP CHECK INITIALISATION
 *
 * Initialises Firebase App Check with reCAPTCHA v3 to prove that requests
 * originate from genuine Gigto web clients.
 *
 * Usage:
 *   import { initAppCheck } from './utils/appCheck';
 *   initAppCheck(app);  // call once in index.js before rendering
 *
 * For local development, the debug provider token is automatically loaded from
 * the REACT_APP_APPCHECK_DEBUG_TOKEN environment variable.
 */

import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

/**
 * Initialises Firebase App Check for the given Firebase app instance.
 * Call this once at application startup, before any Firebase service calls.
 *
 * @param {import('firebase/app').FirebaseApp} app - Initialised Firebase app.
 * @returns {import('firebase/app-check').AppCheck | null} The AppCheck instance, or null on failure.
 */
export function initAppCheck(app) {
  const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

  // Allow a debug token in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const debugToken = process.env.REACT_APP_APPCHECK_DEBUG_TOKEN;
    if (debugToken) {
      // eslint-disable-next-line no-restricted-globals
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
  }

  if (!siteKey) {
    console.warn(
      '[AppCheck] REACT_APP_RECAPTCHA_SITE_KEY is not set. ' +
      'App Check will not be initialised. ' +
      'Set it in your .env file for production.'
    );
    return null;
  }

  try {
    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      // Automatically refresh the App Check token before it expires
      isTokenAutoRefreshEnabled: true,
    });
    console.log('[AppCheck] Initialised with reCAPTCHA v3.');
    return appCheck;
  } catch (err) {
    console.error('[AppCheck] Initialisation failed:', err);
    return null;
  }
}
