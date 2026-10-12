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
  getClientInfoFromReq: vi.fn(() => ({ appVersion: '1.2.3' })),
  createUserActivityFromReq: vi.fn(),
  findByUserIdAndDeviceId: vi.fn(),
  createToken: vi.fn(),
  decryptJwtToken: vi.fn(),
  verifyToken: vi.fn(),
  issueAccessToken: vi.fn(),
  decodeToken: vi.fn(),
  getSurfaceForAudience: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { JETSTREAM_SERVER_URL: 'https://server.test', ENVIRONMENT: 'test', CI: false },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  getLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
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
  class SurfaceNotAllowed extends Error {
    constructor() {
      super('Surface not allowed');
      this.name = 'SurfaceNotAllowed';
    }
  }
  return {
    InvalidSession,
    MissingEntitlement,
    SurfaceNotAllowed,
    getApiAddressFromReq: mocks.getApiAddressFromReq,
    getClientInfoFromReq: mocks.getClientInfoFromReq,
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
  create: mocks.createToken,
  findByUserIdAndDeviceId: mocks.findByUserIdAndDeviceId,
  deleteByUserIdAndDeviceId: vi.fn(),
}));
vi.mock('../../db/data-sync.db', () => ({ findByUpdatedAt: vi.fn(), syncRecordChanges: vi.fn() }));
vi.mock('../../services/data-sync-broadcast.service', () => ({ emitRecordSyncEventsToOtherClients: vi.fn() }));
vi.mock('../../services/external-auth.service', () => ({
  AUDIENCE_WEB_EXT: 'https://getjetstream.app/web-extension',
  AUDIENCE_DESKTOP: 'https://getjetstream.app/desktop-app',
  isTokenWithinRefreshWindow: mocks.isTokenWithinRefreshWindow,
  rotateToken: mocks.rotateToken,
  getSurfaceForAudience: mocks.getSurfaceForAudience,
  verifyToken: mocks.verifyToken,
  issueAccessToken: mocks.issueAccessToken,
  decodeToken: mocks.decodeToken,
  TOKEN_EXPIRATION_SHORT: 1,
  TOKEN_AUTO_REFRESH_DAYS: 2,
}));
vi.mock('../../services/jwt-token-encryption.service', () => ({ decryptJwtToken: mocks.decryptJwtToken }));
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

