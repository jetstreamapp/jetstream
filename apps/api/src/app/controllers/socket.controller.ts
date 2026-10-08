import { ENV, getLogger, logger } from '@jetstream/api-config';
import { convertUserProfileToSession_External, PLACEHOLDER_USER_ID } from '@jetstream/auth/server';
import { HTTP, HTTP_SOURCE_DESKTOP } from '@jetstream/shared/constants';
import { SocketEvent } from '@jetstream/types';
import { createAdapter } from '@socket.io/cluster-adapter';
import { setupWorker } from '@socket.io/sticky';
import * as express from 'express';
import { createServer } from 'http';
import { nanoid } from 'nanoid';
import cluster from 'node:cluster';
import { Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import * as externalAuthService from '../services/external-auth.service';
import type { Request, Response } from '../types/route.types';

let io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;

// Socket.io rooms share a single flat namespace, so a room name must encode which kind of
// identifier it holds. The deviceId is fully client-controlled (see getDeviceId in
// external-auth.service) and is the same UUID shape as a userId, so an un-prefixed device room
// could be named to collide with a victim's userId room and receive that user's broadcasts.
// Prefixing keeps user/session/device rooms in disjoint namespaces so a chosen deviceId can never
// land a socket in another principal's room.
export const socketRoomForUser = (userId: string) => `user:${userId}`;
export const socketRoomForSession = (sessionId: string) => `session:${sessionId}`;
export const socketRoomForDevice = (deviceId: string) => `device:${deviceId}`;

// Same-origin allowlist for browser (cookie-authenticated) WebSocket upgrades. socket.io's
// `cors.origin` only constrains the HTTP polling handshake, NOT the native WebSocket upgrade
// (which is exempt from CORS), so we enforce the origin ourselves as a Cross-Site WebSocket
// Hijacking backstop. Extension and desktop clients are matched earlier by their own auth and
// never reach this check.
function getAllowedWebSocketOrigins(): Set<string> {
  const origins = new Set<string>();
  const originSources = { JETSTREAM_CLIENT_URL: ENV.JETSTREAM_CLIENT_URL, JETSTREAM_SERVER_URL: ENV.JETSTREAM_SERVER_URL };
  for (const [envVarName, url] of Object.entries(originSources)) {
    try {
      origins.add(new URL(url).origin);
    } catch {
      // A malformed URL shrinks the allowlist and browser socket connections start failing, so make the cause findable.
      logger.warn({ envVarName, url }, '[SOCKET] Ignoring malformed URL when building the allowed origin list');
    }
  }
  return origins;
}
const ALLOWED_WEB_SOCKET_ORIGINS = getAllowedWebSocketOrigins();

function isAllowedWebSocketOrigin(origin: string): boolean {
  if (ALLOWED_WEB_SOCKET_ORIGINS.has(origin)) {
    return true;
  }
  // The Vite dev server uses arbitrary localhost ports in development.
  if (ENV.ENVIRONMENT === 'development' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
}

/**
 * The shape of the session a socket carries: an express session for browser clients, or the
 * `{ user, deviceId }` object the external-device middleware builds for the desktop app and
 * browser extension.
 */
interface SocketSession {
  id?: string;
  deviceId?: string;
  user?: { id: string };
  pendingVerification?: unknown;
  pendingMfaEnrollment?: unknown;
  pendingTosAcceptance?: unknown;
}

/**
 * Mirrors the gates `checkAuth` applies to every HTTP route. A session that has a user but still owes
 * a second factor, an authenticator enrollment or terms acceptance holds only the first factor, so it
 * must not be able to listen in on the user's room (synced query history, load mappings, etc.).
 * Like checkAuth, any non-nullish pendingVerification counts as open - an empty array is not a pass.
 */
function isFullyAuthenticatedSession(session: SocketSession | undefined): session is SocketSession & { user: { id: string } } {
  if (!session?.user?.id || session.user.id === PLACEHOLDER_USER_ID) {
    return false;
  }
  return !session.pendingVerification && !session.pendingMfaEnrollment && !session.pendingTosAcceptance;
}

/** Drops the sockets of one revoked or ended session, since they would otherwise outlive it */
export function disconnectSocketsForSession(sessionId: string) {
  if (!io || !sessionId) {
    return;
  }
  try {
    io.in(socketRoomForSession(sessionId)).disconnectSockets(true);
  } catch (ex) {
    getLogger().error({ err: ex, sessionId }, 'Error disconnecting sockets for session');
  }
}

/** Drops the sockets of a desktop or browser-extension device whose token was revoked */
export function disconnectSocketsForDevice(deviceId: string) {
  if (!io || !deviceId) {
    return;
  }
  try {
    io.in(socketRoomForDevice(deviceId)).disconnectSockets(true);
  } catch (ex) {
    getLogger().error({ err: ex, deviceId }, 'Error disconnecting sockets for device');
  }
}

/** Drops every socket of a user, optionally sparing the session that performed the revocation */
export function disconnectSocketsForUser(userId: string, exceptSessionId?: string | null) {
  if (!io || !userId) {
    return;
  }
  try {
    let broadcastOperator = io.in(socketRoomForUser(userId));
    if (exceptSessionId) {
      broadcastOperator = broadcastOperator.except(socketRoomForSession(exceptSessionId));
    }
    broadcastOperator.disconnectSockets(true);
  } catch (ex) {
    getLogger().error({ err: ex, userId }, 'Error disconnecting sockets for user');
  }
}

export function emitSocketEvent({
  userId,
  event,
  exceptRooms,
  payload,
}: {
  userId: string;
  event: SocketEvent;
  exceptRooms?: string[];
  payload?: unknown;
}) {
  try {
    let broadcastOperator = io.to(socketRoomForUser(userId));
    if (exceptRooms) {
      broadcastOperator = broadcastOperator.except(exceptRooms);
    }
    broadcastOperator.emit(event, payload);
  } catch (ex) {
    getLogger().error({ err: ex, userId, event }, 'Error emitting socket event');
  }
}

/**
 * Handshake auth values are untyped and headers can arrive as `string[]`, so narrow both to a single
 * string before comparing against a known source value.
 */
function getSingleHandshakeValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

function getExternalDeviceAuthMiddleware(audience: externalAuthService.Audience) {
  const externalDeviceAuthMiddleware: Parameters<typeof io.use>[0] = (socket, next) => {
    const authorizationHeader = socket.handshake.auth[HTTP.HEADERS.AUTHORIZATION] as string;
    const deviceId =
      (socket.handshake.auth[HTTP.HEADERS.X_EXT_DEVICE_ID] as string) ||
      (socket.handshake.auth[HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID] as string);

    if (!authorizationHeader || !deviceId) {
      return next(new Error('Unauthorized'));
    }

    const accessToken = authorizationHeader.split(' ')[1];
    externalAuthService
      .verifyToken({ token: accessToken, deviceId }, audience)
      .then((decodedJwt) => convertUserProfileToSession_External(decodedJwt.userProfile))
      .then((user) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (socket.request as any).session = { ...(socket.request as any).session, user, deviceId };
        next();
      })
      .catch((err) => {
        logger.error({ err }, '[SOCKET] Error verifying token');
        next(new Error('Unauthorized'));
      });
  };
  return externalDeviceAuthMiddleware;
}

/**
 * Routes each connection to the authentication path that matches the client transport:
 * browser extensions and the desktop app authenticate with an audience-scoped bearer token,
 * everything else is a cookie-authenticated browser client and must pass the origin backstop.
 */
export function getSocketConnectionAuthMiddleware() {
  const socketConnectionAuthMiddleware: Parameters<typeof io.use>[0] = (socket, next) => {
    // The desktop app identifies itself in the handshake auth payload, which socket.io sends on every
    // transport. Its `X-Source` header only survives the polling transport (a native WebSocket upgrade
    // carries no custom headers), so the header is a fallback for older desktop clients, not the source
    // of truth. Claiming to be desktop grants nothing on its own — the branch still requires a valid
    // desktop-audience bearer token, which a cross-site page cannot obtain.
    const requestSource =
      getSingleHandshakeValue(socket.handshake.auth?.[HTTP.HEADERS.X_SOURCE]) ??
      getSingleHandshakeValue(socket.handshake.headers[HTTP.HEADERS.X_SOURCE.toLowerCase()]);

    if (
      socket.handshake.headers.origin === `chrome-extension://${ENV.WEB_EXTENSION_ID_CHROME}` ||
      socket.handshake.headers.origin === `moz-extension://${ENV.WEB_EXTENSION_ID_MOZILLA}`
    ) {
      getExternalDeviceAuthMiddleware(externalAuthService.AUDIENCE_WEB_EXT)(socket, next);
    } else if (requestSource === HTTP_SOURCE_DESKTOP) {
      getExternalDeviceAuthMiddleware(externalAuthService.AUDIENCE_DESKTOP)(socket, next);
    } else {
      // Browser (cookie-authenticated) clients. Reject foreign-origin upgrades as a CSWSH backstop.
      // A missing Origin (non-browser client) is allowed through — it carries no ambient cookie
      // and so authenticates no one.
      const origin = socket.handshake.headers.origin;
      if (origin && !isAllowedWebSocketOrigin(origin)) {
        logger.warn({ origin }, '[SOCKET] Rejected WebSocket connection from disallowed origin');
        next(new Error('Forbidden origin'));
        return;
      }
      // A session that has started but not finished signing in has nothing to subscribe to; refusing
      // it here keeps a password-only session from ever reaching the user's room below.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = (socket.request as any)?.session as SocketSession | undefined;
      if (session?.user && !isFullyAuthenticatedSession(session)) {
        logger.warn({ userId: session.user.id }, '[SOCKET] Rejected WebSocket connection from a session with pending verification');
        next(new Error('Unauthorized'));
        return;
      }
      next();
    }
  };
  return socketConnectionAuthMiddleware;
}

export function initSocketServer(
  app: express.Express,
  middlewareFns: {
    sessionMiddleware: express.RequestHandler;
  },
) {
  const httpServer = createServer(app);

  io = new Server(httpServer, {
    serveClient: false,
    cors: {
      origin: [`chrome-extension://${ENV.WEB_EXTENSION_ID_CHROME}`, `moz-extension://${ENV.WEB_EXTENSION_ID_MOZILLA}`],
      methods: ['GET', 'POST'],
      allowedHeaders: [HTTP.HEADERS.AUTHORIZATION, HTTP.HEADERS.X_EXT_DEVICE_ID, HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID],
      credentials: true,
    },
    // FIXME: ideally we would have a way to make this dynamic
    // cookie: isChromeExtension()
    //   ? undefined
    //   : {
    //       name: 'socketSid',
    //       httpOnly: false,
    //       secure: environment.production,
    //       sameSite: 'strict',
    //     },
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  io.engine.generateId = (...args: unknown[]) => {
    return nanoid(); // must be unique across all Socket.IO servers
  };

  if (cluster.isWorker) {
    io.adapter(createAdapter());
    setupWorker(io);
  }

  io.engine.use((req: Request, res: Response, next: express.NextFunction) => {
    // the browser extension does not include cookies and hangs on this middleware
    if (
      req.headers.origin === `chrome-extension://${ENV.WEB_EXTENSION_ID_CHROME}` ||
      req.headers.origin === `moz-extension://${ENV.WEB_EXTENSION_ID_MOZILLA}`
    ) {
      next();
    } else {
      middlewareFns.sessionMiddleware(req, res, next);
    }
  });

  io.use(getSocketConnectionAuthMiddleware());

  io.on('connection', (socket) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (socket.request as any)?.session as SocketSession | undefined;
    const sessionId = session?.id;
    // Only a fully signed-in session may join the user room (the auth middleware already rejects
    // gated browser sessions; this keeps the room membership rule next to the join itself).
    const userId = isFullyAuthenticatedSession(session) ? session.user.id : undefined;
    const deviceId = session?.deviceId;

    const appVersion =
      getSingleHandshakeValue(socket.handshake.auth?.[HTTP.HEADERS.X_APP_VERSION]) ??
      getSingleHandshakeValue(socket.handshake.headers[HTTP.HEADERS.X_APP_VERSION.toLowerCase()]);

    // Socket lifecycle is not a single async scope (events fire over time), so bind a
    // per-connection child logger instead of relying on AsyncLocalStorage here.
    const socketLogger = logger.child({ socketId: socket.id, userId: userId || 'unknown', sessionId, deviceId, appVersion });

    socketLogger.debug('[SOCKET][CONNECT] %s', socket.id);

    if (userId) {
      socket.join(socketRoomForUser(userId));
    }

    if (sessionId) {
      socket.join(socketRoomForSession(sessionId));
    }

    if (deviceId) {
      socket.join(socketRoomForDevice(deviceId));
    }

    socket.on('disconnect', (reason) => {
      socketLogger.debug('[SOCKET][DISCONNECT] %s', reason);
    });

    socket.on('error', (err) => {
      socketLogger.error({ err }, '[SOCKET][ERROR] %s', err.message);
    });
  });

  return httpServer;
}
