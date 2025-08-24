import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export function generateKey(): string {
  // Generates 32 byte cryptographically strong pseudo-random data as a base64 encoded string
  // https://nodejs.org/api/html#crypto_crypto_randombytes_size_callback
  return randomBytes(32).toString('base64');
}

export function hexToBase64(hexStr: string) {
  return Buffer.from(hexStr, 'hex').toString('base64');
}

/**
 * Encrypt a string using standardized encryption of AES256
 * @param plainText value to encrypt
 * @param secret secret to use
 */
export function encryptString(plainText: string, secret: string): string {
  // Attribution: https://github.com/microsoft/botbuilder-js/blob/master/libraries/botframework-config/src/encrypt.ts#L20
  if (!plainText || plainText.length === 0) {
    return plainText;
  }

  if (!secret || secret.length === 0) {
    throw new Error('you must pass a secret');
  }

  const keyBytes = Buffer.from(secret, 'base64');

  // Generates 16 byte cryptographically strong pseudo-random data as IV
  // https://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback
  const ivBytes = randomBytes(16);
  const ivText = ivBytes.toString('base64');

  // encrypt using aes256 iv + key + plainText = encryptedText
  const cipher = createCipheriv('aes-256-cbc', new Uint8Array(keyBytes), new Uint8Array(ivBytes));
  let encryptedValue = cipher.update(plainText, 'utf8', 'base64');
  encryptedValue += cipher.final('base64');

  // store base64(ivBytes)!base64(encryptedValue)
  return `${ivText}!${encryptedValue}`;
}

/**
 * Decrypt a string using standardized encryption of AES256
 * @param encryptedValue value to decrypt
 * @param secret secret to use
 */
export function decryptString(encryptedValue: string, secret: string): string {
  // Attribution: https://github.com/microsoft/botbuilder-js/blob/master/libraries/botframework-config/src/encrypt.ts#L20
  if (!encryptedValue || encryptedValue.length === 0) {
    return encryptedValue;
  }

  if (!secret || secret.length === 0) {
    throw new Error('you must pass a secret');
  }

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
    throw new Error('The secret is not valid format');
  }

  // decrypt using aes256 iv + key + encryptedText = decryptedText
  const decipher = createDecipheriv('aes-256-cbc', new Uint8Array(keyBytes), new Uint8Array(ivBytes));
  let value = decipher.update(encryptedText, 'base64', 'utf8');
  value += decipher.final('utf8');

  return value;
}