async function invokeInitSession(session: Record<string, unknown> = {}) {
  const req = {
    get: () => undefined,
    body: {},
    query: {},
    params: {},
    session: { user: { id: 'user-1' }, ...session },
    externalAuth: { user: { id: 'user-1' }, deviceId: 'device-1' },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
  const res = makeRes();
  const next = vi.fn();
  await routeDefinition.initSession.controllerFn()(req as never, res as never, next);
  return { req, res, next };
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
    // Rotation is what records the extension's version in the device inventory
    expect(mocks.rotateToken).toHaveBeenCalledWith(expect.objectContaining({ clientInfo: { appVersion: '1.2.3' } }));
    expect(mocks.sendJson).toHaveBeenCalledWith(res, { success: true, userProfile, accessToken: 'new-token' });
  });

  it('returns a 401 when the rotation outcome is race-loss-none', async () => {
    mocks.isTokenWithinRefreshWindow.mockReturnValue(true);
    mocks.rotateToken.mockResolvedValue({ outcome: 'race-loss-none', token: undefined });

    const { res } = await invokeVerify({ Authorization: 'Bearer old-token', [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1' });

    expect(mocks.sendJson).toHaveBeenCalledWith(res, { success: false, error: 'Invalid session' }, 401);
  });

  it('returns a 503 instead of a 401 when verification fails for a reason other than the session', async () => {
    mocks.findIdByUserIdUserFacing.mockRejectedValue(new Error('Connection terminated unexpectedly'));

    const { res } = await invokeVerify({ Authorization: 'Bearer old-token', [HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION]: '1' });

    expect(mocks.sendJson).toHaveBeenCalledWith(res, expect.objectContaining({ success: false }), 503);
  });

  it('does not rotate when the client does not support rotation', async () => {
    const { res } = await invokeVerify({ Authorization: 'Bearer old-token' });

    expect(mocks.isTokenWithinRefreshWindow).not.toHaveBeenCalled();
    expect(mocks.rotateToken).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenCalledWith(res, { success: true, userProfile, accessToken: undefined });
  });
});

/**
 * Regression coverage for the MFA-bypass fix: a half-authenticated session (first factor passed but
 * 2FA verification / MFA enrollment / ToS acceptance still outstanding) must NOT be exchangeable for
 * a browser-extension access token.
 */
describe('web-extension.controller initSession pending-verification gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findIdByUserIdUserFacing.mockResolvedValue(userProfile);
    mocks.checkUserEntitlement.mockResolvedValue(true);
  });

  it.each([
    ['pendingVerification', { pendingVerification: [{ type: '2fa-otp', exp: Date.now() }] }],
    ['pendingMfaEnrollment', { pendingMfaEnrollment: { factor: '2fa-otp' } }],
    ['pendingTosAcceptance', { pendingTosAcceptance: true }],
  ])('rejects token issuance and never checks entitlement when %s is set', async (_label, session) => {
    const { next } = await invokeInitSession(session);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((next.mock.calls[0][0] as Error).name).toBe('InvalidSession');
    // Guard short-circuits before any token work.
    expect(mocks.checkUserEntitlement).not.toHaveBeenCalled();
    expect(mocks.sendJson).not.toHaveBeenCalled();
  });

  it('allows a fully authenticated session past the gate to the entitlement check', async () => {
    mocks.checkUserEntitlement.mockResolvedValue(false);

    const { next } = await invokeInitSession({});

    // Reached the entitlement check rather than being blocked by the pending-verification guard.
    expect(mocks.checkUserEntitlement).toHaveBeenCalledWith({ userId: 'user-1', entitlement: 'chromeExtension' });
    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as Error).name).toBe('MissingEntitlement');
  });
});

describe('web-extension.controller initSession stored token reuse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findIdByUserIdUserFacing.mockResolvedValue(userProfile);
    mocks.checkUserEntitlement.mockResolvedValue(true);
    mocks.findByUserIdAndDeviceId.mockResolvedValue({ token: 'gcm!stored-token' });
    mocks.issueAccessToken.mockResolvedValue('new-token');
    mocks.decodeToken.mockReturnValue({ exp: 1_900_000_000 });
  });

  async function invokeInitSession() {
    const req = makeReq({});
    const res = makeRes();
    await routeDefinition.initSession.controllerFn()(req as never, res as never, vi.fn());
    return { res };
  }

  it('reuses the stored token when it decrypts and verifies', async () => {
    mocks.decryptJwtToken.mockReturnValue('stored-token');
    mocks.verifyToken.mockResolvedValue(undefined);

    const { res } = await invokeInitSession();

    expect(mocks.sendJson).toHaveBeenCalledWith(res, { accessToken: 'stored-token' });
    expect(mocks.issueAccessToken).not.toHaveBeenCalled();
  });

  it('issues a new token when the stored token can no longer be decrypted', async () => {
    mocks.decryptJwtToken.mockImplementation(() => {
      throw new Error('Failed to decrypt token');
    });

    const { res } = await invokeInitSession();

    expect(mocks.verifyToken).not.toHaveBeenCalled();
    expect(mocks.createToken).toHaveBeenCalledWith('user-1', expect.objectContaining({ token: 'new-token' }));
    expect(mocks.sendJson).toHaveBeenCalledWith(res, { accessToken: 'new-token' });
  });

  it('issues a new token when the stored token no longer verifies', async () => {
    mocks.decryptJwtToken.mockReturnValue('stored-token');
    mocks.verifyToken.mockRejectedValue(new Error('invalid signature'));

    const { res } = await invokeInitSession();

    expect(mocks.createToken).toHaveBeenCalledWith('user-1', expect.objectContaining({ token: 'new-token' }));
    expect(mocks.sendJson).toHaveBeenCalledWith(res, { accessToken: 'new-token' });
  });
});

