import crypto from 'crypto';
import { decryptSecret, encryptSecret } from '../sso-crypto.util';

describe('sso-crypto.util', () => {
  const VALID_SECRET = 'this-is-a-valid-secret-key-that-is-at-least-32-characters-long';
  const SHORT_SECRET = 'too-short';

  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original env var
    originalEnv = process.env.JETSTREAM_AUTH_SSO_SECRET;
    // Set valid secret for tests
    process.env.JETSTREAM_AUTH_SSO_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    // Restore original env var
    if (originalEnv === undefined) {
      delete process.env.JETSTREAM_AUTH_SSO_SECRET;
    } else {
      process.env.JETSTREAM_AUTH_SSO_SECRET = originalEnv;
    }
  });

  describe('encryptSecret', () => {
    it('should encrypt a plaintext string', () => {
      const plaintext = 'my-secret-client-id';
      const encrypted = encryptSecret(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different outputs for the same input (due to random IV)', () => {
      const plaintext = 'my-secret-data';
      const encrypted1 = encryptSecret(plaintext);
      const encrypted2 = encryptSecret(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error if JETSTREAM_AUTH_SSO_SECRET is not set', () => {
      delete process.env.JETSTREAM_AUTH_SSO_SECRET;

      expect(() => encryptSecret('test')).toThrow('JETSTREAM_AUTH_SSO_SECRET environment variable is not set');
    });

    it('should throw error if JETSTREAM_AUTH_SSO_SECRET is too short', () => {
      process.env.JETSTREAM_AUTH_SSO_SECRET = SHORT_SECRET;

      expect(() => encryptSecret('test')).toThrow('JETSTREAM_AUTH_SSO_SECRET must be at least 32 characters long');
    });

    it('should encrypt empty string', () => {
      const encrypted = encryptSecret('');
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should encrypt long strings', () => {
      const longString = 'a'.repeat(10000);
      const encrypted = encryptSecret(longString);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should encrypt special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`\n\t\r';
      const encrypted = encryptSecret(specialChars);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should encrypt unicode characters', () => {
      const unicode = '你好世界 🔐 مرحبا';
      const encrypted = encryptSecret(unicode);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });
  });

  describe('decryptSecret', () => {
    it('should decrypt an encrypted string', () => {
      const plaintext = 'my-secret-value';
      const encrypted = encryptSecret(plaintext);
      const decrypted = decryptSecret(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should round-trip encrypt/decrypt correctly', () => {
      const testCases = [
        'simple-string',
        'with spaces and special chars: !@#$%',
        '',
        'a'.repeat(1000),
        '你好世界',
        'multi\nline\nstring',
        JSON.stringify({ key: 'value', nested: { data: true } }),
      ];

      testCases.forEach((plaintext) => {
        const encrypted = encryptSecret(plaintext);
        const decrypted = decryptSecret(encrypted);
        expect(decrypted).toBe(plaintext);
      });
    });

    it('should throw error if JETSTREAM_AUTH_SSO_SECRET is not set', () => {
      const encrypted = encryptSecret('test');
      delete process.env.JETSTREAM_AUTH_SSO_SECRET;

      expect(() => decryptSecret(encrypted)).toThrow('JETSTREAM_AUTH_SSO_SECRET environment variable is not set');
    });

    it('should throw error if JETSTREAM_AUTH_SSO_SECRET is too short', () => {
      const encrypted = encryptSecret('test');
      process.env.JETSTREAM_AUTH_SSO_SECRET = SHORT_SECRET;

      expect(() => decryptSecret(encrypted)).toThrow('JETSTREAM_AUTH_SSO_SECRET must be at least 32 characters long');
    });

    it('should fail to decrypt with wrong key', () => {
      const plaintext = 'secret-data';
      const encrypted = encryptSecret(plaintext);

      // Change the key
      process.env.JETSTREAM_AUTH_SSO_SECRET = 'different-secret-key-that-is-also-32-characters-or-more';

      expect(() => decryptSecret(encrypted)).toThrow();
    });

    it('should fail to decrypt invalid base64', () => {
      expect(() => decryptSecret('not-valid-base64-!@#$')).toThrow();
    });

    it('should fail to decrypt tampered data', () => {
      const plaintext = 'secret-data';
      const encrypted = encryptSecret(plaintext);

      // Tamper with the encrypted data by changing a character
      const tampered = encrypted.slice(0, -5) + 'AAAAA';

      expect(() => decryptSecret(tampered)).toThrow();
    });

    it('should fail to decrypt data that is too short', () => {
      // Create a base64 string that's too short to contain IV + data + auth tag
      const tooShort = Buffer.from('short').toString('base64');

      expect(() => decryptSecret(tooShort)).toThrow();
    });

    it('should fail to decrypt random data', () => {
      // Create random base64 data that's valid base64 but not a valid encrypted payload
      const randomData = Buffer.from(crypto.randomBytes(64)).toString('base64');

      expect(() => decryptSecret(randomData)).toThrow();
    });
  });

  describe('encryption security properties', () => {
    it('should use authenticated encryption (GCM)', () => {
      const plaintext = 'test-data';
      const encrypted = encryptSecret(plaintext);
      const buffer = Buffer.from(encrypted, 'base64');

      // Buffer should contain: 16 bytes IV + encrypted data + 16 bytes auth tag
      // Minimum size should be 32 bytes (IV + auth tag) even for empty plaintext
      expect(buffer.length).toBeGreaterThanOrEqual(32);
    });

    it('should detect bit flips in ciphertext', () => {
      const plaintext = 'important-data';
      const encrypted = encryptSecret(plaintext);
      const buffer = Buffer.from(encrypted, 'base64');

      // Flip a bit in the middle of the encrypted data (after IV, before auth tag)
      const middleIndex = Math.floor(buffer.length / 2);
      buffer[middleIndex] = buffer[middleIndex] ^ 0x01;

      const tamperedEncrypted = buffer.toString('base64');

      expect(() => decryptSecret(tamperedEncrypted)).toThrow();
    });

    it('should detect modifications to IV', () => {
      const plaintext = 'secret';
      const encrypted = encryptSecret(plaintext);
      const buffer = Buffer.from(encrypted, 'base64');

      // Modify the IV (first 16 bytes)
      buffer[0] = buffer[0] ^ 0x01;

      const tamperedEncrypted = buffer.toString('base64');

      expect(() => decryptSecret(tamperedEncrypted)).toThrow();
    });

    it('should detect modifications to auth tag', () => {
      const plaintext = 'secret';
      const encrypted = encryptSecret(plaintext);
      const buffer = Buffer.from(encrypted, 'base64');

      // Modify the auth tag (last 16 bytes)
      buffer[buffer.length - 1] = buffer[buffer.length - 1] ^ 0x01;

      const tamperedEncrypted = buffer.toString('base64');

      expect(() => decryptSecret(tamperedEncrypted)).toThrow();
    });
  });
});
