import { createCipheriv, randomBytes } from 'crypto';
import { decryptString, encryptString, generateKey } from '../shared-node-utils';

/**
 * Recreate the legacy unauthenticated AES-256-CBC format (`base64(iv)!base64(ciphertext)`) exactly as the
 * previous implementation of encryptString produced it, so we can prove the GCM-by-default decryptString
 * still reads pre-existing production ciphertext.
 */
function encryptStringLegacyCbc(plainText: string, secret: string): string {
  const keyBytes = Buffer.from(secret, 'base64');
  const ivBytes = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', new Uint8Array(keyBytes), new Uint8Array(ivBytes));
  let encryptedValue = cipher.update(plainText, 'utf8', 'base64');
  encryptedValue += cipher.final('base64');
  return `${ivBytes.toString('base64')}!${encryptedValue}`;
}

describe('encryptString / decryptString (versioned)', () => {
  const secret = generateKey();
  const plainText = 'super-secret-salesforce-access-token value';

  it('encryptString produces the authenticated GCM format by default', () => {
    const encrypted = encryptString(plainText, secret);
    expect(encrypted.startsWith('gcm!')).toBe(true);
    // GCM blob must not contain ":" so it survives the colon-delimited envelopes used by callers
    expect(encrypted.includes(':')).toBe(false);
  });

  it('(a) a value encrypted now round-trips via GCM', () => {
    const encrypted = encryptString(plainText, secret);
    expect(encrypted).not.toBe(plainText);
    expect(decryptString(encrypted, secret)).toBe(plainText);
  });

  it('produces a fresh random IV per call (ciphertext differs, plaintext recovers)', () => {
    const first = encryptString(plainText, secret);
    const second = encryptString(plainText, secret);
    expect(first).not.toBe(second);
    expect(decryptString(first, secret)).toBe(plainText);
    expect(decryptString(second, secret)).toBe(plainText);
  });

  it('(b) a previously-CBC-encrypted value still decrypts', () => {
    const legacyEncrypted = encryptStringLegacyCbc(plainText, secret);
    // Sanity-check we built the legacy shape (24-char base64 IV segment, no "gcm!" prefix)
    expect(legacyEncrypted.startsWith('gcm!')).toBe(false);
    expect(legacyEncrypted.split('!')[0].length).toBe(24);
    expect(decryptString(legacyEncrypted, secret)).toBe(plainText);
  });

  it('(c) tampering with the GCM ciphertext causes decrypt to throw', () => {
    const encrypted = encryptString(plainText, secret);
    const payload = Buffer.from(encrypted.slice('gcm!'.length), 'base64');
    // Flip a bit in the ciphertext (after iv[12] + authTag[16])
    payload[payload.length - 1] ^= 0x01;
    const tampered = `gcm!${payload.toString('base64')}`;
    expect(() => decryptString(tampered, secret)).toThrow();
  });

  it('(d) tampering with the GCM auth tag causes decrypt to throw', () => {
    const encrypted = encryptString(plainText, secret);
    const payload = Buffer.from(encrypted.slice('gcm!'.length), 'base64');
    // Flip a bit inside the auth tag (bytes 12..27)
    payload[12] ^= 0x01;
    const tampered = `gcm!${payload.toString('base64')}`;
    expect(() => decryptString(tampered, secret)).toThrow();
  });

  it('throws when the secret is missing', () => {
    expect(() => encryptString(plainText, '')).toThrow();
    expect(() => decryptString(encryptString(plainText, secret), '')).toThrow();
  });

  it('passes through empty values unchanged (matches legacy behavior)', () => {
    expect(encryptString('', secret)).toBe('');
    expect(decryptString('', secret)).toBe('');
  });
});
