import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import { ApiConnection } from '@jetstream/salesforce-api';
import { SOCKET_EVENTS } from '@jetstream/shared/constants';
import { orderStringsBy } from '@jetstream/shared/utils';
import { SocketAck, SocketSubscribePlatformEvent, UserProfileServer } from '@jetstream/types';
import { CometD } from 'cometd';
import * as socketUtils from '../../utils/socket-utils';
import { cometdReplayExtension } from './cometd-replay-extension';

export function initCometD(user: UserProfileServer, cometd: CometD, jetstreamConn: ApiConnection) {
  return new Promise<void>((resolve, reject) => {
    if (cometd.isDisconnected()) {
      // This appears to be unsupported
      cometd.unregisterTransport('websocket');
      cometd.configure({
        url: `${jetstreamConn.sessionInfo.instanceUrl}/cometd/${jetstreamConn.sessionInfo.apiVersion || ENV.SFDC_API_VERSION}`,
        requestHeaders: {
          Authorization: `Bearer ${jetstreamConn.sessionInfo.accessToken}`,
        },
        appendMessageTypeToURL: false,
      });

      if (ENV.LOG_LEVEL === 'trace') {
        cometd.setLogLevel('debug');
      }

      // FIXME: type this
      cometd.registerExtension('replayExtension', new cometdReplayExtension());

      cometd.handshake((shake) => {
        if (shake.successful) {
          logger.trace({ userId: user.id }, '[COMETD][HANDSHAKE][SUCCESS] %s', user.id);
          resolve();
        } else {
          logger.warn({ userId: user.id }, '[COMETD][HANDSHAKE][ERROR] %s - %s', shake.error, user.id);
          reject(shake);
        }
      });

      cometd.addListener('/meta/connect', (message) => {
        logger.trace({ userId: user.id }, '[COMETD] connect - %s', message);
      });
      cometd.addListener('/meta/disconnect', (message) => {
        logger.trace({ userId: user.id }, '[COMETD] disconnect - %s', message);
      });
      cometd.addListener('/meta/unsuccessful', (message) => {
        logger.trace({ userId: user.id }, '[COMETD] unsuccessful - %s', message);
      });
      (cometd as any).onListenerException = (exception, subscriptionHandle, isListener, message) => {
        logger.warn(
          {
            isListener,
            userId: user.id,
          },
          '[COMETD][LISTENER][ERROR] %s - %s - %o',
          exception?.message,
          message,
          subscriptionHandle
        );
      };
    } else {
      resolve();
    }
  });
}

export function disconnectCometD(cometd: CometD, socketId?: string, userId?: string) {
  if (cometd) {
    cometd.clearListeners();
    cometd.clearSubscriptions();
    if (!cometd.isDisconnected()) {
      cometd.disconnect((message) => {
        logger.trace({ socketId, userId, message }, '[COMTED][DISCONNECT] Disconnected');
      });
    }
  }
}

export function subscribeToPlatformEvent(userSocketState: socketUtils.SocketConnectionState) {
  const { cometdConnections, io, socket, user } = userSocketState;
  return async (data: SocketSubscribePlatformEvent, callback: (ack: SocketAck) => void) => {
    try {
      const { orgId, platformEventName, replayId } = data;
      logger.trace('[SOCKET][subscribeToPlatformEvent] %s [REPLAY ID]: %s', platformEventName, replayId, {
        socketId: socket.id,
        userId: user?.id || 'unknown',
      });

      const { jetstreamConn } = await socketUtils.getOrg(user, orgId);
      // ensure valid token and refreshed, since we will use it to connect to sfdc
      await jetstreamConn.org.identity();

      // init cometd if not already initialized for user+org
      cometdConnections[orgId] = cometdConnections[orgId] || {
        cometd: new CometD(),
        subscriptions: new Map(),
      };

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const cometd = cometdConnections[orgId].cometd!;
      const { subscriptions } = cometdConnections[orgId];

      await initCometD(user, cometd, jetstreamConn);

      // ensure only one subscription to platform event per socket connection (user per browser tab)
      if (subscriptions.has(platformEventName)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        cometd.unsubscribe(subscriptions.get(platformEventName)!);
      }

      // FIXME: type this
      const replayExtension = cometd.getExtension('replayExtension') as any;
      if (replayExtension) {
        replayExtension.setChannel(platformEventName);
        replayExtension.setReplay(replayId);
      }

      const subscriptionHandle = cometd.subscribe(
        platformEventName,
        (message) => {
          logger.trace({ platformEventName, userId: user.id, message }, '[SOCKET][PLATFORM_EVENT_MESSAGE]');
          // TODO: emit message to client - when client disconnects, we need to cancel this subscription
          // (depending on reason we might try to keep connection until full disconnect or something)
          // could use user.id, but that will go to ALL browser tabs
          io.to(socket.id).emit(SOCKET_EVENTS.PLATFORM_EVENT_MESSAGE, message);
        },
        (message) => {
          if (!message.successful) {
            logger.warn(
              { platformEventName, userId: user.id, ...getExceptionLog(message.error) },
              '[SOCKET][PLATFORM_EVENT_MESSAGE][ERROR]'
            );
          } else {
            subscriptions.set(platformEventName, subscriptionHandle);
          }

          callback({
            success: !!message.successful,
            error: message.error,
            data: { activeSubscriptions: orderStringsBy(Array.from(subscriptions.keys())) },
          });
        }
      );
    } catch (ex) {
      logger.warn(
        { socketId: socket.id, userId: user?.id || 'unknown', ...getExceptionLog(ex) },
        '[SOCKET][subscribeToPlatformEvent][ERROR]'
      );
      callback({ success: false, error: ex.message });
    }
  };
}

/**
 * if platformEventName is not provided, all subscriptions for org are removed
 * TODO: add error handling
 * @param userSocketState
 * @returns
 */
export function unsubscribeFromPlatformEvent(userSocketState: socketUtils.SocketConnectionState) {
  const { cometdConnections, socket, user } = userSocketState;
  return async ({ orgId, platformEventName }: { orgId: string; platformEventName?: string }, callback: (data: SocketAck) => void) => {
    let unsubscribed = false;
    let activeSubscriptions: string[] = [];
    if (userSocketState.cometdConnections[orgId]) {
      const { cometd, subscriptions } = cometdConnections[orgId];
      activeSubscriptions = orderStringsBy(Array.from(subscriptions.keys()));

      if (cometd && platformEventName && !cometd.isDisconnected()) {
        if (subscriptions.has(platformEventName)) {
          // unsubscribe from one event
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          cometd.unsubscribe(subscriptions.get(platformEventName)!);
          subscriptions.delete(platformEventName);
          activeSubscriptions = orderStringsBy(Array.from(subscriptions.keys()));

          // FIXME: type this
          const replayExt = cometd.getExtension('replayExtension') as any;
          if (replayExt) {
            replayExt.removeChannel(platformEventName);
          }

          // if no active subscriptions, disconnect completely
          if (!activeSubscriptions.length) {
            socketUtils.disconnectCometD(cometd, socket, user);
            delete userSocketState.cometdConnections[orgId];
          }
        } else {
          // disconnect from all events
          socketUtils.disconnectCometD(cometd, socket, user);
          delete userSocketState.cometdConnections[orgId];
        }
        unsubscribed = true;
      }
    }
    callback({ success: true, data: { unsubscribed, activeSubscriptions } });
  };
}
