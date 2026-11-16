import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import { clampSyncClientTime, ExistingSyncRow, getSyncClientEditTime, groupByFlat, resolveSyncOp } from '@jetstream/shared/utils';
import {
  MAX_SYNC_RECORDS_PER_PUSH,
  MAX_SYNC_V2_PULL,
  Maybe,
  PullResponse,
  SyncRecordOperation,
  SyncRecordOperationCreateUpdate,
  SyncRecordOperationDelete,
  SyncV2Op,
  SyncV2OpResult,
  SyncV2OpSchema,
  SyncV2Record,
  SyncV2Response,
} from '@jetstream/types';
import { InputJsonValue } from '@prisma/client/runtime/client';
import { isAfter } from 'date-fns';
import clamp from 'lodash/clamp';
import isNil from 'lodash/isNil';
import crypto from 'node:crypto';

export const MIN_PULL = 25;
export const MAX_PULL = 100;

export const MAX_SYNC = MAX_SYNC_RECORDS_PER_PUSH;

/**
 * FIXME: After browser and browser extension get updated, remove server-side hashing
 */
export const hashRecordSyncKey = (key: string): string => {
  return crypto.createHash('SHA1').update(key).digest('hex');
};

const SELECT = {
  key: true,
  hashedKey: true,
  entity: true,
  orgId: true,
  data: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSyncDataSelect;

export const findByKeys = async ({ hashedKeys, userId }: { userId: string; hashedKeys: string[] }) => {
  hashedKeys = hashedKeys.filter(Boolean);
  return await prisma.userSyncData
    .findMany({
      select: SELECT,
      where: { hashedKey: { in: hashedKeys }, userId },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    })
    .then((records): PullResponse => {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        records: records as any,
        hasMore: false,
        updatedAt: records.length > 0 ? records[records.length - 1].updatedAt : new Date(),
        lastKey: records[records.length - 1]?.key || null,
      };
    });
};

export const findByIds = async ({ ids, userId }: { userId: string; ids: string[] }) => {
  return await prisma.userSyncData
    .findMany({
      select: SELECT,
      where: { id: { in: ids }, userId },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    })
    .then((records): PullResponse => {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        records: records as any,
        hasMore: false,
        updatedAt: records.length > 0 ? records[records.length - 1].updatedAt : new Date(),
        lastKey: records[records.length - 1]?.key || null,
      };
    });
};

/**
 * Find all provided record as well as any other records based on the updatedAt date (aka syncRevision)
 */
export const findByIdsIncludingOtherModifiedRecords = async ({
  ids,
  userId,
  updatedAt,
  includeAllIfUpdatedAtNull,
}: {
  userId: string;
  ids: string[];
  /**
   * Pull all records from this id
   * if null, then every sync record for user will be returned
   */
  updatedAt: Maybe<Date>;
  includeAllIfUpdatedAtNull: boolean;
}) => {
  const where: Prisma.UserSyncDataWhereInput = {
    userId,
  };

  if (updatedAt) {
    where.OR = [{ id: { in: ids } }, { updatedAt: { gt: updatedAt } }];
  } else if (!includeAllIfUpdatedAtNull) {
    where.id = { in: ids };
  }

  return await prisma.userSyncData
    .findMany({
      select: SELECT,
      where,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    })
    .then((records): PullResponse => {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        records: records as any,
        hasMore: false,
        updatedAt: records.length > 0 ? records[records.length - 1].updatedAt : updatedAt || new Date(),
        lastKey: records[records.length - 1]?.key || null,
      };
    });
};

export const findByUpdatedAt = async ({
  userId,
  updatedAt,
  lastKey,
  limit,
}: {
  userId: string;
  /**
   * The date to start looking for changes from (exclusive)
   */
  updatedAt: Maybe<Date>;
  /**
   * For pagination, if there are potentially more records, this is the key of the last record of the previous page
   */
  lastKey: Maybe<string>;
  limit: Maybe<number>;
}): Promise<PullResponse> => {
  const where: Prisma.UserSyncDataWhereInput = { userId };

  // (updatedAt, key) is a keyset cursor: resume strictly after the last record of the previous page.
  // The key tie-breaker only applies within the cursor's timestamp - applying it to every row would
  // drop newer records whose key happens to sort before the previous page's last key.
  if (updatedAt && !isNil(lastKey)) {
    where.OR = [{ updatedAt: { gt: updatedAt } }, { updatedAt, key: { gt: lastKey } }];
  } else if (updatedAt) {
    where.updatedAt = { gt: updatedAt };
  }

  limit = clamp(limit || MAX_PULL, MIN_PULL, MAX_PULL);

  return await prisma.userSyncData
    .findMany({
      select: SELECT,
      where,
      // updatedAt and key must match the cursor so no record can fall between pages. id only gives a stable
      // order to rows that share a key, which clients collapse into a single record by key anyway.
      orderBy: [{ updatedAt: 'asc' }, { key: 'asc' }, { id: 'asc' }],
      take: limit,
    })
    .then((records): PullResponse => {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        records: records as any,
        hasMore: records.length === limit,
        updatedAt: records.length > 0 ? records[records.length - 1].updatedAt : updatedAt || new Date(),
        lastKey: records[records.length - 1]?.key ?? null,
      };
    });
};

