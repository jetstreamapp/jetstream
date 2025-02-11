import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import { convertUserProfileToSession } from '@jetstream/auth/server';
import { UserProfileSession } from '@jetstream/auth/types';
import { HTTP } from '@jetstream/shared/constants';
import { SocketEvent } from '@jetstream/types';
import { createAdapter } from '@socket.io/cluster-adapter';
import { setupWorker } from '@socket.io/sticky';
import * as express from 'express';
import { IncomingMessage, createServer } from 'http';
import { nanoid } from 'nanoid';
import cluster from 'node:cluster';
import { Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import * as webExtensionService from '../services/auth-web-extension.service';
import { Request, Response } from '../types/types';

let io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;

function getUser(request: IncomingMessage) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (request as any)?.session?.user as UserProfileSession | undefined;
  return user;
}

async function getWebExtensionUser(request: IncomingMessage) {
  if (!request.headers.origin?.startsWith(`chrome-extension://`) && !request.headers.origin?.startsWith(`moz-extension://`)) {
    return;
  }
  const authorizationHeader = request.headers[HTTP.HEADERS.AUTHORIZATION.toLowerCase()] as string;
  const deviceId = request.headers[HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID.toLowerCase()] as string;
  if (!authorizationHeader || !deviceId || !authorizationHeader.startsWith('Bearer ')) {
    return;
  }
  const accessToken = authorizationHeader.split(' ')[1];
  const user = await webExtensionService
    .verifyToken({ token: accessToken, deviceId })
    .then((decodedJwt) => convertUserProfileToSession(decodedJwt.userProfile));

  (request as any).session = { ...(request as any).session, user, deviceId };

  return user;
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
    logger.error({ ...getExceptionLog(ex), userId, event }, 'Error emitting socket event');
  }
}

export function initSocketServer(
  app: express.Express,
  middlewareFns: {
    sessionMiddleware: express.RequestHandler;
  }
) {
  const httpServer = createServer(app);

  io = new Server(httpServer, {
    serveClient: false,
    cors: {
      origin: [`chrome-extension://${ENV.WEB_EXTENSION_ID_CHROME}`, `moz-extension://${ENV.WEB_EXTENSION_ID_MOZILLA}`],
      methods: ['GET', 'POST'],
      allowedHeaders: [HTTP.HEADERS.AUTHORIZATION, HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID],
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
    allowRequest: async (req, callback) => {
      try {
        // normal session
        let user = getUser(req);
        if (user) {
          callback(null, true);
          return;
        }
        // web-extension session
        user = await getWebExtensionUser(req);
        if (user) {
          callback(null, true);
          return;
        }
        // Unauthorized
        logger.warn('[SOCKET][ERROR] unauthorized');
        callback('Unauthorized', false);
        return;
      } catch (ex) {
        logger.warn('[SOCKET][ERROR] error authorizing', ex);
        callback('Unauthorized', false);
        return;
      }
    },
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

  io.on('connection', (socket) => {
    const session = (socket.request as any)?.session;
    const sessionId = session?.id as string | undefined;
    const userId = session?.user?.id as string | undefined;
    const deviceId = session?.deviceId as string | undefined;

    logger.trace(
      { socketId: socket.id, userId: session?.user?.id || 'unknown', sessionId: session?.id },
      '[SOCKET][CONNECT] %s',
      socket.id
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
      logger.trace({ socketId: socket.id, userId: userId || 'unknown' }, '[SOCKET][DISCONNECT] %s', reason);
    });

    socket.on('error', (err) => {
      logger.error({ socketId: socket.id, userId: userId || 'unknown', ...getExceptionLog(err) }, '[SOCKET][ERROR] %s', err.message);
    });
  });

  return httpServer;
}
