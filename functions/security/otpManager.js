/**
 * GIGTO SECURITY — OTP MANAGER
 *
 * Secure OTP lifecycle management:
 *   - bcrypt-hashed OTP storage (never stored in plaintext)
 *   - 5-minute expiry
 *   - Max 3 verification attempts per OTP
 *   - 15-minute account lockout after exhausting attempts
 *   - Audit logging for all failures
 *
 * Firestore collection: `otp_records`
 * Document ID: phone number (E.164)
 */

'use strict';

const crypto = require('crypto');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const functions = require('firebase-functions');

const OTP_EXPIRY_MS    = 5  * 60 * 1000;  // 5 minutes
const MAX_ATTEMPTS     = 3;
const LOCKOUT_MS       = 15 * 60 * 1000;  // 15 minutes
const BCRYPT_ROUNDS    = 10;

/**
 * Generates a cryptographically random 6-digit OTP,
 * hashes it with bcrypt, and stores the hash in Firestore.
 *
 * @param {string} phone - E.164 phone number.
 * @returns {Promise<string>} The plaintext OTP (send to user, do NOT persist).
 */
async function generateOtp(phone) {
  const db = admin.firestore();
  const otp = String(crypto.randomInt(100000, 1000000));
  const hash = await bcrypt.hash(otp, BCRYPT_ROUNDS);

  await db.collection('otp_records').doc(phone).set({
    hash,
    createdAt: Date.now(),
    attempts: 0,
    lockedUntil: null,
  });

  return otp;
}

/**
 * Verifies a user-supplied OTP against the stored bcrypt hash.
 * Enforces expiry, attempt limits, and lockout.
 *
 * @param {string} phone     - E.164 phone number.
 * @param {string} otpInput  - 6-digit string provided by the user.
 * @returns {Promise<boolean>} True if OTP is valid.
 * @throws {functions.https.HttpsError} On lockout, expiry, or max attempts.
 */
async function verifyOtp(phone, otpInput) {
  const db = admin.firestore();
  const docRef = db.collection('otp_records').doc(phone);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'No OTP found for this number. Please request a new one.');
  }

  const data = snap.data();
  const now  = Date.now();

  // Lockout check
  if (data.lockedUntil && data.lockedUntil > now) {
    const retryAfterSec = Math.ceil((data.lockedUntil - now) / 1000);
    await _logOtpFailure(phone, 'lockout_active');
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Account locked. Retry after ${retryAfterSec} seconds.`,
      { retryAfterSec }
    );
  }

  // Expiry check
  if (now - data.createdAt > OTP_EXPIRY_MS) {
    await docRef.delete();
    await _logOtpFailure(phone, 'otp_expired');
    throw new functions.https.HttpsError('deadline-exceeded', 'OTP has expired. Please request a new one.');
  }

  // Attempt limit check
  if (data.attempts >= MAX_ATTEMPTS) {
    await docRef.update({ lockedUntil: now + LOCKOUT_MS });
    await _logOtpFailure(phone, 'max_attempts_exceeded');
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Maximum verification attempts reached. Account locked for 15 minutes.`
    );
  }

  // Verify hash
  const isValid = await bcrypt.compare(String(otpInput), data.hash);
  if (!isValid) {
    const newAttempts = (data.attempts || 0) + 1;
    const updates = { attempts: newAttempts };
    if (newAttempts >= MAX_ATTEMPTS) {
      updates.lockedUntil = now + LOCKOUT_MS;
    }
    await docRef.update(updates);
    await _logOtpFailure(phone, 'invalid_otp', { attemptsLeft: MAX_ATTEMPTS - newAttempts });
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Invalid OTP. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`
    );
  }

  // Success — remove the record so it cannot be reused
  await docRef.delete();
  return true;
}

/**
 * Clears any existing OTP record for a phone number.
 * Call this when the user requests a new OTP mid-flow.
 *
 * @param {string} phone
 */
async function clearOtp(phone) {
  const db = admin.firestore();
  await db.collection('otp_records').doc(phone).delete();
}

/** Internal: writes a security log entry for OTP failures. */
async function _logOtpFailure(phone, reason, extra = {}) {
  try {
    const db = admin.firestore();
    await db.collection('security_logs').add({
      event: 'otp_failure',
      phone,
      reason,
      ...extra,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (_) { /* non-fatal */ }
}

module.exports = { generateOtp, verifyOtp, clearOtp };
