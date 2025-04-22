import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import { convertUserProfileToSession } from '@jetstream/auth/server';
import { HTTP } from '@jetstream/shared/constants';
import { SocketEvent } from '@jetstream/types';
import { createAdapter } from '@socket.io/cluster-adapter';
import { setupWorker } from '@socket.io/sticky';
import * as express from 'express';
import { createServer } from 'http';
import { nanoid } from 'nanoid';
import cluster from 'node:cluster';
import { Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import * as webExtensionService from '../services/external-auth.service';
import { Request, Response } from '../types/types';

let io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;

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
      const authorizationHeader = socket.handshake.auth[HTTP.HEADERS.AUTHORIZATION] as string;
      const deviceId = socket.handshake.auth[HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID] as string;

      if (!authorizationHeader || !deviceId) {
        return next(new Error('Unauthorized'));
      }

      const accessToken = authorizationHeader.split(' ')[1];
      webExtensionService
        .verifyToken({ token: accessToken, deviceId }, webExtensionService.AUDIENCE_WEB_EXT)
        .then((decodedJwt) => convertUserProfileToSession(decodedJwt.userProfile))
        .then((user) => {
          (socket.request as any).session = { ...(socket.request as any).session, user, deviceId };
          next();
        })
        .catch((err) => {
          logger.error({ ...getExceptionLog(err) }, '[SOCKET] Error verifying token');
          next(new Error('Unauthorized'));
        });
    } else {
      next();
    }
  });

  io.on('connection', (socket) => {
    const session = (socket.request as any)?.session;
    const sessionId = session?.id as string | undefined;
    const userId = session?.user?.id as string | undefined;
    const deviceId = session?.deviceId as string | undefined;

    logger.debug(
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
      logger.debug({ socketId: socket.id, userId: userId || 'unknown' }, '[SOCKET][DISCONNECT] %s', reason);
    });

    socket.on('error', (err) => {
      logger.error({ socketId: socket.id, userId: userId || 'unknown', ...getExceptionLog(err) }, '[SOCKET][ERROR] %s', err.message);
    });
  });

  return httpServer;
}
