import { ensureBoolean, REGEX } from '@jetstream/shared/utils';
import { SyncRecordOperationSchema } from '@jetstream/types';
import { parseISO } from 'date-fns';
import { clamp } from 'lodash';
import { z } from 'zod';
import * as userSyncDbService from '../db/data-sync.db';
import { emitRecordSyncEventsToOtherClients, SyncEvent } from '../services/data-sync-broadcast.service';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

// FIXME: TEMPORARY UNTIL ALL CLIENTS HAVE BEEN BACKFILLED
export const SyncRecordOperationSchemaFillHashedKey = z
  .object({
    key: z.string(),
    hashedKey: z.string().optional(),
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough()
  .array()
  .transform((records) => {
    return SyncRecordOperationSchema.array()
      .max(userSyncDbService.MAX_SYNC)
      .parse(
        records.map((record) => {
          if (!record.hashedKey) {
            record.hashedKey = userSyncDbService.hashRecordSyncKey(record.key);
          }
          if (!(record as any).data?.hashedKey) {
            (record as any).data.hashedKey = record.hashedKey;
          }
          return record;
        }),
      );
  });

export const routeDefinition = {
  pull: {
    controllerFn: () => pull,
    validators: {
      query: z.object({
        updatedAt: z
          .string()
          .regex(REGEX.ISO_DATE)
          .nullish()
          .transform((val) => (val ? parseISO(val) : null)),
        limit: z.coerce
          .number()
          .int()
          .optional()
          .default(userSyncDbService.MAX_PULL)
          .transform((val) => clamp(val, userSyncDbService.MIN_PULL, userSyncDbService.MAX_PULL)),
        /**
         * Used for pagination, if there are more records, this is the last key of the previous page
         */
        lastKey: z.string().nullish(),
      }),
      hasSourceOrg: false,
    },
  },
  push: {
    controllerFn: () => push,
    validators: {
      query: z.object({
        clientId: z.string().uuid(),
        updatedAt: z
          .string()
          .regex(REGEX.ISO_DATE)
          .nullish()
          .transform((val) => (val ? parseISO(val) : null)),
        includeAllIfUpdatedAtNull: z
          .union([z.enum(['true', 'false']), z.boolean()])
          .optional()
          .default(false)
          .transform(ensureBoolean),
      }),
      body: SyncRecordOperationSchemaFillHashedKey,
      // Original code:
      // body: SyncRecordOperationSchema.array().max(userSyncDbService.MAX_SYNC),
      hasSourceOrg: false,
    },
  },
};

/**
 * Pull changes from server
 */
const pull = createRoute(routeDefinition.pull.validators, async ({ user, query }, req, res) => {
  const { lastKey, updatedAt, limit } = query;
  const response = await userSyncDbService.findByUpdatedAt({
    userId: user.id,
    lastKey,
    updatedAt,
    limit,
  });
  sendJson(res, response);
});

/**
 * Push changes to server and emit to any other clients the user has active
 */
const push = createRoute(routeDefinition.push.validators, async ({ user, body: records, query }, req, res) => {
  const response = await userSyncDbService.syncRecordChanges({
    updatedAt: query.updatedAt,
    userId: user.id,
    records,
    includeAllIfUpdatedAtNull: query.includeAllIfUpdatedAtNull,
  });

  const syncEvent: SyncEvent = {
    clientId: query.clientId,
    data: { hashedKeys: response.records.map(({ hashedKey }) => hashedKey) },
    userId: user.id,
  };

  emitRecordSyncEventsToOtherClients(req.session.id, syncEvent);

  sendJson(res, response);
});
