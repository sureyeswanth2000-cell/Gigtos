/**
 * Security audit logging for the Gigtos platform.
 * Records security-relevant events in a dedicated security_logs collection.
 */

const admin = require('firebase-admin');

// Alert threshold: number of same-type events from same user within the window to trigger an alert
const ALERT_THRESHOLD = 3;
const SECURITY_EVENTS = {
  FAILED_LOGIN: 'failed_login',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  OTP_FAILED: 'otp_failed',
  OTP_EXPIRED: 'otp_expired',
  SECRET_ACCESS: 'secret_access',
  DATA_ENCRYPTED: 'data_encrypted',
  FUNCTION_INVOKED: 'function_invoked',
};

/**
 * Writes a security event to the security_logs Firestore collection.
 *
 * @param {string} eventType - One of SECURITY_EVENTS values
 * @param {object} details - Additional event details
 * @param {object} [context] - Firebase Functions call context (optional)
 */
async function logSecurityEvent(eventType, details = {}, context = null) {
  const db = admin.firestore();

  const logEntry = {
    eventType,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    uid: context?.auth?.uid || details.uid || null,
    ip: context?.rawRequest?.ip || details.ip || null,
    userAgent: context?.rawRequest?.headers?.['user-agent'] || details.userAgent || null,
    ...details,
  };

  try {
    await db.collection('security_logs').add(logEntry);
  } catch (err) {
    // Never let logging errors break the main flow
    console.error('[AuditLog] Failed to write security log:', err.message);
  }

  // Auto-alert for high-severity events
  await _checkAlertThresholds(eventType, logEntry);
}

/**
 * Checks if alert thresholds have been crossed and logs a system alert.
 * (In production, this can trigger a PubSub message, email, or Cloud Monitoring alert.)
 */
async function _checkAlertThresholds(eventType, logEntry) {
  const db = admin.firestore();
  const HIGH_SEVERITY_EVENTS = [
    SECURITY_EVENTS.UNAUTHORIZED_ACCESS,
    SECURITY_EVENTS.SUSPICIOUS_ACTIVITY,
    SECURITY_EVENTS.RATE_LIMIT_EXCEEDED,
  ];

  if (!HIGH_SEVERITY_EVENTS.includes(eventType)) return;

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  try {
    const recentSnap = await db.collection('security_logs')
      .where('eventType', '==', eventType)
      .where('uid', '==', logEntry.uid)
      .where('timestamp', '>=', fiveMinutesAgo)
      .get();

    // Alert if there are ALERT_THRESHOLD or more of the same event from the same user in 5 minutes
    if (recentSnap.size >= ALERT_THRESHOLD) {
      console.warn(
        `[SECURITY ALERT] ${recentSnap.size} "${eventType}" events for uid=${logEntry.uid} in 5 min`
      );
    }
  } catch (err) {
    console.error('[AuditLog] Alert threshold check failed:', err.message);
  }
}

/**
 * Logs a failed OTP attempt for fraud detection.
 * @param {string} phone - Phone number that attempted OTP
 * @param {string} [uid] - User ID if known
 * @param {object} [context] - Firebase Functions call context
 */
async function logOtpFailure(phone, uid, context) {
  return logSecurityEvent(SECURITY_EVENTS.OTP_FAILED, { phone, uid }, context);
}

/**
 * Logs a rate limit violation.
 * @param {string} functionName - The function that was rate-limited
 * @param {string} key - The limiting key (uid or IP)
 * @param {object} [context] - Firebase Functions call context
 */
async function logRateLimitViolation(functionName, key, context) {
  return logSecurityEvent(
    SECURITY_EVENTS.RATE_LIMIT_EXCEEDED,
    { functionName, key },
    context
  );
}

/**
 * Logs an unauthorized access attempt.
 * @param {string} resource - The resource that was accessed
 * @param {string} reason - Why the access was denied
 * @param {object} [context] - Firebase Functions call context
 */
async function logUnauthorizedAccess(resource, reason, context) {
  return logSecurityEvent(
    SECURITY_EVENTS.UNAUTHORIZED_ACCESS,
    { resource, reason },
    context
  );
}

module.exports = {
  SECURITY_EVENTS,
  logSecurityEvent,
  logOtpFailure,
  logRateLimitViolation,
  logUnauthorizedAccess,
};
