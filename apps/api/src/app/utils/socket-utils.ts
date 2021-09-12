import { MapOf, UserProfileServer } from '@jetstream/types';
import { getOrgForRequest } from 'apps/api/src/app/routes/route.middleware';
import { UserFacingError } from 'apps/api/src/app/utils/error-handler';
import { CometD, SubscriptionHandle } from 'cometd';
import { Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { Server } from 'socket.io';
import { logger } from 'apps/api/src/app/config/logger.config';

export interface SocketConnectionState {
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;
  user: UserProfileServer;
  cometdConnections: MapOf<{
    cometd: CometD | null;
    subscriptions: Map<string, SubscriptionHandle>;
  }>;
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
        logger.debug('[COMTED][DISCONNECT] Disconnected', message, {
          socketId: socket?.id || 'unknown',
          userId: user?.id || 'unknown',
        });
      });
    }
  }
}