export const syncRecordChanges = async ({
  userId,
  records,
  updatedAt,
  includeAllIfUpdatedAtNull,
}: {
  updatedAt: Maybe<Date>;
  userId: string;
  records: Array<SyncRecordOperation>;
  includeAllIfUpdatedAtNull: boolean;
}): Promise<PullResponse> => {
  if (records.length > MAX_SYNC) {
    throw new Error(`Cannot sync more than ${MAX_SYNC} records at a time`);
  }

  // record.key / record.hashedKey are attacker-controlled, so build these lookup maps on a
  // null-prototype object. A key of `__proto__`/`constructor`/`toString` on a normal object
  // would resolve to an inherited member and misroute a create into an update with an undefined
  // id, aborting the $transaction (500 + self-scoped data loss).
  const recordsByHashedKey = Object.keys(groupByFlat(records, 'hashedKey', Object.create(null))).filter(Boolean);

  const now = new Date();
  const recordIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Serialize this user's writers before reading, so the routing below cannot be invalidated by a
    // concurrent push between the lookup and the writes.
    await lockUserSyncState(tx, userId);

    const existingRecordsById = groupByFlat(
      await tx.userSyncData.findMany({
        select: { id: true, key: true, updatedAt: true, clientUpdatedAt: true, deletedAt: true },
        where: {
          userId,
          hashedKey: { in: recordsByHashedKey },
        },
      }),
      'key',
      Object.create(null),
    );

    /**
     * Handle record processing
     */
    const { ignoredRecordIds, recordsToCreate, recordsToDelete, recordsToUpdate } = records.reduce(
      (acc, record) => {
        const existingRecord = existingRecordsById[record.key];

        switch (record.type) {
          case 'create': {
            if (existingRecord?.deletedAt) {
              // Since we re-use keys, we need to un-delete this record if it is newer
              if (isAfter(record.createdAt, existingRecord.deletedAt)) {
                acc.recordsToUpdate.push({ id: existingRecord.id, record });
                break;
              }
              // ignore - already exists and is deleted
              acc.ignoredRecordIds.push({ id: existingRecord.id });
              break;
            }
            if (existingRecord && isAfter(getSyncClientEditTime(existingRecord), record.updatedAt)) {
              // Server has a newer record - ignore update
              acc.ignoredRecordIds.push({ id: existingRecord.id });
              break;
            }
            if (existingRecord) {
              // browser sent a created, but we already have the record - update it
              acc.recordsToUpdate.push({ id: existingRecord.id, record });
              break;
            }
            acc.recordsToCreate.push(record);
            break;
          }
          case 'update': {
            if (!existingRecord) {
              acc.recordsToCreate.push(record);
              break;
            }
            if (isAfter(getSyncClientEditTime(existingRecord), record.updatedAt)) {
              // Server has a newer record - ignore update
              acc.ignoredRecordIds.push({ id: existingRecord.id });
              break;
            }
            if (existingRecord.deletedAt && isAfter(existingRecord.deletedAt, record.updatedAt)) {
              // Server record deleted after update, ignore
              acc.ignoredRecordIds.push({ id: existingRecord.id });
              break;
            }
            acc.recordsToUpdate.push({ id: existingRecord.id, record });
            break;
          }
          case 'delete': {
            if (!existingRecord) {
              // server does not know about record, ignore - we cannot put in ignored list since we don't have an id
              break;
            }
            if (existingRecord.deletedAt && isAfter(existingRecord.deletedAt, record.deletedAt)) {
              // Server record deleted after browser deleted, ignore
              acc.ignoredRecordIds.push({ id: existingRecord.id });
              break;
            }
            acc.recordsToDelete.push({ id: existingRecord.id, record });
            break;
          }
        }
        return acc;
      },
      {
        ignoredRecordIds: [] as Array<{ id: string }>,
        recordsToCreate: [] as Array<SyncRecordOperationCreateUpdate>,
        recordsToUpdate: [] as Array<{ id: string; record: SyncRecordOperationCreateUpdate }>,
        recordsToUnDelete: [] as Array<{ id: string; record: SyncRecordOperationCreateUpdate }>,
        recordsToDelete: [] as Array<{ id: string; record: SyncRecordOperationDelete }>,
      },
    );

    recordIds.push(...[...ignoredRecordIds, ...recordsToUpdate, ...recordsToDelete].map(({ id }) => id));

    if (recordsToCreate.length > 0) {
      // INSERT ... ON CONFLICT DO UPDATE keeps this idempotent: an API instance still running the
      // previous build does not take the per-user lock, so it can create the same row concurrently.
      // The conflict path treats the second insert as an update of the now-existing row instead of
      // bubbling P2002 to the client.
      const values = recordsToCreate.map(
        (record) => Prisma.sql`(
          ${userId}::uuid,
          ${record.orgId || null},
          ${record.key},
          ${record.hashedKey},
          ${record.entity},
          ${JSON.stringify(record.data)}::jsonb,
          ${clampSyncClientTime(record.updatedAt, now)},
          ${now},
          ${now},
          NULL
        )`,
      );
      const inserted = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO user_sync_data (
          "userId", "orgId", "key", "hashedKey", "entity", "data",
          "clientUpdatedAt", "createdAt", "updatedAt", "deletedAt"
        )
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("userId", "hashedKey") DO UPDATE
          SET "data" = EXCLUDED."data",
              "clientUpdatedAt" = EXCLUDED."clientUpdatedAt",
              "updatedAt" = EXCLUDED."updatedAt",
              "deletedAt" = NULL
        RETURNING "id"::text AS id
      `;
      for (const { id } of inserted) {
        recordIds.push(id);
      }
    }
    if (recordsToDelete.length > 0) {
      // A tombstone only needs its key - drop the payload so deleted history does not linger server-side
      await tx.userSyncData.updateMany({
        data: { deletedAt: now, clientUpdatedAt: now, data: {} },
        where: { userId, id: { in: recordsToDelete.map(({ id }) => id) } },
      });
    }
    for (const { id, record } of recordsToUpdate) {
      await tx.userSyncData.update({
        select: { id: true },
        data: {
          data: record.data as InputJsonValue,
          clientUpdatedAt: clampSyncClientTime(record.updatedAt, now),
          updatedAt: now,
          deletedAt: null, // in case there is an un-delete
        },
        where: { userId, id },
      });
    }
  });

  return await findByIdsIncludingOtherModifiedRecords({ userId, ids: recordIds, updatedAt, includeAllIfUpdatedAtNull });
};

/**
 * ---------------------------------------------------------------------------------------------
 * Sync protocol v2
 * ---------------------------------------------------------------------------------------------
 */

type TransactionClient = Prisma.TransactionClient;

/**
 * Take the user's `user_sync_state` row lock for the rest of the transaction (creating the row if
 * needed). Every writer of `user_sync_data` ends up holding this lock - the revision trigger takes it
 * on the first written row - so taking it up front means the rows read afterwards cannot change
 * underneath us, and revisions are committed in the order they were assigned.
 */
async function lockUserSyncState(tx: TransactionClient, userId: string) {
  await tx.$executeRaw`
    INSERT INTO user_sync_state ("userId", "revision")
    VALUES (${userId}::uuid, 0)
    ON CONFLICT ("userId") DO UPDATE SET "revision" = user_sync_state."revision"
  `;
}

export type ParsedSyncOp = { valid: true; op: SyncV2Op } | { valid: false; message: string };

/**
 * Validate each op on its own. A bad op (oversized, malformed, unknown entity) or a key repeated
 * within the request is reported as invalid rather than failing the whole batch, which would block
 * every later change from that device.
 */
export function parseSyncOps(rawOps: unknown[]): ParsedSyncOp[] {
  const seenKeys = new Set<string>();
  return rawOps.map((rawOp): ParsedSyncOp => {
    const result = SyncV2OpSchema.safeParse(rawOp);
    if (!result.success) {
      return { valid: false, message: result.error.issues.map(({ message }) => message).join('; ') || 'Invalid sync operation' };
    }
    if (seenKeys.has(result.data.key)) {
      return { valid: false, message: 'Sync record key is repeated in the request' };
    }
    seenKeys.add(result.data.key);
    return { valid: true, op: result.data };
  });
}

const SELECT_V2 = {
  key: true,
  entity: true,
  orgId: true,
  data: true,
  revision: true,
  clientUpdatedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSyncDataSelect;

type SyncV2Row = Prisma.UserSyncDataGetPayload<{ select: typeof SELECT_V2 }>;

function toSyncV2Record({ key, entity, orgId, data, revision, clientUpdatedAt, deletedAt }: SyncV2Row): SyncV2Record {
  return {
    key,
    entity,
    orgId,
    data: deletedAt ? {} : (data as Record<string, unknown>),
    revision: Number(revision),
    clientUpdatedAt,
    deleted: !!deletedAt,
  };
}

/** The user's current sync revision - the highest revision any of their records has been given */
export async function getUserRevision(userId: string, client: TransactionClient | typeof prisma = prisma) {
  const state = await client.userSyncState.findUnique({ select: { revision: true }, where: { userId } });
  return Number(state?.revision ?? 0);
}

/**
 * Records changed after `cursor`, up to and including `maxRevision`.
 *
 * `maxRevision` must be a committed value of the user's counter read BEFORE this query: writers are
 * serialized per user, so every revision at or below a committed counter value is itself committed
 * and nothing can later appear behind the cursor we hand back.
 */
async function findChanges(
  client: TransactionClient | typeof prisma,
  { userId, cursor, maxRevision, limit }: { userId: string; cursor: number; maxRevision: number; limit: number },
) {
  const rows = await client.userSyncData.findMany({
    select: SELECT_V2,
    where: { userId, revision: { gt: BigInt(cursor), lte: BigInt(maxRevision) } },
    orderBy: { revision: 'asc' },
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const changes = (hasMore ? rows.slice(0, limit) : rows).map(toSyncV2Record);
  return { changes, hasMore };
}

export async function pullV2({
  userId,
  cursor,
  limit,
}: {
  userId: string;
  cursor: Maybe<number>;
  limit: Maybe<number>;
}): Promise<SyncV2Response> {
  cursor = cursor ?? 0;
  limit = clamp(limit || MAX_SYNC_V2_PULL, MIN_PULL, MAX_SYNC_V2_PULL);
  const maxRevision = await getUserRevision(userId);
  if (cursor > maxRevision) {
    return { results: [], changes: [], cursor: maxRevision, hasMore: false, resetRequired: true };
  }
  const { changes, hasMore } = await findChanges(prisma, { userId, cursor, maxRevision, limit });
  return {
    results: [],
    changes,
    cursor: hasMore ? changes[changes.length - 1].revision : maxRevision,
    hasMore,
    resetRequired: false,
  };
}

/**
 * Apply a batch of client changes and return what other clients changed since `cursor`.
 */
export async function syncV2({
  userId,
  cursor,
  ops: rawOps,
  limit,
}: {
  userId: string;
  cursor: Maybe<number>;
  ops: unknown[];
  limit?: Maybe<number>;
}): Promise<SyncV2Response> {
  if (rawOps.length > MAX_SYNC) {
    throw new Error(`Cannot sync more than ${MAX_SYNC} records at a time`);
  }
  const requestCursor = cursor ?? 0;
  const pageSize = clamp(limit || MAX_SYNC_V2_PULL, MIN_PULL, MAX_SYNC_V2_PULL);
  const parsedOps = parseSyncOps(rawOps);
  const now = new Date();

  return await prisma.$transaction(async (tx): Promise<SyncV2Response> => {
    await lockUserSyncState(tx, userId);
    const revisionBeforeWrites = await getUserRevision(userId, tx);

    if (requestCursor > revisionBeforeWrites) {
      return { results: [], changes: [], cursor: revisionBeforeWrites, hasMore: false, resetRequired: true };
    }

    const validOps = parsedOps.flatMap((parsedOp) => (parsedOp.valid ? [parsedOp.op] : []));
    const hashedKeyByKey = new Map(validOps.map(({ key }) => [key, hashRecordSyncKey(key)]));

    // Rows are matched on hashedKey - the column the unique index is on - never on `key`: the original
    // protocol stored a client-supplied hash, so a row's key and hash are not guaranteed to agree.
    const existingByHashedKey = new Map<string, ExistingSyncRow>();
    if (validOps.length > 0) {
      const existingRows = await tx.userSyncData.findMany({
        select: { key: true, hashedKey: true, revision: true, clientUpdatedAt: true, updatedAt: true, deletedAt: true },
        where: { userId, hashedKey: { in: Array.from(hashedKeyByKey.values()) } },
      });
      for (const row of existingRows) {
        existingByHashedKey.set(row.hashedKey, { ...row, revision: Number(row.revision) });
      }
    }

    const decisions = parsedOps.map((parsedOp) =>
      parsedOp.valid ? resolveSyncOp(parsedOp.op, existingByHashedKey.get(hashedKeyByKey.get(parsedOp.op.key) as string), now) : null,
    );

    const revisionByHashedKey = new Map<string, number>();
    const values = parsedOps.flatMap((parsedOp, i) => {
      const decision = decisions[i];
      if (!parsedOp.valid || decision?.action !== 'write') {
        return [];
      }
      const { op } = parsedOp;
      const isDelete = op.type === 'delete';
      return [
        Prisma.sql`(
          ${userId}::uuid,
          ${isDelete ? null : op.orgId || null},
          ${op.key},
          ${hashedKeyByKey.get(op.key)},
          ${op.entity},
          ${JSON.stringify(isDelete ? {} : op.data)}::jsonb,
          ${decision.clientUpdatedAt},
          ${now},
          ${now},
          ${isDelete ? now : null}
        )`,
      ];
    });

    if (values.length > 0) {
      // Deletes are written as tombstones (payload dropped, org kept) so other clients learn about them
      const writtenRows = await tx.$queryRaw<Array<{ hashedKey: string; revision: bigint }>>`
        INSERT INTO user_sync_data (
          "userId", "orgId", "key", "hashedKey", "entity", "data",
          "clientUpdatedAt", "createdAt", "updatedAt", "deletedAt"
        )
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("userId", "hashedKey") DO UPDATE
          SET "key" = EXCLUDED."key",
              "data" = EXCLUDED."data",
              "entity" = EXCLUDED."entity",
              "orgId" = CASE WHEN EXCLUDED."deletedAt" IS NULL THEN EXCLUDED."orgId" ELSE user_sync_data."orgId" END,
              "clientUpdatedAt" = EXCLUDED."clientUpdatedAt",
              "updatedAt" = EXCLUDED."updatedAt",
              "deletedAt" = EXCLUDED."deletedAt"
        RETURNING "hashedKey", "revision"
      `;
      for (const { hashedKey, revision } of writtenRows) {
        // char(40) comes back as stored; hashes are always exactly 40 characters so no padding applies
        revisionByHashedKey.set(hashedKey, Number(revision));
      }
    }

    const rejectedKeys = parsedOps.flatMap((parsedOp, i) => (parsedOp.valid && decisions[i]?.action === 'reject' ? [parsedOp.op.key] : []));
    const rejectedRecordByHashedKey = new Map<string, SyncV2Record>();
    if (rejectedKeys.length > 0) {
      const rejectedRows = await tx.userSyncData.findMany({
        select: { ...SELECT_V2, hashedKey: true },
        where: { userId, hashedKey: { in: rejectedKeys.map((key) => hashedKeyByKey.get(key) as string) } },
      });
      for (const row of rejectedRows) {
        // Report the row under the key the client asked about so it applies to the right local record
        rejectedRecordByHashedKey.set(row.hashedKey, toSyncV2Record(row));
      }
    }

    const results = parsedOps.map((parsedOp, i): SyncV2OpResult => {
      const decision = decisions[i];
      if (!parsedOp.valid || !decision) {
        return { status: 'invalid', message: parsedOp.valid ? 'Invalid sync operation' : parsedOp.message };
      }
      const { key } = parsedOp.op;
      if (decision.action === 'noop') {
        return { status: 'accepted', revision: decision.revision };
      }
      if (decision.action === 'reject') {
        return {
          status: 'rejected',
          record: { ...(rejectedRecordByHashedKey.get(hashedKeyByKey.get(key) as string) as SyncV2Record), key },
        };
      }
      return { status: 'accepted', revision: revisionByHashedKey.get(hashedKeyByKey.get(key) as string) as number };
    });

    // Only other clients' changes: everything this request wrote has a revision above revisionBeforeWrites
    const { changes, hasMore } = await findChanges(tx, {
      userId,
      cursor: requestCursor,
      maxRevision: revisionBeforeWrites,
      limit: pageSize,
    });

    return {
      results,
      changes,
      // With more pages to fetch the client continues from the last row it was given (and will be
      // handed its own writes again, which it recognizes by revision). Otherwise it is fully caught up.
      cursor: hasMore ? changes[changes.length - 1].revision : await getUserRevision(userId, tx),
      hasMore,
      resetRequired: false,
    };
  });
}
