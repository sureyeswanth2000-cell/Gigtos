/**
 * Secret Manager utility for retrieving secrets from Google Secret Manager.
 * Falls back to Firebase functions.config() for local development.
 */

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const functions = require('firebase-functions');

const client = new SecretManagerServiceClient();
const secretCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieves a secret from Google Secret Manager with in-memory caching.
 * @param {string} secretName - Full secret name (projects/PROJECT_ID/secrets/NAME/versions/latest)
 * @returns {Promise<string>} The secret value
 */
async function getSecret(secretName) {
  const cached = secretCache.get(secretName);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const [version] = await client.accessSecretVersion({ name: secretName });
    const value = version.payload.data.toString('utf8');
    secretCache.set(secretName, { value, fetchedAt: Date.now() });
    return value;
  } catch (err) {
    console.error(`[SecretManager] Failed to fetch secret "${secretName}":`, err.message);
    throw new Error(`Secret retrieval failed for: ${secretName}`);
  }
}

/**
 * Resolves a secret by short name using the Firebase project ID.
 * @param {string} name - Short secret name (e.g. "gmail-user")
 * @returns {Promise<string>}
 */
async function resolveSecret(name) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error('GCLOUD_PROJECT environment variable not set.');
  return getSecret(`projects/${projectId}/secrets/${name}/versions/latest`);
}

/**
 * Retrieves Gmail credentials from Secret Manager, with fallback to functions.config().
 * @returns {Promise<{user: string, pass: string}>}
 */
async function getGmailCredentials() {
  try {
    const [user, pass] = await Promise.all([
      resolveSecret('gmail-user'),
      resolveSecret('gmail-pass'),
    ]);
    return { user, pass };
  } catch {
    // Fallback for local dev / functions.config()
    return {
      user: functions.config().gmail?.user,
      pass: functions.config().gmail?.pass,
    };
  }
}

/**
 * Retrieves Twilio credentials from Secret Manager, with fallback to functions.config().
 * @returns {Promise<{sid: string, token: string, phone: string}>}
 */
async function getTwilioCredentials() {
  try {
    const [sid, token, phone] = await Promise.all([
      resolveSecret('twilio-sid'),
      resolveSecret('twilio-token'),
      resolveSecret('twilio-phone'),
    ]);
    return { sid, token, phone };
  } catch {
    const cfg = functions.config().twilio || {};
    return { sid: cfg.sid, token: cfg.token, phone: cfg.phone };
  }
}

/**
 * Retrieves the field-level encryption key from Secret Manager.
 * @returns {Promise<string>} 32-byte hex-encoded key
 */
async function getEncryptionKey() {
  try {
    return await resolveSecret('field-encryption-key');
  } catch {
    return functions.config().encryption?.key;
  }
}

/**
 * Clears the secret cache (useful for key rotation testing).
 */
function clearSecretCache() {
  secretCache.clear();
}

module.exports = {
  getSecret,
  resolveSecret,
  getGmailCredentials,
  getTwilioCredentials,
  getEncryptionKey,
  clearSecretCache,
};
