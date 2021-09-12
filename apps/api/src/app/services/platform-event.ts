import { SOCKET_EVENTS } from '@jetstream/shared/constants';
import { orderStringsBy } from '@jetstream/shared/utils';
import { SocketAck } from '@jetstream/types';
import { CometD } from 'cometd';
import { logger } from '../config/logger.config';
import * as socketUtils from '../utils/socket-utils';
import { initCometD } from './comtd/cometd-init';
import { CometdReplayExtension } from './comtd/cometd-replay-extension';

// TODO: we need to store the cometd for this org/user to allow publishing events etc..
// TODO: would be col to alow auto-reconnect
// would be cool to have some timeout for auto-disconnecting
// could also have background server subscribe and then use a socket connection back to main server to push events to child
// this would reduce main server load
// TODO: allow cancelling connection (e.x. user disconnects or org is changed in browser)
export function subscribeToPlatformEvent(userSocketState: socketUtils.SocketConnectionState) {
  const { io, socket, user } = userSocketState;
  // TODO: strongly type all req/resp - come up with generic response format
  return async (
    { orgId, platformEventName, replayId }: { orgId: string; platformEventName: string; replayId?: number },
    callback: (ack: SocketAck) => void
  ) => {
    try {
      logger.debug('[SOCKET][subscribeToPlatformEvent] %s [REPLAY ID]: %s', platformEventName, replayId, {
        socketId: socket.id,
        userId: user?.id || 'unknown',
      });
      const { org, connection } = await socketUtils.getOrg(user, orgId);
      // ensure valid token and refreshed, since we will use it to connect to sfdc
      await connection.identity();
      // init cometd if not already initialized for user+org
      userSocketState.cometdConnections[orgId] = userSocketState.cometdConnections[orgId] || {
        cometd: new CometD(),
        subscriptions: new Map(),
      };
      const { cometd, subscriptions } = userSocketState.cometdConnections[orgId];
      const channel = `/event/${platformEventName}`;

      // confirm this works on follow-up subscribes (looks like must be enabled in handshake process)
      // I could modify ex
      await initCometD(user, cometd, connection);

      const replayExt = cometd.getExtension(CometdReplayExtension.EXT_NAME) as CometdReplayExtension;
      if (replayExt) {
        replayExt.addChannel(platformEventName, replayId);
      }

      // ensure only one subscription to platform event per socket connection (user per browser tab)
      if (subscriptions.has(platformEventName)) {
        cometd.unsubscribe(subscriptions.get(platformEventName));
      }
      subscriptions.set(
        platformEventName,
        cometd.subscribe(channel, (message) => {
          // TODO: emit message to client - when client disconnects, we need to cancel this subscription
          // (depending on reason we might try to keep connection until full disconnect or something)
          // could use user.id, but that will go to ALL browser tabs
          io.to(socket.id).emit(SOCKET_EVENTS.PLATFORM_EVENT_MESSAGE, message);
        })
      );
      callback({ success: true, data: { activeSubscriptions: orderStringsBy(Array.from(subscriptions.keys())) } });
    } catch (ex) {
      logger.warn('[SOCKET][subscribeToPlatformEvent][ERROR] %s', ex.message, { socketId: socket.id, userId: user?.id || 'unknown' });
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
  const { io, socket, user } = userSocketState;
  return async ({ orgId, platformEventName }: { orgId: string; platformEventName?: string }, callback: (data: SocketAck) => void) => {
    let unsubscribed = false;
    let activeSubscriptions: string[];
    if (userSocketState.cometdConnections[orgId]) {
      const { cometd, subscriptions } = userSocketState.cometdConnections[orgId];
      if (!cometd.isDisconnected()) {
        if (subscriptions.has(platformEventName)) {
          // unsubscribe from one event
          cometd.unsubscribe(subscriptions.get(platformEventName));
          subscriptions.delete(platformEventName);
          activeSubscriptions = orderStringsBy(Array.from(subscriptions.keys()));

          const replayExt = cometd.getExtension(CometdReplayExtension.EXT_NAME) as CometdReplayExtension;
          if (replayExt) {
            replayExt.removeChannel(platformEventName);
          }

          // if no active subscriptions, disconnect completely
          if (!activeSubscriptions.length) {
            socketUtils.disconnectCometD(cometd, socket, user);
            userSocketState.cometdConnections[orgId] = undefined;
          }
        } else {
          // disconnect from all events
          socketUtils.disconnectCometD(cometd, socket, user);
          userSocketState.cometdConnections[orgId] = undefined;
        }
        unsubscribed = true;
      }
    }
    callback({ success: true, data: { unsubscribed, activeSubscriptions } });
  };
}
