import { enrichRequestContext } from '@jetstream/api-config';
import { HTTP } from '@jetstream/shared/constants';
import { UserProfileUi } from '@jetstream/types';
import * as express from 'express';
import { Mock, vi } from 'vitest';
import * as webExtDb from '../../db/web-extension.db';
import { AuthenticationError, ServiceUnavailableError } from '../../utils/error-handler';
import {
  addDeviceIdToLocals,
  AUDIENCE_DESKTOP,
  AUDIENCE_WEB_EXT,
  findDeviceEnvironmentChange,
  getDeviceId,
  getExternalAuthMiddleware,
  invalidateCacheEntry,
  issueAccessToken,
  isTokenWithinRefreshWindow,
  logDeviceEnvironmentChange,
  rotateToken,
  verifyToken,
  type Audience,
} from '../external-auth.service';
import { decryptJwtToken, hashToken } from '../jwt-token-encryption.service';

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
    findByAccessTokenAndDeviceId: vi.fn(),
  };
});
vi.mock('../jwt-token-encryption.service', async () => {
  const actual = await vi.importActual<typeof import('../jwt-token-encryption.service')>('../jwt-token-encryption.service');
  return {
    ...actual,
    decryptJwtToken: vi.fn(),
    hashToken: vi.fn((token: string) => `hash(${token})`),
  };
});

