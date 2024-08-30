import { logger } from '@jetstream/api-config';
import { CometD, SubscriptionHandle } from 'cometd';
import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { getOrgForRequest } from '../routes/route.middleware';
import { UserFacingError } from '../utils/error-handler';

export interface SocketConnectionState {
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;
  user: { id: string };
  cometdConnections: Record<
    string,
    {
      cometd: CometD | null;
      subscriptions: Map<string, SubscriptionHandle>;
    }
  >;
}

export async function getOrg(userId: string, uniqueId: string) {
  if (!userId || !uniqueId) {
    throw new UserFacingError('An org was not found with the provided id');
  }
  return getOrgForRequest(userId, uniqueId);
}

export function disconnectCometD<T extends { id: string }>(
  cometd: CometD,
  socket?: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>,
  user?: T
) {
  if (cometd) {
    cometd.clearListeners();
    cometd.clearSubscriptions();
    if (!cometd.isDisconnected()) {
      cometd.disconnect((message) => {
        logger.debug(
          {
            socketId: socket?.id || 'unknown',
            userId: user?.id || 'unknown',
            message,
          },
          '[COMTED][DISCONNECT] Disconnected'
        );
      });
    }
  }
}
