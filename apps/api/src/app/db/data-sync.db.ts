/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { prisma } from '@jetstream/api-config';
import { groupByFlat } from '@jetstream/shared/utils';
import { Maybe, PullResponse, SyncRecordOperation, SyncRecordOperationCreateUpdate, SyncRecordOperationDelete } from '@jetstream/types';
import { Prisma } from '@prisma/client';
import { InputJsonValue } from '@prisma/client/runtime/library';
import { isAfter } from 'date-fns';
import clamp from 'lodash/clamp';

export const MIN_PULL = 1;
export const MAX_PULL = 100;

export const MAX_SYNC = 25;

const SELECT = Prisma.validator<Prisma.UserSyncDataSelect>()({
  key: true,
  entity: true,
  orgId: true,
  data: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const findByKeys = async ({ keys, userId }: { userId: string; keys: string[] }) => {
  return await prisma.userSyncData
    .findMany({
      select: SELECT,
      where: { key: { in: keys }, userId },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    })
    .then((records): PullResponse => {
      return {
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
        records: records as any,
        hasMore: false,
        updatedAt: records.length > 0 ? records[records.length - 1].updatedAt : new Date(),
        lastKey: records[records.length - 1]?.key || null,
      };
    });
};

export const findByIdsIncludingOtherModifiedRecords = async ({
  ids,
  userId,
  updatedAt,
}: {
  userId: string;
  ids: string[];
  updatedAt: Date;
}) => {
  return await prisma.userSyncData
    .findMany({
      select: SELECT,
      where: {
        AND: [
          { userId },
          {
            OR: [{ id: { in: ids } }, { updatedAt: { gt: updatedAt } }],
          },
        ],
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    })
    .then((records): PullResponse => {
      return {
        records: records as any,
        hasMore: false,
        updatedAt: records.length > 0 ? records[records.length - 1].updatedAt : new Date(),
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
        records: records as any,
        hasMore: records.length === limit,
        updatedAt: records.length > 0 ? records[records.length - 1].updatedAt : new Date(),
        lastKey: records[records.length - 1]?.key || null,
      };
    });
};

export const syncRecordChanges = async ({
  userId,
  records,
  updatedAt,
}: {
  updatedAt: Maybe<Date>;
  userId: string;
  records: Array<SyncRecordOperation>;
}): Promise<PullResponse> => {
  if (records.length > MAX_SYNC) {
    throw new Error(`Cannot sync more than ${MAX_SYNC} records at a time`);
  }

  const recordsByKey = groupByFlat(records, 'key');

  const existingRecordsById = groupByFlat(
    await prisma.userSyncData.findMany({
      select: { id: true, key: true, updatedAt: true, deletedAt: true },
      where: {
        userId,
        key: { in: Object.keys(recordsByKey) },
      },
    }),
    'key'
  );

  /**
   * Handle record processing
   * * If user provided a records and it is deleted on the
   */
  const { ignoredRecordIds, recordsToCreate, recordsToDelete, recordsToUpdate } = records.reduce(
    (acc, record) => {
      const existingRecord = existingRecordsById[record.key];

      switch (record.type) {
        case 'create': {
          if (existingRecord?.deletedAt) {
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
            // TODO: ensure browser sends enough data to create a new record
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
            // server does not know about record, ignore
            acc.ignoredRecordIds.push({ id: record.key });
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
      recordsToDelete: [] as Array<{ id: string; record: SyncRecordOperationDelete }>,
    }
  );

  const now = new Date();

  // TODO: do I want to return all records? or just the ones that were modified?
  const recordIds = [...ignoredRecordIds, ...recordsToUpdate, ...recordsToDelete].map(({ id }) => id);

  // TODO: add error handling to know if failure is here or is somewhere else
  await prisma.$transaction(async (tx) => {
    if (recordsToCreate.length > 0) {
      const results = await tx.userSyncData.createManyAndReturn({
        select: { id: true },
        data: recordsToCreate.map((record) => ({
          entity: record.entity,
          userId,
          orgId: record.orgId,
          key: record.key,
          data: record.data as InputJsonValue,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })),
      });
      recordIds.push(...results.map(({ id }) => id));
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

  if (updatedAt) {
    return await findByIdsIncludingOtherModifiedRecords({ userId, ids: recordIds, updatedAt });
  }

  return await findByIds({ userId, ids: recordIds });
};
