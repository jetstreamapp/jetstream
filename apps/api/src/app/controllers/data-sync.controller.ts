import { logger } from '@jetstream/api-config';
import { getErrorMessageAndStackObj, REGEX } from '@jetstream/shared/utils';
import { SyncRecordOperationSchema } from '@jetstream/types';
import { parseISO } from 'date-fns';
import { BroadcastChannel } from 'node:worker_threads';
import { z } from 'zod';
import * as userSyncDbService from '../db/data-sync.db';
import { Response } from '../types/types';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

type UserId = string;
type ClientId = string;
const SyncEventSchema = z.object({
  userId: z.string(),
  clientId: z.string(),
  data: z.object({
    keys: z.array(z.string()),
  }),
});
type SyncEvent = z.infer<typeof SyncEventSchema>;

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
          .min(userSyncDbService.MIN_PULL)
          .max(userSyncDbService.MAX_PULL)
          .optional()
          .default(userSyncDbService.MAX_PULL),
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
      }),
      body: SyncRecordOperationSchema.array().min(1).max(userSyncDbService.MAX_SYNC),
      hasSourceOrg: false,
    },
  },
  subscribe: {
    controllerFn: () => subscribe,
    validators: {
      query: z.object({
        clientId: z.string().uuid(),
      }),
      hasSourceOrg: false,
    },
  },
};

/**
 * Manage subscriptions across workers
 */
const broadcastChannel = new BroadcastChannel('data_sync_channel');
const subscriptions = new Map<UserId, Map<ClientId, Response>>();

// Listen for messages from the BroadcastChannel
broadcastChannel.onmessage = async (event: unknown) => {
  pushEventsToClient(event);
};

const pushEventsToClient = async (event: unknown) => {
  try {
    const { clientId, data, userId } = SyncEventSchema.parse(event);
    const clients = subscriptions.get(userId);
    // skip if there are no other clients to send the event to
    if (!clients || clients.size === 0 || (clients.size === 1 && clients.has(clientId))) {
      return;
    }

    const eventResponse = await userSyncDbService.findByKeys({ userId, keys: data.keys });

    for (const [sourceClientId, response] of clients.entries()) {
      // don't send event to the client that triggered it
      if (sourceClientId === clientId) {
        continue;
      }
      response.write(`data: ${JSON.stringify(eventResponse)}\n\n`);
    }
  } catch (ex) {
    logger.error({ ...getErrorMessageAndStackObj(ex), event }, 'Error processing sync event');
  }
};

/**
 * Pull changes from server
 */
const pull = createRoute(routeDefinition.pull.validators, async ({ user, query }, req, res, next) => {
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
const push = createRoute(routeDefinition.push.validators, async ({ user, body: records, query }, req, res, next) => {
  const response = await userSyncDbService.syncRecordChanges({
    updatedAt: query.updatedAt,
    userId: user.id,
    records,
  });

  const syncEvent: SyncEvent = {
    clientId: query.clientId,
    data: { keys: response.records.map(({ key }) => key) },
    userId: user.id,
  };
  // send message to all other running processes in case they have active clients for this user
  broadcastChannel.postMessage(syncEvent);
  // handle on current process
  pushEventsToClient(syncEvent);

  sendJson(res, response);
});

/**
 * Subscribe to changes for a user using server sent events
 */
const subscribe = createRoute(routeDefinition.subscribe.validators, async ({ user, query }, req, res, next) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  let subscription = subscriptions.get(user.id);
  if (!subscription) {
    subscription = new Map();
    subscriptions.set(user.id, subscription);
  }
  subscription.set(query.clientId, res);

  req.on('close', () => {
    const subscription = subscriptions.get(user.id);
    if (subscription) {
      subscription.delete(user.id);
      if (subscription.size === 0) {
        subscriptions.delete(user.id);
      }
    }
  });
});
