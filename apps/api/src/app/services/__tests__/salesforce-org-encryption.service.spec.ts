import { decryptString, encryptString } from '@jetstream/shared/node-utils';
import { Mock, vi } from 'vitest';
import { decryptAccessToken, encryptAccessToken } from '../salesforce-org-encryption.service';

vi.mock('@jetstream/shared/node-utils', () => ({
  encryptString: vi.fn(),
  decryptString: vi.fn(),
  hexToBase64: vi.fn((v) => v),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: {
    JWT_ENCRYPTION_KEY: 'test-jwt-key',
    SFDC_ENCRYPTION_KEY: 'test-master-key',
    SFDC_ENCRYPTION_CACHE_MAX_ENTRIES: 10000,
    SFDC_ENCRYPTION_CACHE_TTL_MS: 3600000,
    SFDC_ENCRYPTION_ITERATIONS: 10000,
    SFDC_CONSUMER_SECRET: 'legacy-secret',
  },
  logger: { error: vi.fn() },
  rollbarServer: { error: vi.fn() },
  getExceptionLog: vi.fn((err) => ({ message: err.message })),
  DbCacheProvider: vi.fn().mockImplementation(function () {
    this.saveAsync = vi.fn().mockResolvedValue(null);
    this.getAsync = vi.fn().mockResolvedValue(null);
    this.removeAsync = vi.fn().mockResolvedValue(null);
  }),
}));

describe('salesforce-org-encryption.service', () => {
  const userId = 'user123';
  const accessToken = 'access-token';
  const refreshToken = 'refresh-token';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('encryptAccessToken', () => {
    it('should encrypt tokens and return v2 format', async () => {
      // Mock encryptString to return a predictable value
      (encryptString as Mock).mockReturnValue('encrypted-data');

      const result = await encryptAccessToken({ accessToken, refreshToken, userId });

      // Should match v2:salt:encryptedData format
      const parts = result.split(':');
      expect(parts[0]).toBe('v2');
      expect(parts[2]).toBe('encrypted-data');
      expect(parts[1]).toBeDefined();
      expect(result.startsWith('v2:')).toBe(true);

      // Should call encryptString with correct data
      expect(encryptString).toHaveBeenCalledWith(`${accessToken} ${refreshToken}`, expect.any(String));
    });
  });

  describe('decryptAccessToken', () => {
    it('should decrypt v2 tokens and return access/refresh tokens', async () => {
      // Prepare a v2 token
      const salt = 'test-salt';
      const encryptedData = 'encrypted-data';
      const encryptedAccessToken = `v2:${salt}:${encryptedData}`;

      // Mock decryptString to return the original tokens
      (decryptString as Mock).mockReturnValue(`${accessToken} ${refreshToken}`);

      const result = await decryptAccessToken({ encryptedAccessToken, userId });

      expect(result).toEqual([accessToken, refreshToken]);
      expect(decryptString).toHaveBeenCalledWith(encryptedData, expect.any(String));
    });

    it('should decrypt legacy tokens and return access/refresh tokens', async () => {
      const legacyEncrypted = 'legacy-encrypted-token';
      // Mock decryptString for legacy
      (decryptString as Mock).mockReturnValueOnce(`${accessToken} ${refreshToken}`);

      const result = await decryptAccessToken({ encryptedAccessToken: legacyEncrypted, userId });

      expect(result).toEqual([accessToken, refreshToken]);
      expect(decryptString).toHaveBeenCalledWith(legacyEncrypted, 'legacy-secret');
    });

    it('should return ["invalid", "invalid"] if decryption fails', async () => {
      // v2 format but decryptString throws
      (decryptString as Mock).mockImplementation(() => {
        throw new Error('decryption failed');
      });

      const encryptedAccessToken = `v2:test-salt:encrypted-data`;
      const result = await decryptAccessToken({ encryptedAccessToken, userId });

      expect(result).toEqual(['invalid', 'invalid']);
    });

    it('should return ["invalid", "invalid"] if legacy decryption fails', async () => {
      // legacy format, decryptString throws
      (decryptString as Mock).mockImplementation(() => {
        throw new Error('legacy decryption failed');
      });

      const legacyEncrypted = 'legacy-encrypted-token';
      const result = await decryptAccessToken({ encryptedAccessToken: legacyEncrypted, userId });

      expect(result).toEqual(['invalid', 'invalid']);
    });

    it('should throw error for invalid v2 format', async () => {
      const encryptedAccessToken = `v2:missingparts`;

      const result = await decryptAccessToken({ encryptedAccessToken, userId });

      expect(result).toEqual(['invalid', 'invalid']);
    });
  });
});
