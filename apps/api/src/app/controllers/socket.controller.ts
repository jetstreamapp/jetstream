import { ENV, logger } from '@jetstream/api-config';
import type { Request, Response } from '@jetstream/api-types';
import { convertUserProfileToSession_External } from '@jetstream/auth/server';
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

let io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;

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
    let broadcastOperator = io.to(userId);
    if (exceptRooms) {
      broadcastOperator = broadcastOperator.except(exceptRooms);
    }
    broadcastOperator.emit(event, payload);
  } catch (ex) {
    logger.error({ err: ex, userId, event }, 'Error emitting socket event');
  }
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

  io.use((socket, next) => {
    if (
      socket.handshake.headers.origin === `chrome-extension://${ENV.WEB_EXTENSION_ID_CHROME}` ||
      socket.handshake.headers.origin === `moz-extension://${ENV.WEB_EXTENSION_ID_MOZILLA}`
    ) {
      getExternalDeviceAuthMiddleware(externalAuthService.AUDIENCE_WEB_EXT)(socket, next);
    } else if (socket.handshake.headers[HTTP.HEADERS.X_SOURCE.toLowerCase()] === HTTP_SOURCE_DESKTOP) {
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
      next();
    }
  });

  io.on('connection', (socket) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (socket.request as any)?.session;
    const sessionId = session?.id as string | undefined;
    const userId = session?.user?.id as string | undefined;
    const deviceId = session?.deviceId as string | undefined;

    logger.debug(
      { socketId: socket.id, userId: session?.user?.id || 'unknown', sessionId: session?.id },
      '[SOCKET][CONNECT] %s',
      socket.id,
    );

    if (userId) {
      socket.join(userId);
    }

    if (sessionId) {
      socket.join(sessionId);
    }

    if (deviceId) {
      socket.join(deviceId);
    }

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, userId: userId || 'unknown' }, '[SOCKET][DISCONNECT] %s', reason);
    });

    socket.on('error', (err) => {
      logger.error({ socketId: socket.id, userId: userId || 'unknown', err }, '[SOCKET][ERROR] %s', err.message);
    });
  });

  return httpServer;
}
