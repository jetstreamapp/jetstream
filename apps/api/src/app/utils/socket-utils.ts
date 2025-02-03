import { UserProfileSession } from '@jetstream/auth/types';
import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { getOrgForRequest } from '../routes/route.middleware';
import { UserFacingError } from '../utils/error-handler';

export interface SocketConnectionState {
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;
  socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap>;
  user: UserProfileSession;
}

export async function getOrg(user: UserProfileSession, uniqueId: string) {
  if (!user || !uniqueId) {
    throw new UserFacingError('An org was not found with the provided id');
  }
  return getOrgForRequest(user, uniqueId);
}
