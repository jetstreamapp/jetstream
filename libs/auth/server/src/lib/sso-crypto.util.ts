import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 32-byte key from the SSO secret using SHA-256
 * This allows using a passphrase instead of requiring exact 32-byte key
 */
function getKey(): Buffer {
  const SECRET_KEY = process.env.JETSTREAM_AUTH_SSO_SECRET;
  
  if (!SECRET_KEY) {
    throw new Error('JETSTREAM_AUTH_SSO_SECRET environment variable is not set');
  }
  
  if (SECRET_KEY.length < 32) {
    throw new Error('JETSTREAM_AUTH_SSO_SECRET must be at least 32 characters long');
  }
  
  return crypto.createHash('sha256').update(SECRET_KEY).digest();
}

/**
 * Encrypts a secret using AES-256-GCM
 * Returns: base64 encoded string containing IV + encrypted data + auth tag
 * 
 * Used to encrypt sensitive SSO data before storing in database:
 * - OIDC client secrets
 * - SAML private keys
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  // Concatenate IV + encrypted data + auth tag and encode as base64
  const combined = Buffer.concat([iv, Buffer.from(encrypted, 'hex'), authTag]);
  return combined.toString('base64');
}

/**
 * Decrypts a secret that was encrypted with encryptSecret
 * Throws if decryption fails (wrong key, tampered data, etc.)
 */
export function decryptSecret(encrypted: string): string {
  const key = getKey();
  const combined = Buffer.from(encrypted, 'base64');
  
  // Extract IV, encrypted data, and auth tag
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encryptedData = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
