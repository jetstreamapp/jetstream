import { ENV, errorTracker, logger } from '@jetstream/api-config';
import { decryptString, encryptString } from '@jetstream/shared/node-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { createHash } from 'crypto';

/**
 * Encryption service for JWT access tokens stored in the database
 *
 * Uses the versioned encryptString/decryptString primitives with the JWT_ENCRYPTION_KEY to encrypt JWT
 * tokens before storing them in the database for compliance and defense-in-depth. New tokens are written
 * with authenticated AES-256-GCM (`gcm!...`); previously-stored AES-256-CBC tokens remain decryptable.
 *
 * Token hash (SHA-256) is stored alongside encrypted token for efficient lookups.
 */

/**
 * Encrypt a JWT token before storing in database
 *
 * @param token - The JWT token to encrypt
 * @returns Encrypted token string (authenticated GCM format `gcm!...`)
 */
export function encryptJwtToken(token: string): string {
  if (!token || token.length === 0) {
    throw new Error('Token cannot be empty');
  }

  const encryptionKey = ENV.JWT_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('JWT_ENCRYPTION_KEY is not configured');
  }

  try {
    return encryptString(token, encryptionKey);
  } catch (error) {
    logger.error({ err: error }, 'Failed to encrypt JWT token');
    errorTracker.error('Failed to encrypt JWT token', error, {
      context: 'jwt-token-encryption.service#encryptJwtToken',
    });
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt a JWT token retrieved from database
 *
 * @param encryptedToken - The encrypted token from database
 * @returns Decrypted JWT token string
 */
export function decryptJwtToken(encryptedToken: string): string {
  if (!encryptedToken || encryptedToken.length === 0) {
    throw new Error('Encrypted token cannot be empty');
  }

  const encryptionKey = ENV.JWT_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('JWT_ENCRYPTION_KEY is not configured');
  }

  try {
    return decryptString(encryptedToken, encryptionKey);
  } catch (error) {
    logger.error({ err: error }, 'Failed to decrypt JWT token');
    errorTracker.error('Failed to decrypt JWT token', error, {
      context: 'jwt-token-encryption.service#decryptJwtToken',
    });
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Generate SHA-256 hash of a token for database lookups
 *
 * This hash is stored in the tokenHash column to enable efficient
 * queries without decrypting all tokens.
 *
 * @param token - The plain JWT token (before encryption)
 * @returns SHA-256 hash as hex string (64 characters)
 */
export function hashToken(token: string): string {
  if (!token || token.length === 0) {
    throw new Error('Token cannot be empty');
  }

  return createHash('sha256').update(token).digest('hex');
}

/**
 * Detect if a token is encrypted based on format
 * Encrypted tokens always contain a "!" separator: legacy CBC blobs are "iv!encryptedData" and the new
 * authenticated GCM blobs are "gcm!payload". Plain JWTs use "." separators and never contain "!".
 *
 * @param token - Token to check
 * @returns true if token appears to be encrypted
 */
export function isTokenEncrypted(token: string): boolean {
  // Both encryption formats (CBC `iv!...` and GCM `gcm!...`) contain "!"; JWTs never do, so this is safe.
  return token.includes('!');
}

/**
 * Attempt to decrypt a token that might be in legacy (unencrypted) format
 *
 * This supports backward compatibility during migration from unencrypted to encrypted tokens.
 * If decryption fails, assumes the token is already in plain text format.
 *
 * TODO: after full migration we can remove this in favor of always using decryptJwtToken
 * Ticket for removal: #1494
 *
 * @param possiblyEncryptedToken - Token that might be encrypted or plain text
 * @returns Decrypted token or original token if it was plain text
 */
export function decryptJwtTokenOrPlaintext(possiblyEncryptedToken: string): string {
  if (!possiblyEncryptedToken || possiblyEncryptedToken.length === 0) {
    throw new Error('Token cannot be empty');
  }

  // If token looks encrypted, decrypt it
  if (isTokenEncrypted(possiblyEncryptedToken)) {
    try {
      return decryptJwtToken(possiblyEncryptedToken);
    } catch (ex) {
      // If decryption fails, it might be a legacy token that happens to have "!" in it
      logger.warn(
        { error: getErrorMessage(ex), token: possiblyEncryptedToken.substring(0, 20) },
        'Failed to decrypt token, treating as plaintext (legacy format)',
      );
      return possiblyEncryptedToken;
    }
  }

  // Token doesn't look encrypted, return as-is (legacy plaintext format)
  return possiblyEncryptedToken;
}
