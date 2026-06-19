/**
 * Regression coverage for the token-rotation gating in the web extension verifyToken handler.
 *
 * To reduce cross-device storage.sync rotation races (a source of frequent logouts), the handler
 * only rotates the access token when it is within the refresh window. These tests lock in:
 *   - rotation is skipped (and no accessToken is returned) when the token is not near expiry
 *   - rotation runs when the token is near expiry
 *   - a race-loss-none rotation outcome still forces a 401
 */
import { HTTP } from '@jetstream/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routeDefinition } from '../web-extension.controller';

const mocks = vi.hoisted(() => ({
  sendJson: vi.fn(),
  redirect: vi.fn(),
  findIdByUserIdUserFacing: vi.fn(),
  checkUserEntitlement: vi.fn(),
  isTokenWithinRefreshWindow: vi.fn(),
  rotateToken: vi.fn(),
  getApiAddressFromReq: vi.fn(() => '127.0.0.1'),
  createUserActivityFromReq: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { JETSTREAM_SERVER_URL: 'https://server.test', ENVIRONMENT: 'test', CI: false },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  errorTracker: { error: vi.fn(), warn: vi.fn(), critical: vi.fn(), info: vi.fn() },
  prisma: {},
}));

vi.mock('@jetstream/auth/server', () => {
  class InvalidSession extends Error {
    constructor() {
      super('Invalid session');
      this.name = 'InvalidSession';
    }
  }
  class MissingEntitlement extends Error {
    constructor() {
      super('Missing entitlement');
      this.name = 'MissingEntitlement';
    }
  }
  return {
    InvalidSession,
    MissingEntitlement,
    getApiAddressFromReq: mocks.getApiAddressFromReq,
    createUserActivityFromReq: mocks.createUserActivityFromReq,
    getCookieConfig: vi.fn(() => ({})),
  };
});

vi.mock('@jetstream/prisma', () => ({
  isPrismaError: () => false,
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
  toTypedPrismaError: () => ({ code: undefined }),
}));

vi.mock('../../db/salesforce-org.db', () => ({ findByUniqueId_UNSAFE: vi.fn(), updateOrg_UNSAFE: vi.fn() }));
vi.mock('../../db/user.db', () => ({
  findIdByUserIdUserFacing: mocks.findIdByUserIdUserFacing,
  checkUserEntitlement: mocks.checkUserEntitlement,
}));
vi.mock('../../db/web-extension.db', () => ({
  TOKEN_TYPE_AUTH: 'AUTH_TOKEN',
  TOKEN_SOURCE_BROWSER_EXTENSION: 'BROWSER_EXTENSION',
  TOKEN_SOURCE_DESKTOP: 'DESKTOP',
  create: vi.fn(),
  findByUserIdAndDeviceId: vi.fn(),
  deleteByUserIdAndDeviceId: vi.fn(),
}));
vi.mock('../../db/data-sync.db', () => ({ findByUpdatedAt: vi.fn(), syncRecordChanges: vi.fn() }));
vi.mock('../../services/data-sync-broadcast.service', () => ({ emitRecordSyncEventsToOtherClients: vi.fn() }));
vi.mock('../../services/external-auth.service', () => ({
  AUDIENCE_WEB_EXT: 'https://getjetstream.app/web-extension',
  AUDIENCE_DESKTOP: 'https://getjetstream.app/desktop-app',
  isTokenWithinRefreshWindow: mocks.isTokenWithinRefreshWindow,
  rotateToken: mocks.rotateToken,
  issueAccessToken: vi.fn(),
  decodeToken: vi.fn(),
  TOKEN_EXPIRATION_SHORT: 1,
  TOKEN_AUTO_REFRESH_DAYS: 2,
}));
vi.mock('../../services/jwt-token-encryption.service', () => ({ decryptJwtTokenOrPlaintext: vi.fn() }));
vi.mock('../../utils/response.handlers', () => ({ sendJson: mocks.sendJson, redirect: mocks.redirect }));
vi.mock('../data-sync.controller', () => ({
  routeDefinition: { pull: { validators: { hasSourceOrg: false } }, push: { validators: { hasSourceOrg: false } } },
}));

const userProfile = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

function makeReq(headers: Record<string, string>) {
  return {
    get: (name: string) => headers[name],
    body: {},
    query: {},
    params: {},
    session: { user: { id: 'user-1' } },
    externalAuth: { user: { id: 'user-1' }, deviceId: 'device-1' },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
}

function makeRes() {
  return {
    locals: { deviceId: 'device-1', ipAddress: '127.0.0.1', cookies: {}, requestId: 'req-1' },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
}

async function invokeVerify(headers: Record<string, string>) {
  const req = makeReq(headers);
  const res = makeRes();
  await routeDefinition.verifyToken.controllerFn()(req as never, res as never, vi.fn());
  return { req, res };
}

describe('web-extension.controller verifyToken token rotation gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findIdByUserIdUserFacing.mockResolvedValue(userProfile);
    mocks.getApiAddressFromReq.mockReturnValue('127.0.0.1');
  });

  it('skips rotation and returns no accessToken when the token is not within the refresh window', async () => {
    mocks.isTokenWithinRefreshWindow.mockReturnValue(false);

    const { res } = await invokeVerify({ Authorization: 'Bearer old-token', [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1' });

    expect(mocks.isTokenWithinRefreshWindow).toHaveBeenCalledWith('old-token');
    expect(mocks.rotateToken).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenCalledWith(res, { success: true, userProfile, accessToken: undefined });
  });

  it('rotates the token and returns the new accessToken when within the refresh window', async () => {
    mocks.isTokenWithinRefreshWindow.mockReturnValue(true);
    mocks.rotateToken.mockResolvedValue({ outcome: 'rotated', token: 'new-token' });

    const { res } = await invokeVerify({ Authorization: 'Bearer old-token', [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1' });

    expect(mocks.rotateToken).toHaveBeenCalledTimes(1);
    expect(mocks.sendJson).toHaveBeenCalledWith(res, { success: true, userProfile, accessToken: 'new-token' });
  });

  it('returns a 401 when the rotation outcome is race-loss-none', async () => {
    mocks.isTokenWithinRefreshWindow.mockReturnValue(true);
    mocks.rotateToken.mockResolvedValue({ outcome: 'race-loss-none', token: undefined });

    const { res } = await invokeVerify({ Authorization: 'Bearer old-token', [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1' });

    expect(mocks.sendJson).toHaveBeenCalledWith(res, { success: false, error: 'Invalid session' }, 401);
  });

  it('does not rotate when the client does not support rotation', async () => {
    const { res } = await invokeVerify({ Authorization: 'Bearer old-token' });

    expect(mocks.isTokenWithinRefreshWindow).not.toHaveBeenCalled();
    expect(mocks.rotateToken).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenCalledWith(res, { success: true, userProfile, accessToken: undefined });
  });
});
