import { getExceptionLog, logger } from '@jetstream/api-config';
import { SOCKET_EVENTS } from '@jetstream/shared/constants';
import { getErrorMessage } from '@jetstream/shared/utils';
import { SocketAck, UserProfileServer } from '@jetstream/types';
import * as cometdClient from 'cometd-nodejs-client';
import * as express from 'express';
import { IncomingMessage, createServer } from 'http';
import { DisconnectReason, Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { environment } from '../../environments/environment';
import { subscribeToPlatformEvent, unsubscribeFromPlatformEvent } from '../services/comtd/cometd';
import * as socketUtils from '../utils/socket-utils';

cometdClient.adapt();

let io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;

function getUser(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>) {
  const user = (socket.request as any).user as UserProfileServer;
  return user;
}

function onlyForHandshake(middleware: express.RequestHandler) {
  return (req, res, next) => {
    const isHandshake = req._query.sid === undefined;
    if (isHandshake) {
      middleware(req, res, (...data) => {
        console.log(...data);
        next(...data);
      });
    } else {
      next();
    }
  };
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
    // transports: ["polling", "websocket", "webtransport"] as any, // TODO: test this out - https://socket.io/docs/v4/changelog/4.7.0
    serveClient: false,
    cookie: {
      httpOnly: false,
      secure: environment.production,
      sameSite: environment.production ? 'strict' : 'none',
    } as any,
    allowRequest: (req, callback) => {
      // TODO: make sure origin matches
      const isOriginValid = isValidRequest(req);
      callback(null, isOriginValid);
    },
  });

  // io.engine.generateId = (req) => {
  //   return nanoid(); // must be unique across all Socket.IO servers
  // };

  middlewareFns.forEach((middleware) => io.engine.use(onlyForHandshake(middleware) as any));

  io.engine.use(
    onlyForHandshake((req, res, next) => {
      if (req.user) {
        logger.debug('[SOCKET][AUTH]', req.user);
        next();
      } else {
        logger.debug('[SOCKET][ERROR] unauthorized');
        res.writeHead(401);
        res.end();
      }
    }) as any
  );

  /**
   * Socket Connection Established
   * Everything within fn is scoped to this socket connection
   */
  io.on('connection', (socket) => {
    const user = getUser(socket);
    const userSocketState: socketUtils.SocketConnectionState = {
      io,
      user,
      socket,
      cometdConnections: {},
    };
    logger.debug({ socketId: socket.id, userId: user?.id || 'unknown' }, '[SOCKET][CONNECT] %s', socket.id);

    // server namespace disconnect, client namespace disconnect, server shutting down, ping timeout, transport close, transport error
    socket.on('disconnect', (reason: DisconnectReason) => {
      logger.debug({ socketId: socket.id, userId: user?.id || 'unknown' }, '[SOCKET][DISCONNECT] %s', reason);
      // TODO: should we distinguish specific reason for disconnect before unsubscribing from cometd?
      // If browser did not really disconnect, how will it know that it is no longer subscribed to cometd?
      Object.values(userSocketState.cometdConnections).forEach(({ cometd, subscriptions }) => {
        cometd && socketUtils.disconnectCometD(cometd, socket, user);
        subscriptions.clear();
      });
      userSocketState.cometdConnections = {};
    });

    socket.on('error', (err) => {
      logger.warn({ socketId: socket.id, userId: user?.id || 'unknown', ...getExceptionLog(err) }, '[SOCKET][ERROR] %s', err.message);
    });

    /**
     * SOCKET HANDLERS
     */
    socket.on(SOCKET_EVENTS.PLATFORM_EVENT_SUBSCRIBE, subscribeToPlatformEvent(userSocketState));
    socket.on(SOCKET_EVENTS.PLATFORM_EVENT_UNSUBSCRIBE, unsubscribeFromPlatformEvent(userSocketState));
    socket.on(SOCKET_EVENTS.PLATFORM_EVENT_UNSUBSCRIBE_ALL, unsubscribeFromPlatformEvent(userSocketState, true));
    socket.on(SOCKET_EVENTS.SOCKET_STATE, (data: unknown, callback: (ack: SocketAck) => void) => {
      try {
        callback({
          success: true,
          data: {
            platformEventSubscriptions: Object.entries(userSocketState.cometdConnections).map(([key, value]) => ({
              orgId: key,
              subscriptions: Array.from(value.subscriptions.keys()),
            })),
          },
        });
      } catch (ex) {
        callback({ success: false, data: { error: getErrorMessage(ex) } });
      }
    });
  });

  io.on('error', (socket) => {
    console.log('error', socket);
  });

  return httpServer;
}
