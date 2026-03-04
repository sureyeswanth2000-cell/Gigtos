/**
 * Field-level AES-256-CBC encryption utilities for protecting PII in Firestore.
 * Encrypts sensitive fields (phone, email, address) before storage.
 */

const crypto = require('crypto');
const { getEncryptionKey } = require('./secretManager');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

let _cachedKey = null;

const ENCRYPTION_KEY_LENGTH = 32; // 256-bit key = 32 bytes = 64 hex characters

/**
 * Derives a 32-byte Buffer from the hex-encoded encryption key.
 * @returns {Promise<Buffer>}
 */
async function getDerivedKey() {
  if (_cachedKey) return _cachedKey;
  const rawKey = await getEncryptionKey();
  if (!rawKey) throw new Error('Encryption key not configured.');
  const keyBuffer = Buffer.from(rawKey, 'hex');
  if (keyBuffer.length !== ENCRYPTION_KEY_LENGTH) {
    throw new Error(`Encryption key must be exactly ${ENCRYPTION_KEY_LENGTH * 2} hex characters (${ENCRYPTION_KEY_LENGTH} bytes). Got ${keyBuffer.length} bytes.`);
  }
  _cachedKey = keyBuffer;
  return _cachedKey;
}

/**
 * Encrypts a plaintext string using AES-256-CBC.
 * Returns a colon-delimited string: "<iv_hex>:<ciphertext_hex>"
 *
 * @param {string} plaintext - The value to encrypt
 * @returns {Promise<string>} Encrypted string
 */
async function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const key = await getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a value previously encrypted by encrypt().
 *
 * @param {string} encryptedValue - "<iv_hex>:<ciphertext_hex>"
 * @returns {Promise<string>} Decrypted plaintext
 */
async function decrypt(encryptedValue) {
  if (!encryptedValue || !encryptedValue.includes(':')) return encryptedValue;
  const key = await getDerivedKey();
  const [ivHex, ciphertextHex] = encryptedValue.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Encrypts PII fields in an object before writing to Firestore.
 * Only encrypts fields that are present and non-null.
 *
 * @param {object} data - Document data
 * @param {string[]} fields - Field names to encrypt
 * @returns {Promise<object>} New object with encrypted fields
 */
async function encryptFields(data, fields) {
  const result = { ...data };
  await Promise.all(
    fields.map(async (field) => {
      if (result[field] != null) {
        result[field] = await encrypt(result[field]);
      }
    })
  );
  return result;
}

/**
 * Decrypts PII fields in a Firestore document object.
 *
 * @param {object} data - Document data from Firestore
 * @param {string[]} fields - Field names to decrypt
 * @returns {Promise<object>} New object with decrypted fields
 */
async function decryptFields(data, fields) {
  const result = { ...data };
  await Promise.all(
    fields.map(async (field) => {
      if (result[field] != null) {
        try {
          result[field] = await decrypt(result[field]);
        } catch (err) {
          console.error(`[Encryption] Failed to decrypt field "${field}":`, err.message);
          // Return encrypted value as-is; caller should handle unreadable data
        }
      }
    })
  );
  return result;
}

// Standard PII field sets
const USER_PII_FIELDS = ['phone', 'email', 'address'];
const WORKER_PII_FIELDS = ['phone', 'email', 'address'];
const BOOKING_PII_FIELDS = ['phone', 'email', 'address'];

module.exports = {
  encrypt,
  decrypt,
  encryptFields,
  decryptFields,
  USER_PII_FIELDS,
  WORKER_PII_FIELDS,
  BOOKING_PII_FIELDS,
};
