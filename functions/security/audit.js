/**
 * GIGTO SECURITY — AUDIT LOGGER
 *
 * Writes security-relevant events to the `security_logs` Firestore collection.
 * All writes use the Admin SDK so client rules cannot suppress them.
 *
 * Log schema:
 *   event        {string}  — event type identifier (see EVENT_TYPES)
 *   actorId      {string}  — UID of the user performing the action (if known)
 *   actorRole    {string}  — 'user' | 'admin' | 'superadmin' | 'system'
 *   targetId     {string}  — ID of the affected resource (bookingId, phone, etc.)
 *   ip           {string}  — caller IP address (from context.rawRequest if available)
 *   userAgent    {string}  — caller user-agent
 *   outcome      {string}  — 'success' | 'failure' | 'blocked'
 *   details      {object}  — arbitrary extra details
 *   timestamp    {FieldValue.serverTimestamp()}
 */

'use strict';

const admin = require('firebase-admin');

/** Canonical event type identifiers */
const EVENT_TYPES = {
  AUTH_SUCCESS:          'auth_success',
  AUTH_FAILURE:          'auth_failure',
  AUTHZ_FAILURE:         'authorization_failure',
  RATE_LIMIT_VIOLATION:  'rate_limit_violation',
  OTP_FAILURE:           'otp_failure',
  OTP_LOCKOUT:           'otp_lockout',
  SUSPICIOUS_ACTIVITY:   'suspicious_activity',
  DATA_ACCESS:           'data_access',
  ADMIN_ACTION:          'admin_action',
  SECRET_ACCESS:         'secret_access',
  ENCRYPTION_ERROR:      'encryption_error',
};

/**
 * Writes a structured security log entry to `security_logs`.
 * Failures are swallowed to prevent logging from breaking the main flow.
 *
 * @param {object} opts
 * @param {string}  opts.event       - Event type (use EVENT_TYPES constants).
 * @param {string}  [opts.actorId]   - UID performing the action.
 * @param {string}  [opts.actorRole] - Role of the actor.
 * @param {string}  [opts.targetId]  - Affected resource ID.
 * @param {string}  [opts.ip]        - Caller IP address.
 * @param {string}  [opts.userAgent] - Caller user-agent string.
 * @param {string}  [opts.outcome]   - 'success' | 'failure' | 'blocked'.
 * @param {object}  [opts.details]   - Additional context.
 */
async function logSecurityEvent({ event, actorId, actorRole, targetId, ip, userAgent, outcome, details }) {
  const entry = {
    event,
    actorId:   actorId   || null,
    actorRole: actorRole || 'unknown',
    targetId:  targetId  || null,
    ip:        ip        || null,
    userAgent: userAgent || null,
    outcome:   outcome   || 'unknown',
    details:   details   || {},
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const db = admin.firestore();
    await db.collection('security_logs').add(entry);
  } catch (err) {
    // Fallback: emit to Cloud Logging so the event is never silently lost
    console.error('[AuditLog] Firestore write failed — falling back to Cloud Logging:', JSON.stringify({ ...entry, timestamp: new Date().toISOString() }));
  }
}

/**
 * Extracts the caller IP and user-agent from a Cloud Function context or
 * rawRequest object.
 *
 * @param {object} context - Firebase Functions callable context.
 * @returns {{ ip: string|null, userAgent: string|null }}
 */
function extractCallerInfo(context) {
  const req = context?.rawRequest;
  if (!req) return { ip: null, userAgent: null };
  const ip = (req.headers?.['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || null;
  const userAgent = req.headers?.['user-agent'] || null;
  return { ip, userAgent };
}

module.exports = { logSecurityEvent, extractCallerInfo, EVENT_TYPES };
