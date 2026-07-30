/**
 * Coverage for the socket connection auth middleware, which decides how each client authenticates:
 *   - browser extension origins authenticate against the web extension token audience
 *   - the desktop app (identified by the handshake auth payload, or the `X-Source` header on older
 *     clients using the polling transport) authenticates against the desktop token audience
 *   - everything else is a cookie-authenticated browser client and must pass the origin allowlist,
 *     which is the Cross-Site WebSocket Hijacking backstop
 */
import { HTTP, HTTP_SOURCE_DESKTOP } from '@jetstream/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSocketConnectionAuthMiddleware } from '../socket.controller';

// vi.mock factories are hoisted above module scope, so anything they reference must be hoisted with them.
const mocks = vi.hoisted(() => ({
  CHROME_EXTENSION_ID: 'chrome-ext-id',
  MOZILLA_EXTENSION_ID: 'mozilla-ext-id',
  AUDIENCE_WEB_EXT: 'https://getjetstream.app/web-extension',
  AUDIENCE_DESKTOP: 'https://getjetstream.app/desktop-app',
  verifyToken: vi.fn(),
  warn: vi.fn(),
}));

const { CHROME_EXTENSION_ID, MOZILLA_EXTENSION_ID, AUDIENCE_WEB_EXT, AUDIENCE_DESKTOP } = mocks;

vi.mock('@jetstream/api-config', () => ({
  ENV: {
    ENVIRONMENT: 'test',
    JETSTREAM_CLIENT_URL: 'https://app.test',
    JETSTREAM_SERVER_URL: 'https://api.test',
    WEB_EXTENSION_ID_CHROME: mocks.CHROME_EXTENSION_ID,
    WEB_EXTENSION_ID_MOZILLA: mocks.MOZILLA_EXTENSION_ID,
  },
  logger: { debug: vi.fn(), info: vi.fn(), warn: mocks.warn, error: vi.fn() },
  getLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('@jetstream/auth/server', () => ({
  convertUserProfileToSession_External: vi.fn((userProfile) => ({ id: userProfile.id })),
}));

vi.mock('../../services/external-auth.service', () => ({
  AUDIENCE_WEB_EXT: mocks.AUDIENCE_WEB_EXT,
  AUDIENCE_DESKTOP: mocks.AUDIENCE_DESKTOP,
  verifyToken: mocks.verifyToken,
}));

function createSocket({
  origin,
  auth = {},
  headers = {},
}: {
  origin?: string;
  auth?: Record<string, unknown>;
  headers?: Record<string, string | string[]>;
}) {
  return {
    handshake: {
      auth,
      headers: { ...(origin ? { origin } : {}), ...headers },
    },
    // The auth middleware attaches the resolved session here
    request: {} as Record<string, unknown>,
  };
}

const validDesktopAuth = {
  [HTTP.HEADERS.AUTHORIZATION]: 'Bearer valid-token',
  [HTTP.HEADERS.X_EXT_DEVICE_ID]: 'device-1',
};

// The token paths resolve through promise chains, so let all pending microtasks settle before asserting.
async function runMiddleware(socket: unknown) {
  const next = vi.fn();
  getSocketConnectionAuthMiddleware()(socket as Parameters<ReturnType<typeof getSocketConnectionAuthMiddleware>>[0], next);
  await new Promise((resolve) => setImmediate(resolve));
  return next;
}

describe('socket connection auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockResolvedValue({ userProfile: { id: 'user-1' } });
  });

  describe('browser extension clients', () => {
    it.each([
      ['chrome', `chrome-extension://${CHROME_EXTENSION_ID}`],
      ['firefox', `moz-extension://${MOZILLA_EXTENSION_ID}`],
    ])('authenticates a %s extension origin against the web extension audience', async (_browser, origin) => {
      const next = await runMiddleware(createSocket({ origin, auth: validDesktopAuth }));

      expect(mocks.verifyToken).toHaveBeenCalledWith({ token: 'valid-token', deviceId: 'device-1' }, AUDIENCE_WEB_EXT);
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects an unknown extension id as a foreign origin', async () => {
      const next = await runMiddleware(createSocket({ origin: 'chrome-extension://some-other-extension' }));

      expect(mocks.verifyToken).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Forbidden origin' }));
    });
  });

  describe('desktop clients', () => {
    it('authenticates against the desktop audience when the handshake auth payload identifies the desktop app', async () => {
      const socket = createSocket({ auth: { ...validDesktopAuth, [HTTP.HEADERS.X_SOURCE]: HTTP_SOURCE_DESKTOP } });
      const next = await runMiddleware(socket);

      expect(mocks.verifyToken).toHaveBeenCalledWith({ token: 'valid-token', deviceId: 'device-1' }, AUDIENCE_DESKTOP);
      expect(next).toHaveBeenCalledWith();
      expect(socket.request.session).toEqual({ user: { id: 'user-1' }, deviceId: 'device-1' });
    });

    it('falls back to the X-Source header for older desktop clients on the polling transport', async () => {
      const next = await runMiddleware(
        createSocket({ auth: validDesktopAuth, headers: { [HTTP.HEADERS.X_SOURCE.toLowerCase()]: HTTP_SOURCE_DESKTOP } }),
      );

      expect(mocks.verifyToken).toHaveBeenCalledWith({ token: 'valid-token', deviceId: 'device-1' }, AUDIENCE_DESKTOP);
      expect(next).toHaveBeenCalledWith();
    });

    it('normalizes a duplicated X-Source header to a single value', async () => {
      const next = await runMiddleware(
        createSocket({
          auth: validDesktopAuth,
          headers: { [HTTP.HEADERS.X_SOURCE.toLowerCase()]: [HTTP_SOURCE_DESKTOP, HTTP_SOURCE_DESKTOP] },
        }),
      );

      expect(mocks.verifyToken).toHaveBeenCalledWith({ token: 'valid-token', deviceId: 'device-1' }, AUDIENCE_DESKTOP);
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects a desktop client without a token', async () => {
      const next = await runMiddleware(createSocket({ auth: { [HTTP.HEADERS.X_SOURCE]: HTTP_SOURCE_DESKTOP } }));

      expect(mocks.verifyToken).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unauthorized' }));
    });

    it('rejects a foreign origin claiming to be the desktop app when the token is invalid', async () => {
      mocks.verifyToken.mockRejectedValue(new Error('Invalid token'));
      const next = await runMiddleware(
        createSocket({ origin: 'https://evil.test', auth: { ...validDesktopAuth, [HTTP.HEADERS.X_SOURCE]: HTTP_SOURCE_DESKTOP } }),
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unauthorized' }));
    });
  });

  describe('browser (cookie-authenticated) clients', () => {
    it.each([
      ['client url', 'https://app.test'],
      ['server url', 'https://api.test'],
    ])('allows the configured %s origin without token verification', async (_name, origin) => {
      const next = await runMiddleware(createSocket({ origin }));

      expect(mocks.verifyToken).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects a foreign origin', async () => {
      const next = await runMiddleware(createSocket({ origin: 'https://evil.test' }));

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Forbidden origin' }));
      expect(mocks.warn).toHaveBeenCalled();
    });

    it('allows a request with no origin header, which carries no ambient cookie', async () => {
      const next = await runMiddleware(createSocket({}));

      expect(next).toHaveBeenCalledWith();
    });

    it('rejects localhost origins outside of development', async () => {
      const next = await runMiddleware(createSocket({ origin: 'http://localhost:4200' }));

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Forbidden origin' }));
    });
  });
});
