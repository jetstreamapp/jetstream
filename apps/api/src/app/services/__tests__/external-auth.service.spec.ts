import { UserProfileUi } from '@jetstream/types';
import { Mock, vi } from 'vitest';
import * as webExtDb from '../../db/web-extension.db';
import {
  AUDIENCE_WEB_EXT,
  classifyExternalAuthFailure,
  EXTERNAL_AUTH_FAILURE_MESSAGE,
  isTokenWithinRefreshWindow,
  rotateToken,
} from '../external-auth.service';
import { decryptJwtTokenOrPlaintext, hashToken } from '../jwt-token-encryption.service';

const SECONDS_PER_DAY = 60 * 60 * 24;

/**
 * Builds a JWT-shaped string with a specific `exp`. decodeToken (fast-jwt's decoder) does not
 * verify the signature, so an unsigned token with the right payload is sufficient for these tests.
 */
function makeTokenWithExp(expUnixSeconds: number): string {
  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp: expUnixSeconds })}.signature`;
}

// Preserve the real constants (TOKEN_TYPE_AUTH, etc.) so assertions compare against the
// actual string values the SUT should be passing — only stub the DB-touching functions.
vi.mock('../../db/web-extension.db', async () => {
  const actual = await vi.importActual<typeof import('../../db/web-extension.db')>('../../db/web-extension.db');
  return {
    ...actual,
    replaceTokenIfCurrent: vi.fn(),
    findByUserIdAndDeviceId: vi.fn(),
  };
});
vi.mock('../jwt-token-encryption.service', async () => {
  const actual = await vi.importActual<typeof import('../jwt-token-encryption.service')>('../jwt-token-encryption.service');
  return {
    ...actual,
    decryptJwtTokenOrPlaintext: vi.fn(),
    hashToken: vi.fn((token: string) => `hash(${token})`),
  };
});

vi.mock('@jetstream/api-config', () => ({
  ENV: {
    JETSTREAM_AUTH_WEB_EXT_JWT_SECRET: 'test-jwt-secret-for-unit-tests-only',
    JWT_ENCRYPTION_KEY: 'test-jwt-encryption-key',
  },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  errorTracker: { error: vi.fn(), warn: vi.fn(), critical: vi.fn(), info: vi.fn() },
  DbCacheProvider: vi.fn().mockImplementation(function () {
    this.saveAsync = vi.fn().mockResolvedValue(null);
    this.getAsync = vi.fn().mockResolvedValue(null);
    this.removeAsync = vi.fn().mockResolvedValue(null);
  }),
}));

const mockWebExtDb = webExtDb as unknown as {
  [K in keyof typeof webExtDb]: ReturnType<typeof vi.fn>;
};

const mockUserProfile = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
} as unknown as UserProfileUi;

const baseArgs = {
  userProfile: mockUserProfile,
  audience: AUDIENCE_WEB_EXT,
  source: 'BROWSER_EXTENSION' as const,
  deviceId: 'device-abc',
  oldAccessToken: 'old-access-token',
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
};

describe('external-auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rotateToken', () => {
    it('returns outcome=rotated with the newly-issued token when replaceTokenIfCurrent wins', async () => {
      mockWebExtDb.replaceTokenIfCurrent.mockResolvedValue(true);
      mockWebExtDb.findByUserIdAndDeviceId.mockResolvedValue(null);

      const result = await rotateToken(baseArgs);

      expect(result.outcome).toBe('rotated');
      expect(typeof result.token).toBe('string');
      // Winner path should not look up the current token
      expect(mockWebExtDb.findByUserIdAndDeviceId).not.toHaveBeenCalled();
      expect(mockWebExtDb.replaceTokenIfCurrent).toHaveBeenCalledWith(
        mockUserProfile.id,
        `hash(${baseArgs.oldAccessToken})`,
        expect.objectContaining({
          type: webExtDb.TOKEN_TYPE_AUTH,
          source: baseArgs.source,
          deviceId: baseArgs.deviceId,
        }),
      );
    });

    it('returns outcome=race-loss-current with the current DB token when rotation race is lost', async () => {
      // The winner already rotated to "winner-token-T1"
      mockWebExtDb.replaceTokenIfCurrent.mockResolvedValue(false);
      mockWebExtDb.findByUserIdAndDeviceId.mockResolvedValue({
        token: 'encrypted-winner-token-T1',
        source: baseArgs.source,
      } as unknown as Awaited<ReturnType<typeof webExtDb.findByUserIdAndDeviceId>>);
      (decryptJwtTokenOrPlaintext as Mock).mockReturnValue('winner-token-T1');

      const result = await rotateToken(baseArgs);

      expect(result).toEqual({ token: 'winner-token-T1', outcome: 'race-loss-current' });
      expect(mockWebExtDb.findByUserIdAndDeviceId).toHaveBeenCalledWith({
        userId: mockUserProfile.id,
        deviceId: baseArgs.deviceId,
        type: webExtDb.TOKEN_TYPE_AUTH,
      });
      expect(decryptJwtTokenOrPlaintext).toHaveBeenCalledWith('encrypted-winner-token-T1');
    });

    it('returns outcome=race-loss-none with undefined token when race is lost and no current token exists in DB', async () => {
      mockWebExtDb.replaceTokenIfCurrent.mockResolvedValue(false);
      mockWebExtDb.findByUserIdAndDeviceId.mockResolvedValue(null);

      const result = await rotateToken(baseArgs);

      expect(result).toEqual({ token: undefined, outcome: 'race-loss-none' });
      expect(decryptJwtTokenOrPlaintext).not.toHaveBeenCalled();
    });

    it('returns outcome=race-loss-none when race is lost and the current DB token has a different source', async () => {
      // A concurrent flow replaced the row with a desktop-source token while a web-ext
      // verify was in flight on the same deviceId. The loser must not receive a
      // wrong-audience token — it should be treated as race-loss-none instead.
      mockWebExtDb.replaceTokenIfCurrent.mockResolvedValue(false);
      mockWebExtDb.findByUserIdAndDeviceId.mockResolvedValue({
        token: 'encrypted-desktop-token',
        source: 'DESKTOP',
      } as unknown as Awaited<ReturnType<typeof webExtDb.findByUserIdAndDeviceId>>);

      const result = await rotateToken(baseArgs);

      expect(result).toEqual({ token: undefined, outcome: 'race-loss-none' });
      expect(decryptJwtTokenOrPlaintext).not.toHaveBeenCalled();
    });
  });

  describe('hashToken integration with rotateToken', () => {
    it('passes the hashed old token to replaceTokenIfCurrent', async () => {
      mockWebExtDb.replaceTokenIfCurrent.mockResolvedValue(true);

      await rotateToken({ ...baseArgs, oldAccessToken: 'specific-old-token' });

      expect(hashToken).toHaveBeenCalledWith('specific-old-token');
      expect(mockWebExtDb.replaceTokenIfCurrent).toHaveBeenCalledWith(mockUserProfile.id, 'hash(specific-old-token)', expect.any(Object));
    });
  });

  describe('isTokenWithinRefreshWindow', () => {
    it('returns false when the token expires further away than the default window (2 days)', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const token = makeTokenWithExp(nowSeconds + 3 * SECONDS_PER_DAY);
      expect(isTokenWithinRefreshWindow(token)).toBe(false);
    });

    it('returns true when the token expires within the default window (2 days)', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const token = makeTokenWithExp(nowSeconds + 1 * SECONDS_PER_DAY);
      expect(isTokenWithinRefreshWindow(token)).toBe(true);
    });

    it('returns true when the token is already expired', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const token = makeTokenWithExp(nowSeconds - 100);
      expect(isTokenWithinRefreshWindow(token)).toBe(true);
    });

    it('honors a custom withinDays threshold', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const token = makeTokenWithExp(nowSeconds + 5 * SECONDS_PER_DAY);
      expect(isTokenWithinRefreshWindow(token, 2)).toBe(false);
      expect(isTokenWithinRefreshWindow(token, 7)).toBe(true);
    });
  });

  describe('classifyExternalAuthFailure', () => {
    // Pins each in-house failure message to its coarse reason so a reword (or a dropped
    // REASON_BY_MESSAGE entry) fails loudly instead of silently mis-routing the client message.
    it.each([
      [EXTERNAL_AUTH_FAILURE_MESSAGE.INVALID_FOR_DEVICE, 'invalid_token'],
      [EXTERNAL_AUTH_FAILURE_MESSAGE.INVALID_FOR_USER, 'invalid_token'],
      [EXTERNAL_AUTH_FAILURE_MESSAGE.USER_NOT_ACTIVE, 'inactive'],
      [EXTERNAL_AUTH_FAILURE_MESSAGE.WEB_EXT_NOT_ENABLED, 'not_entitled'],
      [EXTERNAL_AUTH_FAILURE_MESSAGE.DESKTOP_NOT_ENABLED, 'not_entitled'],
    ])('maps in-house message "%s" to its coarse reason', (message, expected) => {
      expect(classifyExternalAuthFailure(new Error(message))).toBe(expected);
    });

    it('classifies a fast-jwt signature failure as invalid_token', () => {
      expect(classifyExternalAuthFailure(new Error('The token signature is invalid.'))).toBe('invalid_token');
    });

    it('classifies a malformed-token error as invalid_token', () => {
      expect(classifyExternalAuthFailure(new Error('The token is malformed.'))).toBe('invalid_token');
    });

    it('classifies an expired-token error as token_expired', () => {
      expect(classifyExternalAuthFailure(new Error('The token has expired at 1970-01-01T00:00:00.000Z'))).toBe('token_expired');
    });

    it('falls back to unknown for unrelated errors', () => {
      expect(classifyExternalAuthFailure(new Error('Database connection lost'))).toBe('unknown');
    });
  });
});
