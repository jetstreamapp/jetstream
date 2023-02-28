import { ENV, logger } from '@jetstream/api-config';
import { UserProfileServer } from '@jetstream/types';
import * as cometdClient from 'cometd-nodejs-client';
import * as express from 'express';
import { createServer, IncomingMessage } from 'http';
import { Server, Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { nanoid } from 'nanoid';
import { environment } from '../../environments/environment';
import * as socketUtils from '../utils/socket-utils';

const serverUrl = ENV.JETSTREAM_SERVER_URL;
cometdClient.adapt();

/**
 * FIXME: https://socket.io/docs/v4/pm2/
 * pm2 will cause issues!
 */

let io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;

const wrapMiddleware =
  (middleware) => (socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>, next: (err?: ExtendedError) => void) =>
    middleware(socket.request, {}, next);

function getUser(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>) {
  const user = (socket.request as any).user as UserProfileServer;
  return user;
}

function isValidRequest(req: IncomingMessage) {
  // req.// TODO: make sure origin matches
  // const noOriginHeader = req.headers.origin === undefined;
  // could make sure origin matches
  // potentially do auth check if possible? (may not be possible)
  return true;
}

export function initSocketServer(app: express.Express, middlewareFns: express.RequestHandler[]) {
  const httpServer = createServer(app);

  io = new Server(httpServer, {
    serveClient: false,
    cookie: {
      httpOnly: false,
      secure: environment.production,
      sameSite: 'strict',
    } as any,
    allowRequest: (req, callback) => {
      const isOriginValid = isValidRequest(req);
      callback(null, isOriginValid);
    },
  });

  io.engine.generateId = (req) => {
    return nanoid(); // must be unique across all Socket.IO servers
  };

  // can we do anything here?
  // io.engine.on("initial_headers", (headers, req) => {
  // headers["test"] = "123";
  // headers["set-cookie"] = "mycookie=456";
  // });

  // can we do anything here?
  // io.engine.on("headers", (headers, req) => {
  // headers["test"] = "789";
  // });

  // Possible app structures
  // https://socket.io/docs/v4/server-application-structure/

  middlewareFns.forEach((middleware) => io.use(wrapMiddleware(middleware)));

  io.use((socket, next) => {
    const user = getUser(socket);
    if (user) {
      next();
    } else {
      logger.debug('[SOCKET][ERROR] unauthorized');
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = getUser(socket);
    const userSocketState: socketUtils.SocketConnectionState = {
      io,
      user,
      socket,
      cometdConnections: {},
    };
    logger.debug('[SOCKET][CONNECT] %s', socket.id, { socketId: socket.id, userId: user?.id || 'unknown' });
    if (user) {
      socket.join(user.id);
    }

    // server namespace disconnect, client namespace disconnect, server shutting down, ping timeout, transport close, transport error
    socket.on('disconnect', (reason) => {
      logger.debug('[SOCKET][DISCONNECT] %s', reason, { socketId: socket.id, userId: user?.id || 'unknown' });
      // TODO: should we distinguish specific reason for disconnect before unsubscribing from cometd?
      // If browser did not really disconnect, how will it know that it is no longer subscribed to cometd?
      Object.values(userSocketState.cometdConnections).forEach(({ cometd, subscriptions }) => {
        cometd && socketUtils.disconnectCometD(cometd, socket, user);
        subscriptions.clear();
      });
      userSocketState.cometdConnections = {};
    });

    socket.on('error', (err) => {
      logger.warn('[SOCKET][ERROR] %s', err.message, { socketId: socket.id, userId: user?.id || 'unknown' });
    });

    /**
     * TODO: add socket handlers here - these were removed since not actually needed but are good reference
     */
    // socket.on(SOCKET_EVENTS.PLATFORM_EVENT_SUBSCRIBE, platformEvService.subscribeToPlatformEvent(userSocketState));
    // socket.on(SOCKET_EVENTS.PLATFORM_EVENT_UNSUBSCRIBE, platformEvService.unsubscribeFromPlatformEvent(userSocketState));
  });

  return httpServer;
}
