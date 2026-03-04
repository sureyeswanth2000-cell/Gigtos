/**
 * GIGTOS SECURITY — SECRET MANAGER UTILITY
 *
 * Provides secure retrieval of secrets from Google Secret Manager
 * with an in-memory cache to minimise API calls per cold-start.
 *
 * Usage:
 *   const { getSecret } = require('./security/secretManager');
 *   const gmailPass = await getSecret('gmail-pass');
 */

'use strict';

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const client = new SecretManagerServiceClient();

/** In-memory cache: secretName -> { value, expiresAt } */
const cache = new Map();

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Retrieves the latest version of a secret from Google Secret Manager.
 * Results are cached in memory for CACHE_TTL_MS to reduce API round-trips.
 *
 * @param {string} secretName - The short name of the secret (e.g. 'gmail-pass').
 * @param {string} [projectId] - GCP project ID. Defaults to the ADC project.
 * @returns {Promise<string>} The secret payload string value.
 */
async function getSecret(secretName, projectId) {
  const now = Date.now();
  const cached = cache.get(secretName);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const project = projectId || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new Error('GCP project ID not found. Set GCLOUD_PROJECT or pass projectId.');
  }

  const name = `projects/${project}/secrets/${secretName}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  const value = version.payload.data.toString('utf8');

  cache.set(secretName, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

/**
 * Invalidates the in-memory cache entry for a given secret name.
 * Useful after a secret rotation to force a fresh fetch on next access.
 *
 * @param {string} secretName
 */
function invalidateCache(secretName) {
  cache.delete(secretName);
}

/** Clears the entire cache (useful in tests). */
function clearCache() {
  cache.clear();
}

module.exports = { getSecret, invalidateCache, clearCache };
