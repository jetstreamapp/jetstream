/* eslint-disable @typescript-eslint/no-explicit-any */
import { ensureBoolean, REGEX } from '@jetstream/shared/utils';
import { MAX_SYNC_V2_PULL, SyncRecordOperationSchema, SyncV2RequestSchema, SyncV2Response, withSyncPushLimits } from '@jetstream/types';
import { parseISO } from 'date-fns';
import { clamp } from 'lodash';
import { z } from 'zod';
import * as userSyncDbService from '../db/data-sync.db';
import { emitRecordSyncEventsToOtherClients, SyncEvent } from '../services/data-sync-broadcast.service';
import { assertHistorySyncAllowed } from '../utils/access-profile.utils';
import { sendJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';

// FIXME: TEMPORARY UNTIL ALL CLIENTS HAVE BEEN BACKFILLED
// The record-count and total-size caps are applied to the raw array (withSyncPushLimits) so an oversized
// request is rejected before every element is validated and hashed.
export const SyncRecordOperationSchemaFillHashedKey = withSyncPushLimits(
  z.looseObject({
    key: z.string(),
    hashedKey: z.string().optional(),
    data: z.record(z.string(), z.unknown()),
  }),
).transform((records) => {
  return SyncRecordOperationSchema.array().parse(
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
    responseType: z.object({
      records: z.any().array(),
      hasMore: z.boolean(),
      updatedAt: z.string(),
      lastKey: z.string(),
    }),
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
    } satisfies RouteValidator,
  },
  push: {
    controllerFn: () => push,
    responseType: z.object({
      clientId: z.string(),
      data: z.any(),
      userId: z.string(),
    }),
    validators: {
      query: z.object({
        clientId: z.uuid(),
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
    } satisfies RouteValidator,
  },
  pullV2: {
    controllerFn: () => pullV2,
    responseType: z.any(),
    validators: {
      query: z.object({
        cursor: z.coerce.number().int().nonnegative().optional().default(0),
        limit: z.coerce.number().int().positive().optional().default(MAX_SYNC_V2_PULL),
      }),
      hasSourceOrg: false,
    } satisfies RouteValidator,
  },
  syncV2: {
    controllerFn: () => syncV2,
    responseType: z.any(),
    validators: {
      body: SyncV2RequestSchema,
      hasSourceOrg: false,
    } satisfies RouteValidator,
  },
};

/**
 * Shared by the web, desktop and browser extension mounts, which differ only in how the calling
 * client is identified for the "don't notify the client that made the change" exclusion.
 */
export async function handlePullV2({ userId, cursor, limit }: { userId: string; cursor: number; limit: number }): Promise<SyncV2Response> {
  await assertHistorySyncAllowed(userId);
  return await userSyncDbService.pullV2({ userId, cursor, limit });
}

export async function handleSyncV2({
  userId,
  body,
  origin,
}: {
  userId: string;
  body: z.infer<typeof SyncV2RequestSchema>;
  origin: Parameters<typeof emitRecordSyncEventsToOtherClients>[0];
}): Promise<SyncV2Response> {
  await assertHistorySyncAllowed(userId);
  const { cursor, ops } = body;
  const response = await userSyncDbService.syncV2({ userId, cursor, ops });

  // `results` is in request order. An accepted op was validated, so it is known to carry a string key.
  const changedHashedKeys = response.results.flatMap((result, i) =>
    result.status === 'accepted' ? [userSyncDbService.hashRecordSyncKey((ops[i] as { key: string }).key)] : [],
  );
  if (changedHashedKeys.length > 0) {
    const syncEvent: SyncEvent = { clientId: 'v2', data: { hashedKeys: changedHashedKeys }, userId };
    emitRecordSyncEventsToOtherClients(origin, syncEvent);
  }
  return response;
}

/**
 * Pull changes from server
 */
const pull = createRoute(routeDefinition.pull.validators, async ({ user, query }, _, res) => {
  await assertHistorySyncAllowed(user.id);
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
  await assertHistorySyncAllowed(user.id);
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

  emitRecordSyncEventsToOtherClients({ sessionId: req.session.id }, syncEvent);

  sendJson(res, response);
});

const pullV2 = createRoute(routeDefinition.pullV2.validators, async ({ user, query }, _, res) => {
  sendJson(res, await handlePullV2({ userId: user.id, ...query }));
});

const syncV2 = createRoute(routeDefinition.syncV2.validators, async ({ user, body }, req, res) => {
  sendJson(res, await handleSyncV2({ userId: user.id, body, origin: { sessionId: req.session.id } }));
});
