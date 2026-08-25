/**
 * Secret Manager Integration Service
 * Follows Enterprise Directive #4: Zero-Hardcoding Hygiene
 * Dynamically accesses secrets from Google Cloud Secret Manager with fallback to environment variables.
 */

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

let secretClient = null;
const secretCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes cache

function getClient() {
  if (!secretClient) {
    try {
      secretClient = new SecretManagerServiceClient();
    } catch (err) {
      console.warn('[SecretManager] Failed to instantiate SecretManagerServiceClient:', err.message);
    }
  }
  return secretClient;
}

/**
 * Access a secret from Google Cloud Secret Manager or environment variables
 * @param {string} secretName - Name of the secret in GCP Secret Manager (e.g., 'GEMINI_API_KEY')
 * @param {string} fallbackEnvVar - Environment variable name to fall back to (default: secretName)
 * @param {string} version - Version of the secret (default: 'latest')
 * @returns {Promise<string|null>} - The secret payload as a string
 */
async function getSecret(secretName, fallbackEnvVar = secretName, version = 'latest') {
  // 1. Check in-memory cache
  const cached = secretCache.get(secretName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  // 2. Check local environment variable first (useful for local dev & Cloud Run injected env vars)
  if (process.env[fallbackEnvVar]) {
    const val = process.env[fallbackEnvVar].trim();
    if (val && !val.startsWith('YOUR_')) {
      secretCache.set(secretName, { value: val, timestamp: Date.now() });
      return val;
    }
  }

  // 3. Query Google Cloud Secret Manager
  const client = getClient();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;

  if (client && projectId) {
    try {
      const name = `projects/${projectId}/secrets/${secretName}/versions/${version}`;
      console.log(`[SecretManager] Accessing secret from GCP: ${name}`);
      const [response] = await client.accessSecretVersion({ name });
      const secretValue = response.payload.data.toString('utf8').trim();
      secretCache.set(secretName, { value: secretValue, timestamp: Date.now() });
      return secretValue;
    } catch (err) {
      console.warn(`[SecretManager] GCP Secret retrieval failed for "${secretName}": ${err.message}`);
    }
  }

  // 4. Return environment variable if available
  return process.env[fallbackEnvVar] || null;
}

module.exports = {
  getSecret
};