/**
 * A team access profile can keep a member out of the browser extension. The check runs before a stored token is
 * reused or a new one is issued, so a member whose profile no longer allows the browser extension cannot sign in with
 * a token issued earlier.
 */
describe('web-extension.controller initSession access profile surface gate', () => {
  const ACTIVE_MEMBERSHIP = { teamId: 'team-1', role: 'MEMBER', status: 'ACTIVE' };

  function makeAccessProfile(surfaces: string[]) {
    return { id: 'profile-1', name: 'Restricted', version: 1, policy: { v: 1, tools: ['query'], operations: [], surfaces } };
  }

  function givenTeamMembership(teamMembership: Record<string, unknown> | undefined) {
    mocks.findIdByUserIdUserFacing.mockResolvedValue({ ...userProfile, teamMembership });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkUserEntitlement.mockResolvedValue(true);
    mocks.getSurfaceForAudience.mockReturnValue('browser-extension');
    mocks.findByUserIdAndDeviceId.mockResolvedValue(null);
    mocks.issueAccessToken.mockResolvedValue('new-token');
    mocks.decodeToken.mockReturnValue({ exp: 2_000_000_000 });
  });

  it('refuses a member whose profile excludes the browser extension without reusing or issuing a token', async () => {
    givenTeamMembership({ ...ACTIVE_MEMBERSHIP, accessProfile: makeAccessProfile(['desktop']) });
    // A stored token that still verifies must not be handed back either
    mocks.findByUserIdAndDeviceId.mockResolvedValue({ token: 'encrypted-stored-token' });
    mocks.decryptJwtToken.mockReturnValue('stored-token');
    mocks.verifyToken.mockResolvedValue({});

    const { next } = await invokeInitSession();

    expect(mocks.getSurfaceForAudience).toHaveBeenCalledWith('https://getjetstream.app/web-extension');
    expect(next).toHaveBeenCalledTimes(1);
    expect((next.mock.calls[0][0] as Error).name).toBe('SurfaceNotAllowed');
    expect(mocks.findByUserIdAndDeviceId).not.toHaveBeenCalled();
    expect(mocks.issueAccessToken).not.toHaveBeenCalled();
    expect(mocks.createToken).not.toHaveBeenCalled();
    expect(mocks.sendJson).not.toHaveBeenCalled();
  });

  it.each([
    ['a user who is not on a team', undefined],
    ['a member without a profile (full access)', { ...ACTIVE_MEMBERSHIP, accessProfile: null }],
    [
      'a member whose profile allows the browser extension',
      { ...ACTIVE_MEMBERSHIP, accessProfile: makeAccessProfile(['browser-extension']) },
    ],
  ])('issues a token for %s', async (_label, teamMembership) => {
    givenTeamMembership(teamMembership);

    const { res, next } = await invokeInitSession();

    expect(next).not.toHaveBeenCalled();
    expect(mocks.issueAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      'https://getjetstream.app/web-extension',
      1,
    );
    expect(mocks.createToken).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ source: 'BROWSER_EXTENSION', token: 'new-token', deviceId: 'device-1' }),
    );
    expect(mocks.sendJson).toHaveBeenCalledWith(res, { accessToken: 'new-token' });
  });

  it('reuses a stored token that still verifies for a member without a profile', async () => {
    givenTeamMembership({ ...ACTIVE_MEMBERSHIP, accessProfile: null });
    mocks.findByUserIdAndDeviceId.mockResolvedValue({ token: 'encrypted-stored-token' });
    mocks.decryptJwtToken.mockReturnValue('stored-token');
    mocks.verifyToken.mockResolvedValue({});

    const { res, next } = await invokeInitSession();

    expect(next).not.toHaveBeenCalled();
    expect(mocks.issueAccessToken).not.toHaveBeenCalled();
    expect(mocks.sendJson).toHaveBeenCalledWith(res, { accessToken: 'stored-token' });
  });
});
