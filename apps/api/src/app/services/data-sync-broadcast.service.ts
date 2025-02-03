import { logger } from '@jetstream/api-config';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { z } from 'zod';
import { emitSocketEvent } from '../controllers/socket.controller';
import * as userSyncDbService from '../db/data-sync.db';

const SyncEventSchema = z.object({
  userId: z.string(),
  clientId: z.string(),
  data: z.object({
    keys: z.array(z.string()),
  }),
});
export type SyncEvent = z.infer<typeof SyncEventSchema>;

export const emitRecordSyncEventsToOtherClients = async (sessionOrDeviceId: string, event: unknown) => {
  try {
    const { data, userId } = SyncEventSchema.parse(event);

    const eventResponse = await userSyncDbService.findByKeys({ userId, keys: data.keys });

    emitSocketEvent({
      event: 'RECORD_SYNC',
      userId,
      exceptRooms: [sessionOrDeviceId],
      payload: eventResponse,
    });
  } catch (ex) {
    logger.error({ ...getErrorMessageAndStackObj(ex), sessionOrDeviceId }, 'Error processing sync event');
  }
};