vi.mock('@jetstream/api-config', () => ({
  ENV: {
    JETSTREAM_AUTH_WEB_EXT_JWT_SECRET: 'test-jwt-secret-for-unit-tests-only',
    JWT_ENCRYPTION_KEY: 'test-jwt-encryption-key',
  },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  getLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  enrichRequestContext: vi.fn(),
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

function buildRequest({ headers, body, query }: { headers?: Record<string, string>; body?: unknown; query?: unknown } = {}) {
  return {
    get: (name: string) => headers?.[name],
    body,
    query,
  } as unknown as express.Request;
}

function buildResponse(locals: Record<string, unknown> = {}) {
  return { locals } as unknown as express.Response;
}

const baseArgs = {
  userProfile: mockUserProfile,
  audience: AUDIENCE_WEB_EXT as Audience,
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

    it('writes the host environment the client reports into the replaced row', async () => {
      mockWebExtDb.replaceTokenIfCurrent.mockResolvedValue(true);

      await rotateToken({ ...baseArgs, clientInfo: { platform: 'darwin', osVersion: '12.7.6', appVersion: '10.15.2' } });

      expect(mockWebExtDb.replaceTokenIfCurrent).toHaveBeenCalledWith(
        mockUserProfile.id,
        expect.any(String),
        expect.objectContaining({ platform: 'darwin', osVersion: '12.7.6', appVersion: '10.15.2' }),
      );
    });

    it('returns outcome=race-loss-current with the current DB token when rotation race is lost', async () => {
      // The winner already rotated to "winner-token-T1"
      mockWebExtDb.replaceTokenIfCurrent.mockResolvedValue(false);
      mockWebExtDb.findByUserIdAndDeviceId.mockResolvedValue({
        token: 'encrypted-winner-token-T1',
        source: baseArgs.source,
      } as unknown as Awaited<ReturnType<typeof webExtDb.findByUserIdAndDeviceId>>);
      (decryptJwtToken as Mock).mockReturnValue('winner-token-T1');

      const result = await rotateToken(baseArgs);

      expect(result).toEqual({ token: 'winner-token-T1', outcome: 'race-loss-current' });
      expect(mockWebExtDb.findByUserIdAndDeviceId).toHaveBeenCalledWith({
        userId: mockUserProfile.id,
        deviceId: baseArgs.deviceId,
        type: webExtDb.TOKEN_TYPE_AUTH,
      });
      expect(decryptJwtToken).toHaveBeenCalledWith('encrypted-winner-token-T1');
    });

    it('returns outcome=race-loss-none with undefined token when race is lost and no current token exists in DB', async () => {
      mockWebExtDb.replaceTokenIfCurrent.mockResolvedValue(false);
      mockWebExtDb.findByUserIdAndDeviceId.mockResolvedValue(null);

      const result = await rotateToken(baseArgs);

      expect(result).toEqual({ token: undefined, outcome: 'race-loss-none' });
      expect(decryptJwtToken).not.toHaveBeenCalled();
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
      expect(decryptJwtToken).not.toHaveBeenCalled();
    });
  });

  describe('logDeviceEnvironmentChange', () => {
    const detectionArgs = {
      userId: mockUserProfile.id,
      deviceId: baseArgs.deviceId,
      source: 'DESKTOP' as const,
    };

    it('should not read the existing record for a client that does not report a platform', async () => {
      await logDeviceEnvironmentChange({ ...detectionArgs, clientInfo: { appVersion: '1.0.0' } });

      expect(mockWebExtDb.findByUserIdAndDeviceId).not.toHaveBeenCalled();
    });

    it('should compare against the stored record for a client that reports a platform', async () => {
      mockWebExtDb.findByUserIdAndDeviceId.mockResolvedValue({ platform: 'darwin', arch: 'arm64' });

      await logDeviceEnvironmentChange({ ...detectionArgs, clientInfo: { platform: 'darwin', arch: 'arm64' } });

      expect(mockWebExtDb.findByUserIdAndDeviceId).toHaveBeenCalledWith(
        expect.objectContaining({ userId: mockUserProfile.id, deviceId: baseArgs.deviceId }),
      );
    });

    it('should swallow a lookup failure, so detection can never fail an auth request', async () => {
      mockWebExtDb.findByUserIdAndDeviceId.mockRejectedValue(new Error('db is down'));

      await expect(logDeviceEnvironmentChange({ ...detectionArgs, clientInfo: { platform: 'darwin' } })).resolves.toBeUndefined();
    });
  });

  describe('findDeviceEnvironmentChange', () => {
    it('should report a platform flip on an existing device', () => {
      expect(findDeviceEnvironmentChange({ platform: 'darwin', arch: 'arm64' }, { platform: 'win32', arch: 'x64' })).toEqual({
        previousPlatform: 'darwin',
        currentPlatform: 'win32',
        previousArch: 'arm64',
        currentArch: 'x64',
      });
    });

    it('should ignore an unchanged platform', () => {
      expect(findDeviceEnvironmentChange({ platform: 'darwin', arch: 'arm64' }, { platform: 'darwin', arch: 'arm64' })).toBeNull();
    });

    it('should ignore an architecture change on its own, which happens on a legitimate rebuild switch', () => {
      expect(findDeviceEnvironmentChange({ platform: 'darwin', arch: 'x64-translated' }, { platform: 'darwin', arch: 'arm64' })).toBeNull();
    });

    it('should ignore a device that has no platform on record yet', () => {
      expect(findDeviceEnvironmentChange({ platform: null, arch: null }, { platform: 'darwin' })).toBeNull();
    });

    it('should ignore a client that stops reporting its platform', () => {
      expect(findDeviceEnvironmentChange({ platform: 'darwin' }, {})).toBeNull();
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

  describe('getDeviceId', () => {
    it('prefers an already-resolved res.locals.deviceId over every request source', () => {
      const req = buildRequest({
        headers: { [HTTP.HEADERS.X_EXT_DEVICE_ID]: 'header-device', [HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID]: 'legacy-header-device' },
        body: { deviceId: 'body-device' },
        query: { deviceId: 'query-device' },
      });

      expect(getDeviceId(req, buildResponse({ deviceId: 'locals-device' }))).toBe('locals-device');
    });

    it('prefers the desktop header over the legacy extension header and the body/query fallbacks', () => {
      const req = buildRequest({
        headers: { [HTTP.HEADERS.X_EXT_DEVICE_ID]: 'header-device', [HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID]: 'legacy-header-device' },
        body: { deviceId: 'body-device' },
        query: { deviceId: 'query-device' },
      });

      expect(getDeviceId(req, buildResponse())).toBe('header-device');
    });

    it('falls back to the legacy extension header when the standard header is absent', () => {
      const req = buildRequest({
        headers: { [HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID]: 'legacy-header-device' },
        body: { deviceId: 'body-device' },
      });

      expect(getDeviceId(req, buildResponse())).toBe('legacy-header-device');
    });

    it('falls back to the request body for legacy clients that send no header', () => {
      const req = buildRequest({ body: { deviceId: 'body-device' }, query: { deviceId: 'query-device' } });

      expect(getDeviceId(req, buildResponse())).toBe('body-device');
    });

    it('falls back to the query string when no header or body deviceId is present', () => {
      const req = buildRequest({ query: { deviceId: 'query-device' } });

      expect(getDeviceId(req, buildResponse())).toBe('query-device');
    });

    it('returns a falsy value when no source provides a deviceId', () => {
      expect(getDeviceId(buildRequest(), buildResponse())).toBeFalsy();
    });

    it('returns null instead of throwing when reading the request fails', () => {
      const req = {
        get: () => {
          throw new Error('boom');
        },
      } as unknown as express.Request;

      expect(getDeviceId(req, buildResponse())).toBeNull();
    });
  });

  describe('addDeviceIdToLocals', () => {
    it('stores the resolved deviceId on res.locals, binds it to the logger context, and continues', () => {
      const res = buildResponse();
      const next = vi.fn();

      addDeviceIdToLocals(buildRequest({ headers: { [HTTP.HEADERS.X_EXT_DEVICE_ID]: 'header-device' } }), res, next);

      expect(res.locals.deviceId).toBe('header-device');
      expect(enrichRequestContext).toHaveBeenCalledWith({ deviceId: 'header-device' });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('continues without a deviceId when the request has none', () => {
      const res = buildResponse();
      const next = vi.fn();

      addDeviceIdToLocals(buildRequest(), res, next);

      expect(res.locals.deviceId).toBeFalsy();
      expect(enrichRequestContext).toHaveBeenCalledWith({ deviceId: undefined });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('getExternalAuthMiddleware', () => {
    // A unique token per test keeps the middleware's in-process cache from leaking results between tests.
    // Resolves to the error passed to next(), or undefined when the request was authorized.
    async function runMiddleware(accessToken: string, audience: Audience = AUDIENCE_WEB_EXT) {
      const next = vi.fn();
      const request = buildRequest({
        headers: { Authorization: `Bearer ${accessToken}`, [HTTP.HEADERS.X_EXT_DEVICE_ID]: 'device-abc' },
      });
      await getExternalAuthMiddleware(audience)(request, buildResponse(), next);
      return next.mock.calls[0][0];
    }

    describe('token cache', () => {
      /** An active user entitled to both applications, so only the token's audience decides which routes accept it */
      const tokenRecord = {
        userId: mockUserProfile.id,
        user: { entitlements: { chromeExtension: true, googleDrive: false, recordSync: false, desktop: true }, teamMembership: null },
      };

      beforeEach(() => {
        mockWebExtDb.findByAccessTokenAndDeviceId.mockResolvedValue(tokenRecord);
      });

      it('serves a repeated request for the same audience from cache', async () => {
        const token = await issueAccessToken(mockUserProfile, AUDIENCE_WEB_EXT);

        expect(await runMiddleware(token, AUDIENCE_WEB_EXT)).toBeUndefined();
        expect(await runMiddleware(token, AUDIENCE_WEB_EXT)).toBeUndefined();

        expect(mockWebExtDb.findByAccessTokenAndDeviceId).toHaveBeenCalledTimes(1);
      });

      it('does not serve a token cached for the browser extension to a desktop route', async () => {
        const token = await issueAccessToken(mockUserProfile, AUDIENCE_WEB_EXT);
        expect(await runMiddleware(token, AUDIENCE_WEB_EXT)).toBeUndefined();

        const error = await runMiddleware(token, AUDIENCE_DESKTOP);

        // Verified again in full, and rejected because the token's audience is the browser extension
        expect(mockWebExtDb.findByAccessTokenAndDeviceId).toHaveBeenCalledTimes(2);
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.status).toBe(401);
      });

      it.each([
        ['browser extension', AUDIENCE_WEB_EXT],
        ['desktop', AUDIENCE_DESKTOP],
      ] as const)('invalidateCacheEntry evicts a %s token without being told which audience cached it', async (_name, audience) => {
        const token = await issueAccessToken(mockUserProfile, audience);
        expect(await runMiddleware(token, audience)).toBeUndefined();

        invalidateCacheEntry(token, 'device-abc');

        expect(await runMiddleware(token, audience)).toBeUndefined();
        expect(mockWebExtDb.findByAccessTokenAndDeviceId).toHaveBeenCalledTimes(2);
      });
    });

    it('rejects with a 401 when the token is not on record for the device', async () => {
      mockWebExtDb.findByAccessTokenAndDeviceId.mockResolvedValue(null);

      const error = await runMiddleware(makeTokenWithExp(Date.now() / 1000 + SECONDS_PER_DAY));

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.status).toBe(401);
    });

    it('rejects with a 401 when the token is not a valid JWT', async () => {
      const error = await runMiddleware('not-a-jwt');

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(mockWebExtDb.findByAccessTokenAndDeviceId).not.toHaveBeenCalled();
    });

    it('answers a database failure with a 503 instead of a 401, so clients keep their session', async () => {
      mockWebExtDb.findByAccessTokenAndDeviceId.mockRejectedValue(new Error('Connection terminated unexpectedly'));

      const error = await runMiddleware(makeTokenWithExp(Date.now() / 1000 + 2 * SECONDS_PER_DAY));

      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error.status).toBe(503);
      expect(error.message).not.toContain('Connection terminated');
    });
  });

  describe('verifyToken', () => {
    const deviceId = 'device-abc';

    function makePolicy(surfaces: string[]) {
      return { v: 1, tools: ['query'], operations: [], surfaces };
    }

    /** The token row as selected by findByAccessTokenAndDeviceId, for an active team member entitled to both surfaces */
    function makeTokenRecord(accessProfile: { policy: unknown } | null, teamStatus = 'ACTIVE') {
      return {
        userId: mockUserProfile.id,
        user: {
          entitlements: null,
          teamMembership: {
            status: 'ACTIVE',
            accessProfile,
            team: { status: teamStatus, entitlements: { chromeExtension: true, googleDrive: false, recordSync: false, desktop: true } },
          },
        },
      };
    }

    it.each([
      ['desktop', AUDIENCE_DESKTOP, ['browser-extension']],
      ['browser extension', AUDIENCE_WEB_EXT, ['desktop']],
    ] as const)('rejects a %s token when the access profile excludes that surface', async (_surface, audience, surfaces) => {
      mockWebExtDb.findByAccessTokenAndDeviceId.mockResolvedValue(makeTokenRecord({ policy: makePolicy([...surfaces]) }));
      const token = await issueAccessToken(mockUserProfile, audience);

      await expect(verifyToken({ token, deviceId }, audience)).rejects.toThrow('Team access profile does not allow this application');
    });

    it('rejects when the stored access profile policy cannot be read', async () => {
      mockWebExtDb.findByAccessTokenAndDeviceId.mockResolvedValue(makeTokenRecord({ policy: 'corrupt' }));
      const token = await issueAccessToken(mockUserProfile, AUDIENCE_DESKTOP);

      await expect(verifyToken({ token, deviceId }, AUDIENCE_DESKTOP)).rejects.toThrow(
        'Team access profile does not allow this application',
      );
    });

    it('accepts a token when the access profile allows the surface', async () => {
      mockWebExtDb.findByAccessTokenAndDeviceId.mockResolvedValue(makeTokenRecord({ policy: makePolicy(['desktop']) }));
      const token = await issueAccessToken(mockUserProfile, AUDIENCE_DESKTOP);

      await expect(verifyToken({ token, deviceId }, AUDIENCE_DESKTOP)).resolves.toEqual(
        expect.objectContaining({ aud: AUDIENCE_DESKTOP, userProfile: expect.objectContaining({ id: mockUserProfile.id }) }),
      );
    });

    it('accepts a token for a team member without an access profile (full access)', async () => {
      mockWebExtDb.findByAccessTokenAndDeviceId.mockResolvedValue(makeTokenRecord(null));
      const token = await issueAccessToken(mockUserProfile, AUDIENCE_WEB_EXT);

      await expect(verifyToken({ token, deviceId }, AUDIENCE_WEB_EXT)).resolves.toEqual(
        expect.objectContaining({ aud: AUDIENCE_WEB_EXT, userProfile: expect.objectContaining({ id: mockUserProfile.id }) }),
      );
      expect(mockWebExtDb.findByAccessTokenAndDeviceId).toHaveBeenCalledWith({ deviceId, token, type: webExtDb.TOKEN_TYPE_AUTH });
    });

    it('ignores the access profile of an inactive team, matching /api/me', async () => {
      mockWebExtDb.findByAccessTokenAndDeviceId.mockResolvedValue(makeTokenRecord({ policy: makePolicy([]) }, 'INACTIVE'));
      const token = await issueAccessToken(mockUserProfile, AUDIENCE_DESKTOP);

      await expect(verifyToken({ token, deviceId }, AUDIENCE_DESKTOP)).resolves.toEqual(expect.objectContaining({ aud: AUDIENCE_DESKTOP }));
    });

    it('accepts a token for a user who is not on a team', async () => {
      mockWebExtDb.findByAccessTokenAndDeviceId.mockResolvedValue({
        userId: mockUserProfile.id,
        user: { entitlements: { chromeExtension: false, googleDrive: false, recordSync: false, desktop: true }, teamMembership: null },
      });
      const token = await issueAccessToken(mockUserProfile, AUDIENCE_DESKTOP);

      await expect(verifyToken({ token, deviceId }, AUDIENCE_DESKTOP)).resolves.toEqual(expect.objectContaining({ aud: AUDIENCE_DESKTOP }));
    });
  });
});
