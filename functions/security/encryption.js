/**
 * GIGTOS SECURITY — AES-256-GCM FIELD-LEVEL ENCRYPTION
 *
 * Provides encrypt / decrypt helpers for PII fields stored in Firestore.
 *
 * PII fields covered:
 *   users:       phone, email
 *   gig_workers: phone, email, aadhaarNumber
 *   bookings:    userPhone, workerPhone, userAddress
 *
 * Algorithm: AES-256-GCM (authenticated encryption, prevents tampering)
 * Key source: ENCRYPTION_KEY env-var (32-byte hex string) set via Secret Manager.
 *
 * Encrypted format (stored as string):
 *   "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */

'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES  = 12; // 96-bit IV recommended for GCM

/**
 * Returns the raw 32-byte encryption key from the environment.
 * Throws if the key is missing or has an incorrect length.
 */
function _getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error('ENCRYPTION_KEY environment variable is not set.');
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param {string} plaintext
 * @returns {string} Encrypted token: "<iv>:<authTag>:<ciphertext>" (all hex).
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const key = _getKey();
  const iv  = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
}

/**
 * Decrypts an AES-256-GCM token produced by `encrypt`.
 *
 * @param {string} token - "<iv>:<authTag>:<ciphertext>" (all hex).
 * @returns {string} Plaintext.
 */
function decrypt(token) {
  if (token === null || token === undefined) return token;
  const parts = String(token).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format.');
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key        = _getKey();
  const iv         = Buffer.from(ivHex,         'hex');
  const authTag    = Buffer.from(authTagHex,    'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher   = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Returns true if the given value looks like an encrypted token.
 * Useful to avoid double-encrypting already-encrypted values.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p));
}

/**
 * Encrypts the specified PII fields in a data object (in-place).
 * Fields not present in the object are skipped.
 *
 * @param {object} data
 * @param {string[]} fields - Field names to encrypt.
 * @returns {object} The mutated data object.
 */
function encryptFields(data, fields) {
  for (const field of fields) {
    if (data[field] !== undefined && !isEncrypted(data[field])) {
      data[field] = encrypt(data[field]);
    }
  }
  return data;
}

/**
 * Decrypts the specified PII fields in a data object (in-place).
 *
 * @param {object} data
 * @param {string[]} fields
 * @returns {object} The mutated data object.
 */
function decryptFields(data, fields) {
  for (const field of fields) {
    if (data[field] !== undefined && isEncrypted(data[field])) {
      try {
        data[field] = decrypt(data[field]);
      } catch (err) {
        // Log without exposing the encrypted value; leave field as-is
        console.error(`[Encryption] Failed to decrypt field "${field}": ${err.message}`);
      }
    }
  }
  return data;
}

/** PII field definitions per collection */
const PII_FIELDS = {
  users:       ['phone', 'email'],
  gig_workers: ['phone', 'email', 'aadhaarNumber'],
  bookings:    ['userPhone', 'workerPhone', 'userAddress'],
};

module.exports = { encrypt, decrypt, isEncrypted, encryptFields, decryptFields, PII_FIELDS };
