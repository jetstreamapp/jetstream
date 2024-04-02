import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import { ApiConnection } from '@jetstream/salesforce-api';
import { SOCKET_EVENTS } from '@jetstream/shared/constants';
import { getErrorMessage, orderStringsBy } from '@jetstream/shared/utils';
import { SocketAck, SocketSubscribePlatformEvent, UserProfileServer } from '@jetstream/types';
import { CometD } from 'cometd';
import * as socketUtils from '../../utils/socket-utils';
import { CometdReplayExtension } from './cometd-replay-extension';

/**
 * TODO:
 * We should have a heartbeat to make sure that the cometD connection is alive
 * because the server cancels CometD if the socket is disconnected
 * could we have an eventEmitter on socket events to detect reconnect and then subscribe to CometD again?
 * (would need to make sure on re-subscribe we don't get duplicate events)
 */

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

      cometd.registerExtension('replayExtension', new CometdReplayExtension() as any);

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
        logger.trace({ userId: user.id }, '[COMETD] connect - %o', message);
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
        // subscriptionsTimer: new Map(), // TODO: something to keep track and drop subscriptions that have been around too long
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
      const replayExtension: CometdReplayExtension = cometd.getExtension('replayExtension') as any;
      if (replayExtension) {
        replayExtension.addChannel(platformEventName, replayId);
      }

      const subscriptionHandle = cometd.subscribe(
        platformEventName,
        (message) => {
          logger.trace({ platformEventName, userId: user.id, message }, '[SOCKET][PLATFORM_EVENT_MESSAGE]');
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
export function unsubscribeFromPlatformEvent(userSocketState: socketUtils.SocketConnectionState, allEvents = false) {
  const { cometdConnections, socket, user } = userSocketState;
  return async ({ orgId, platformEventName }: { orgId: string; platformEventName?: string }, callback: (data: SocketAck) => void) => {
    try {
      let activeSubscriptions: string[] = [];

      if (!cometdConnections[orgId]) {
        callback({ success: true, data: { unsubscribed: false, activeSubscriptions } });
        return;
      }
      const cometdConnection = cometdConnections[orgId];

      if (!cometdConnection.cometd) {
        callback({ success: true, data: { unsubscribed: false, activeSubscriptions } });
        return;
      }

      if (allEvents) {
        activeSubscriptions = unsubscribeFromAllPlatformEvent(cometdConnection);
      } else if (platformEventName) {
        activeSubscriptions = unsubscribeFromSinglePlatformEvent(cometdConnection, platformEventName);
      }

      // if no active subscriptions, disconnect completely
      if (!activeSubscriptions.length) {
        socketUtils.disconnectCometD(cometdConnection.cometd, socket, user);
        delete cometdConnections[orgId];
      }

      callback({ success: true, data: { unsubscribed: true, activeSubscriptions } });
    } catch (ex) {
      callback({ success: false, error: getErrorMessage(ex) });
    }
  };
}

function unsubscribeFromSinglePlatformEvent(
  { cometd, subscriptions }: socketUtils.SocketConnectionState['cometdConnections'][string],
  platformEventName: string
) {
  if (cometd && subscriptions.has(platformEventName)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    cometd.unsubscribe(subscriptions.get(platformEventName)!);
    subscriptions.delete(platformEventName);

    const replayExt = cometd.getExtension('replayExtension') as any;
    if (replayExt) {
      replayExt.removeChannel(platformEventName);
    }
  }
  const activeSubscriptions = orderStringsBy(Array.from(subscriptions.keys()));
  return activeSubscriptions;
}

function unsubscribeFromAllPlatformEvent({ cometd, subscriptions }: socketUtils.SocketConnectionState['cometdConnections'][string]) {
  if (cometd) {
    cometd.clearSubscriptions();
    subscriptions.clear();

    const replayExt = cometd.getExtension('replayExtension') as any;
    if (replayExt) {
      replayExt.removeAllChannels();
    }
  }
  const activeSubscriptions = orderStringsBy(Array.from(subscriptions.keys()));
  return activeSubscriptions;
}
