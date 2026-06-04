import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import { groupByFlat } from '@jetstream/shared/utils';
import { Maybe, PullResponse, SyncRecordOperation, SyncRecordOperationCreateUpdate, SyncRecordOperationDelete } from '@jetstream/types';
import { InputJsonValue } from '@prisma/client/runtime/client';
import { isAfter } from 'date-fns';
import clamp from 'lodash/clamp';
import crypto from 'node:crypto';

export const MIN_PULL = 25;
export const MAX_PULL = 100;

export const MAX_SYNC = 50;

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
   * For pagination, if there are potentially more records, this is the last id of the previous page
   */
  lastKey: Maybe<string>;
  limit: Maybe<number>;
}): Promise<PullResponse> => {
  const where: Prisma.UserSyncDataWhereInput = { userId };

  if (updatedAt) {
    where.updatedAt = { gt: updatedAt };
  }

  if (lastKey) {
    where.key = { gt: lastKey };
  }

  limit = clamp(limit || MAX_PULL, MIN_PULL, MAX_PULL);

  return await prisma.userSyncData
    .findMany({
      select: SELECT,
      where,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    })
    .then((records): PullResponse => {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        records: records as any,
        hasMore: records.length === limit,
        updatedAt: records.length > 0 ? records[records.length - 1].updatedAt : updatedAt || new Date(),
        lastKey: records[records.length - 1]?.key || null,
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

  const existingRecordsById = groupByFlat(
    await prisma.userSyncData.findMany({
      select: { id: true, key: true, updatedAt: true, deletedAt: true },
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
          if (existingRecord && isAfter(existingRecord.updatedAt, record.updatedAt)) {
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
          if (isAfter(existingRecord.updatedAt, record.updatedAt)) {
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

  const now = new Date();

  const recordIds = [...ignoredRecordIds, ...recordsToUpdate, ...recordsToDelete].map(({ id }) => id);

  await prisma.$transaction(async (tx) => {
    if (recordsToCreate.length > 0) {
      // INSERT ... ON CONFLICT DO UPDATE makes this idempotent under concurrent pushes.
      // The existing-record lookup runs outside the transaction, so two pushes racing on the
      // same baseRevision can both decide to create the same row and hit the
      // user_hashed_key_org unique index. The conflict path treats the second insert
      // as an update of the now-existing row instead of bubbling P2002 to the client.
      // Note: Postgres treats NULL orgId values as distinct, so the conflict only fires
      // for org-scoped records.
      const values = recordsToCreate.map(
        (record) => Prisma.sql`(
          ${userId}::uuid,
          ${record.orgId || null},
          ${record.key},
          ${record.hashedKey},
          ${record.entity},
          ${JSON.stringify(record.data)}::jsonb,
          ${now},
          ${now},
          NULL
        )`,
      );
      const inserted = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO user_sync_data (
          "userId", "orgId", "key", "hashedKey", "entity", "data",
          "createdAt", "updatedAt", "deletedAt"
        )
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("userId", "hashedKey", "orgId") DO UPDATE
          SET "data" = EXCLUDED."data",
              "updatedAt" = EXCLUDED."updatedAt",
              "deletedAt" = NULL
        RETURNING "id"::text AS id
      `;
      for (const { id } of inserted) {
        recordIds.push(id);
      }
    }
    if (recordsToDelete.length > 0) {
      await tx.userSyncData.updateMany({
        data: { deletedAt: now },
        where: { userId, id: { in: recordsToDelete.map(({ id }) => id) } },
      });
    }
    for (const { id, record } of recordsToUpdate) {
      await tx.userSyncData.update({
        select: { id: true },
        data: {
          data: record.data as InputJsonValue,
          updatedAt: now,
          deletedAt: null, // in case there is an un-delete
        },
        where: { userId, id },
      });
    }
  });

  return await findByIdsIncludingOtherModifiedRecords({ userId, ids: recordIds, updatedAt, includeAllIfUpdatedAtNull });
};
