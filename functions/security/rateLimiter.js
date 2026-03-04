/**
 * GIGTOS SECURITY — FIRESTORE-BASED RATE LIMITER
 *
 * Prevents abuse by enforcing per-user (and per-phone) request caps
 * using a `rate_limits` Firestore collection as a sliding-window counter.
 *
 * Limits (configurable via RATE_LIMITS constant):
 *   submitQuote          10 per minute per user
 *   createBooking         5 per hour  per user
 *   updateBookingStatus  20 per hour  per user
 *   otp_request           3 per hour  per phone
 *   login                 5 per hour  per phone
 *
 * Each document key:  `{action}:{identifier}`
 * Each document shape:
 *   { count, windowStart, lockedUntil? }
 */

'use strict';

const admin = require('firebase-admin');
const functions = require('firebase-functions');

/** Rate limit configuration: { windowMs, maxRequests } */
const RATE_LIMITS = {
  submitQuote:         { windowMs: 60 * 1000,        maxRequests: 10 },
  createBooking:       { windowMs: 60 * 60 * 1000,   maxRequests: 5  },
  updateBookingStatus: { windowMs: 60 * 60 * 1000,   maxRequests: 20 },
  otp_request:         { windowMs: 60 * 60 * 1000,   maxRequests: 3  },
  login:               { windowMs: 60 * 60 * 1000,   maxRequests: 5  },
};

/** Lockout duration after repeated rate-limit violations (15 minutes) */
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/**
 * Multiplier applied to maxRequests to determine when a lockout is triggered.
 * A caller is locked out once their count reaches maxRequests * LOCKOUT_THRESHOLD_MULTIPLIER.
 * This provides a grace window before full lockout while still blocking serious abusers.
 */
const LOCKOUT_THRESHOLD_MULTIPLIER = 2;

/**
 * Checks and increments the rate-limit counter for a given action + identifier.
 * Throws an HttpsError with code `resource-exhausted` (HTTP 429) if the limit
 * is exceeded, including a `retryAfterMs` field in the error details.
 *
 * @param {string} action      - One of the keys in RATE_LIMITS.
 * @param {string} identifier  - UID or phone number identifying the caller.
 * @returns {Promise<void>}
 */
async function checkRateLimit(action, identifier) {
  const config = RATE_LIMITS[action];
  if (!config) return; // Unknown action — skip limiting

  const db = admin.firestore();
  const docId = `${action}:${identifier}`;
  const docRef = db.collection('rate_limits').doc(docId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const now = Date.now();

    if (snap.exists) {
      const data = snap.data();

      // Check active lockout
      if (data.lockedUntil && data.lockedUntil > now) {
        const retryAfterMs = data.lockedUntil - now;
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Too many requests. Locked out. Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`,
          { retryAfterMs }
        );
      }

      // Sliding window: reset if window has passed
      if (now - data.windowStart > config.windowMs) {
        tx.set(docRef, { count: 1, windowStart: now });
        return;
      }

      // Within window — enforce limit
      if (data.count >= config.maxRequests) {
        const retryAfterMs = config.windowMs - (now - data.windowStart);
        // Apply lockout for repeated violations (count significantly over limit)
        const updates = { count: admin.firestore.FieldValue.increment(1) };
        if (data.count >= config.maxRequests * LOCKOUT_THRESHOLD_MULTIPLIER) {
          updates.lockedUntil = now + LOCKOUT_DURATION_MS;
        }
        tx.update(docRef, updates);

        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Rate limit exceeded for ${action}. Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`,
          { retryAfterMs }
        );
      }

      // Within limit — increment
      tx.update(docRef, { count: admin.firestore.FieldValue.increment(1) });
    } else {
      // First request in this window
      tx.set(docRef, { count: 1, windowStart: now });
    }
  });
}

/**
 * Resets the rate limit counter for a given action + identifier.
 * Useful for admin operations or after a lockout period.
 *
 * @param {string} action
 * @param {string} identifier
 */
async function resetRateLimit(action, identifier) {
  const db = admin.firestore();
  const docId = `${action}:${identifier}`;
  await db.collection('rate_limits').doc(docId).delete();
}

module.exports = { checkRateLimit, resetRateLimit, RATE_LIMITS };
