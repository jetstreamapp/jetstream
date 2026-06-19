import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Versioned encryption format.
 *
 * Legacy/unversioned format (AES-256-CBC, unauthenticated):
 *   base64(iv[16])!base64(ciphertext)
 *
 * Authenticated format (AES-256-GCM):
 *   gcm!base64(iv[12] || authTag[16] || ciphertext)
 *
 * Why the `gcm!` prefix instead of a `v2:` prefix?
 *  - Callers of these primitives wrap the output in colon-delimited envelopes, e.g.
 *    `salesforce-org-encryption.service` stores `v2:<salt>:<encryptString output>` and reconstructs
 *    the inner blob via `string.split(':')[2]`. A `:` inside our blob (or a `v2:` prefix) would be
 *    truncated/ambiguous in that envelope, so the GCM blob must contain NO `:` and must not reuse `v2:`.
 *  - `jwt-token-encryption.service#isTokenEncrypted` distinguishes ciphertext from plaintext JWTs by the
 *    presence of `!`. Keeping `!` in the GCM format preserves that detection.
 *  - The legacy CBC format always begins with a 24-character base64-encoded 16-byte IV before its `!`
 *    separator, so the 3-character `gcm` prefix can never be mistaken for a legacy blob and vice-versa.
 */
const GCM_PREFIX = 'gcm!';
const GCM_IV_LENGTH_BYTES = 12;
const GCM_AUTH_TAG_LENGTH_BYTES = 16;

export function generateKey(): string {
  // Generates 32 byte cryptographically strong pseudo-random data as a base64 encoded string
  // https://nodejs.org/api/html#crypto_crypto_randombytes_size_callback
  return randomBytes(32).toString('base64');
}

export function hexToBase64(hexStr: string) {
  return Buffer.from(hexStr, 'hex').toString('base64');
}

/**
 * Encrypt a string using authenticated encryption (AES-256-GCM).
 *
 * Output format: `gcm!base64(iv[12] || authTag[16] || ciphertext)` (see GCM_PREFIX docs above).
 * Existing CBC ciphertext remains readable via {@link decryptString}; only new writes use GCM.
 *
 * @param plainText value to encrypt
 * @param secret secret to use (base64-encoded 32-byte key)
 */
export function encryptString(plainText: string, secret: string): string {
  if (!plainText || plainText.length === 0) {
    return plainText;
  }

  if (!secret || secret.length === 0) {
    throw new Error('you must pass a secret');
  }

  const keyBytes = Buffer.from(secret, 'base64');

  if (keyBytes.length !== 32) {
    throw new Error('The secret is not a valid format. It must be a base64-encoded 32-byte (AES-256) key.');
  }

  // Generates a 12 byte cryptographically strong pseudo-random IV (the recommended size for GCM)
  // https://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback
  const ivBytes = randomBytes(GCM_IV_LENGTH_BYTES);

  // encrypt using aes-256-gcm iv + key + plainText = ciphertext (+ auth tag)
  const cipher = createCipheriv('aes-256-gcm', new Uint8Array(keyBytes), new Uint8Array(ivBytes));
  const cipherTextBytes = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTagBytes = cipher.getAuthTag();

  // store gcm!base64(iv || authTag || ciphertext)
  const payload = Buffer.concat([ivBytes, authTagBytes, cipherTextBytes]).toString('base64');
  return `${GCM_PREFIX}${payload}`;
}

/**
 * Decrypt a string produced by {@link encryptString}.
 *
 * Auto-detects the format: GCM blobs (prefixed with `gcm!`) are decrypted with auth-tag verification,
 * any other value is treated as the legacy unauthenticated AES-256-CBC format (`base64(iv)!base64(ct)`).
 *
 * @param encryptedValue value to decrypt
 * @param secret secret to use (base64-encoded 32-byte key)
 */
export function decryptString(encryptedValue: string, secret: string): string {
  if (!encryptedValue || encryptedValue.length === 0) {
    return encryptedValue;
  }

  if (!secret || secret.length === 0) {
    throw new Error('you must pass a secret');
  }

  if (encryptedValue.startsWith(GCM_PREFIX)) {
    return decryptStringGcm(encryptedValue, secret);
  }

  return decryptStringCbc(encryptedValue, secret);
}

/**
 * Decrypt an authenticated AES-256-GCM blob.
 * `decipher.final()` throws if the auth tag does not verify (i.e. the ciphertext or tag was tampered with).
 */
function decryptStringGcm(encryptedValue: string, secret: string): string {
  const payload = Buffer.from(encryptedValue.slice(GCM_PREFIX.length), 'base64');

  const minimumLength = GCM_IV_LENGTH_BYTES + GCM_AUTH_TAG_LENGTH_BYTES;
  if (payload.length < minimumLength) {
    throw new Error('The encrypted value is not a valid format');
  }

  const ivBytes = payload.subarray(0, GCM_IV_LENGTH_BYTES);
  const authTagBytes = payload.subarray(GCM_IV_LENGTH_BYTES, minimumLength);
  const cipherTextBytes = payload.subarray(minimumLength);

  const keyBytes = Buffer.from(secret, 'base64');
  if (keyBytes.length !== 32) {
    throw new Error('The secret is not a valid format. It must be a base64-encoded 32-byte (AES-256) key.');
  }

  const decipher = createDecipheriv('aes-256-gcm', new Uint8Array(keyBytes), new Uint8Array(ivBytes));
  decipher.setAuthTag(new Uint8Array(authTagBytes));
  // decipher.final() verifies the auth tag and throws on mismatch
  const value = Buffer.concat([decipher.update(new Uint8Array(cipherTextBytes)), decipher.final()]);

  return value.toString('utf8');
}

/**
 * Decrypt a legacy unauthenticated AES-256-CBC blob: `base64(ivBytes)!base64(encryptedValue)`.
 *
 * SECURITY DEBT: CBC ciphertext is not authenticated. This read path exists only for backward
 * compatibility with already-stored data and should be retired after a one-time re-encryption migration
 * to the GCM format produced by {@link encryptString}.
 */
function decryptStringCbc(encryptedValue: string, secret: string): string {
  // Attribution: https://github.com/microsoft/botbuilder-js/blob/master/libraries/botframework-config/src/encrypt.ts#L20
  // encrypted value = base64(ivBytes)!base64(encryptedValue)
  const [ivText, encryptedText, _empty]: string[] = encryptedValue.split('!');
  if (!ivText || !encryptedText || !!_empty) {
    throw new Error('The encrypted value is not a valid format');
  }

  const ivBytes = Buffer.from(ivText, 'base64');
  const keyBytes = Buffer.from(secret, 'base64');

  if (ivBytes.length !== 16) {
    throw new Error('The encrypted value is not a valid format');
  }

  if (keyBytes.length !== 32) {
    throw new Error('The secret is not a valid format. It must be a base64-encoded 32-byte (AES-256) key.');
  }

  // decrypt using aes256 iv + key + encryptedText = decryptedText
  const decipher = createDecipheriv('aes-256-cbc', new Uint8Array(keyBytes), new Uint8Array(ivBytes));
  let value = decipher.update(encryptedText, 'base64', 'utf8');
  value += decipher.final('utf8');

  return value;
}
