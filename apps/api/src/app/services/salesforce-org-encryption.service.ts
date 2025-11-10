import { ENV, getExceptionLog, logger, rollbarServer } from '@jetstream/api-config';
import { decryptString, encryptString, hexToBase64 } from '@jetstream/shared/node-utils';
import { createHash, pbkdf2, randomBytes } from 'crypto';
import { LRUCache } from 'lru-cache';
import { promisify } from 'util';

/**
 * If decrypt fails, return this dummy value to indicate invalid token
 */
export const DUMMY_INVALID_ENCRYPTED_TOKEN = 'invalid';

const pbkdf2Async = promisify(pbkdf2);

/**
 * Cache for derived encryption keys to avoid expensive PBKDF2 operations
 * Cache keys for 1 hour with max 10,000 entries (configurable via env vars)
 */
const keyCache = new LRUCache<string, string>({
  max: ENV.SFDC_ENCRYPTION_CACHE_MAX_ENTRIES,
  ttl: ENV.SFDC_ENCRYPTION_CACHE_TTL_MS,
});

/**
 * Encryption versions
 * - v1: Legacy encryption using SFDC_CONSUMER_SECRET
 * - v2: Per-user encryption with derived keys
 */
export const EncryptionVersion = {
  V2_PER_USER: 'v2',
};

/**
 * Get configurable iteration count for PBKDF2
 * Allows different values for dev/test/prod environments
 */
function getIterationCount(): number {
  const iterations = ENV.SFDC_ENCRYPTION_ITERATIONS;
  // Minimum 10k iterations for security
  return Math.max(iterations, 10000);
}

/**
 * Derive a unique encryption key for a specific user
 * Uses PBKDF2 to derive a key from the master key and user ID with caching
 */
async function deriveUserKey({ userId, salt }: { userId: string; salt?: string }): Promise<{ key: string; salt: string }> {
  const masterKey = ENV.SFDC_ENCRYPTION_KEY;
  const keySalt = salt || randomBytes(32).toString('base64');

  // Create cache key
  const cacheKey = `${userId}:${keySalt}`;

  // Use cached value if available
  const cachedKey = keyCache.get(cacheKey);
  if (cachedKey) {
    return { key: cachedKey, salt: keySalt };
  }

  const derivedKey = await pbkdf2Async(
    masterKey,
    cacheKey,
    getIterationCount(),
    32, // key length in bytes
    'sha256',
  );

  const keyString = derivedKey.toString('base64');
  keyCache.set(cacheKey, keyString);

  return {
    key: keyString,
    salt: keySalt,
  };
}

/**
 * Encrypt Salesforce tokens with versioning support
 * Returns format: "version:salt:encryptedData" for v2
 */
export async function encryptAccessToken({
  accessToken,
  refreshToken,
  userId,
}: {
  accessToken: string;
  refreshToken: string;
  userId: string;
}): Promise<string> {
  const tokenData = `${accessToken} ${refreshToken}`;

  if (!userId) {
    throw new Error('User ID is required for encryption');
  }

  // Per-user encryption key
  const { key, salt } = await deriveUserKey({ userId });
  const encryptedData = encryptString(tokenData, key);

  // Store version, salt, and encrypted data
  // Format: "v2:salt:encryptedData"
  return `${EncryptionVersion.V2_PER_USER}:${salt}:${encryptedData}`;
}

/**
 * Decrypt Salesforce tokens with automatic version detection (ASYNC VERSION - RECOMMENDED)
 * Handles both legacy (v1) and new (v2) encryption formats
 */
export async function decryptAccessToken({
  encryptedAccessToken,
  userId,
}: {
  encryptedAccessToken: string;
  userId: string;
}): Promise<[string, string]> {
  try {
    // Check if this is the new format (version:salt:data)
    if (encryptedAccessToken.startsWith('v2:')) {
      const [version, salt, encryptedData] = encryptedAccessToken.split(':');

      if (version !== EncryptionVersion.V2_PER_USER || !salt || !encryptedData) {
        throw new Error('Invalid encrypted token format');
      }

      // Derive the same key using the stored salt
      const { key } = await deriveUserKey({ userId, salt });
      const decrypted = decryptString(encryptedData, key);
      const [accessToken, refreshToken] = decrypted.split(' ');
      return [accessToken, refreshToken];
    }

    // Legacy format - decrypt with old method
    try {
      const decrypted = decryptString(encryptedAccessToken, hexToBase64(ENV.SFDC_CONSUMER_SECRET));
      const [accessToken, refreshToken] = decrypted.split(' ');
      return [accessToken, refreshToken];
    } catch (error) {
      logger.error('Failed to decrypt token, it may be corrupted', error);
      throw new Error('Unable to decrypt access token');
    }
  } catch (error) {
    logger.error({ userId, ...getExceptionLog(error) }, 'Failed to decrypt token, it may be corrupted');
    rollbarServer.error('Failed to decrypt token', {
      context: `salesforce-org-encryption.service#decryptAccessToken`,
      custom: {
        ...getExceptionLog(error, true),
      },
    });
    // return invalid data to allow the org to get marked as having invalid credentials once we attempt use them for Salesforce connection
    return [DUMMY_INVALID_ENCRYPTED_TOKEN, DUMMY_INVALID_ENCRYPTED_TOKEN];
  }
}

/**
 * Check if a token is using legacy encryption
 */
export function isLegacyEncryption(encryptedAccessToken: string): boolean {
  return !encryptedAccessToken.startsWith('v2:');
}

/**
 * Generate a fingerprint of the encryption key (for monitoring/debugging)
 * We never want to log the real keys, but can use this as a proxy
 */
export async function getKeyFingerprint(userId: string): Promise<string> {
  const { key } = await deriveUserKey({ userId });
  return createHash('sha256').update(key).digest('hex').substring(0, 8);
}
