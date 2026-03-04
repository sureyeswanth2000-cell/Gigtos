/**
 * Firestore-based rate limiter for Cloud Functions.
 * Enforces per-user and per-IP request limits to prevent abuse.
 */

const admin = require('firebase-admin');

// Rate limit configuration per function name
const RATE_LIMITS = {
  submitQuote: { maxRequests: 10, windowSeconds: 60 },         // 10 per minute
  createBooking: { maxRequests: 5, windowSeconds: 3600 },       // 5 per hour
  updateBookingStatus: { maxRequests: 20, windowSeconds: 3600 }, // 20 per hour
  otpRequest: { maxRequests: 3, windowSeconds: 3600 },           // 3 per hour per phone
  loginAttempt: { maxRequests: 5, windowSeconds: 3600 },         // 5 per hour per phone
  default: { maxRequests: 30, windowSeconds: 60 },               // 30 per minute (fallback)
};

/**
 * Checks rate limit for a given key and function name using Firestore.
 * Uses a sliding-window counter stored in the rate_limits collection.
 *
 * @param {string} key - Unique identifier (userId or IP address)
 * @param {string} functionName - Name of the function being rate limited
 * @returns {Promise<{allowed: boolean, remaining: number, retryAfter: number}>}
 */
async function checkRateLimit(key, functionName) {
  const db = admin.firestore();
  const config = RATE_LIMITS[functionName] || RATE_LIMITS.default;
  const { maxRequests, windowSeconds } = config;

  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const docId = `${functionName}:${key}`;
  const docRef = db.collection('rate_limits').doc(docId);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const data = doc.exists ? doc.data() : { requests: [] };

    // Filter requests within the current window
    const requests = (data.requests || []).filter(ts => ts > windowStart);

    if (requests.length >= maxRequests) {
      const oldestInWindow = Math.min(...requests);
      const retryAfter = Math.ceil((oldestInWindow + windowSeconds * 1000 - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter: Math.max(retryAfter, 1) };
    }

    // Add current request timestamp
    requests.push(now);
    transaction.set(docRef, {
      requests,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Auto-expire documents 2x the window to allow Firestore TTL cleanup
      expiresAt: new Date(now + windowSeconds * 2 * 1000),
    });

    return {
      allowed: true,
      remaining: maxRequests - requests.length,
      retryAfter: 0,
    };
  });
}

/**
 * Enforces rate limiting in a Cloud Function context.
 * Throws an HttpsError if the rate limit is exceeded.
 *
 * @param {object} context - Firebase Functions call context
 * @param {string} functionName - Name of the function to limit
 * @param {Function} HttpsError - functions.https.HttpsError constructor
 * @param {string} [ipOverride] - Optional IP address for IP-based limiting
 */
async function enforceRateLimit(context, functionName, HttpsError, ipOverride) {
  const uid = context.auth?.uid;
  const ip = ipOverride || context.rawRequest?.ip || 'unknown';

  // Prefer user-based limiting when authenticated; fall back to IP
  const key = uid || `ip:${ip}`;

  const result = await checkRateLimit(key, functionName);
  if (!result.allowed) {
    throw new HttpsError(
      'resource-exhausted',
      `Rate limit exceeded. Please retry after ${result.retryAfter} seconds.`,
      { retryAfter: result.retryAfter }
    );
  }

  return result;
}

module.exports = { checkRateLimit, enforceRateLimit, RATE_LIMITS };
