import { logger } from '@jetstream/api-config';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { z } from 'zod';
import { emitSocketEvent, socketRoomForDevice, socketRoomForSession } from '../controllers/socket.controller';
import * as userSyncDbService from '../db/data-sync.db';

const SyncEventSchema = z.object({
  userId: z.string(),
  clientId: z.string(),
  data: z.object({
    hashedKeys: z.array(z.string()),
  }),
});
export type SyncEvent = z.infer<typeof SyncEventSchema>;

/**
 * Broadcast a user's record-sync payload to their other connected clients, skipping the client
 * that originated the change. The origin is identified by its session (browser) or device
 * (desktop/web-extension); we translate it into the matching namespaced room so the excluded room
 * shares the same namespace the client actually joined.
 */
export const emitRecordSyncEventsToOtherClients = async (origin: { sessionId: string } | { deviceId: string }, event: unknown) => {
  try {
    const { data, userId } = SyncEventSchema.parse(event);

    const eventResponse = await userSyncDbService.findByKeys({ userId, hashedKeys: data.hashedKeys });

    const exceptRoom = 'sessionId' in origin ? socketRoomForSession(origin.sessionId) : socketRoomForDevice(origin.deviceId);

    emitSocketEvent({
      event: 'RECORD_SYNC',
      userId,
      exceptRooms: [exceptRoom],
      payload: eventResponse,
    });
  } catch (ex) {
    logger.error({ ...getErrorMessageAndStackObj(ex), origin }, 'Error processing sync event');
  }
};
