import { logger } from '@jetstream/api-config';
import { UserProfileServer } from '@jetstream/types';
import { CometD, SubscriptionHandle } from 'cometd';
import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { getOrgForRequest } from '../routes/route.middleware';
import { UserFacingError } from '../utils/error-handler';

export interface SocketConnectionState {
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;
  user: UserProfileServer;
  cometdConnections: Record<
    string,
    {
      cometd: CometD | null;
      subscriptions: Map<string, SubscriptionHandle>;
    }
  >;
}

export async function getOrg(user: UserProfileServer, uniqueId: string) {
  if (!user || !uniqueId) {
    throw new UserFacingError('An org was not found with the provided id');
  }
  return getOrgForRequest(user, uniqueId);
}

export function disconnectCometD(
  cometd: CometD,
  socket?: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>,
  user?: UserProfileServer
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
