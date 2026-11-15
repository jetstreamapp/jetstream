import { Prisma, PrismaClient } from '@jetstream/prisma';
import { addDays, startOfDay } from 'date-fns';
import { logger } from '../config/logger.config';

/** How long a delete marker is kept so that every device gets to hear about the delete */
export const TOMBSTONE_RETENTION_DAYS = 365;
export const EXCESS_THRESHOLD = 750;
/**
 * Any records over this amount will get purged regardless of age (favorited query history is always kept)
 */
export const EXTREME_EXCESS_THRESHOLD = 2500;
export const OLDER_THAN_THRESHOLD = 90;

/**
 * Records within a (userId, entity) group that are eligible for deletion.
 * Favorited query history is never deleted.
 */
function getDeletableRecordsFilter(userId: string, entity: string): Prisma.UserSyncDataWhereInput {
  const filter: Prisma.UserSyncDataWhereInput = { userId, entity, deletedAt: null };
  if (entity === 'query_history') {
    filter.data = {
      path: ['isFavorite'],
      equals: false,
    };
  }
  return filter;
}

export async function cleanUpUserSyncHistory(prisma: PrismaClient) {
  const now = startOfDay(new Date());
  const olderThanThreshold = addDays(now, OLDER_THAN_THRESHOLD * -1);

  // Tombstones (deletedAt set) hold no payload and are how other devices learn about a delete, so they
  // are kept far longer than any device is realistically offline. A device that comes back after even
  // longer simply keeps its own copy of those records - nothing else is affected.
  const deletedResult = await prisma.userSyncData.deleteMany({
    where: { deletedAt: { not: null, lte: addDays(now, TOMBSTONE_RETENTION_DAYS * -1) } },
  });
  logger.info(`Deleted ${deletedResult.count} records with deletedAt older than ${TOMBSTONE_RETENTION_DAYS} days`);

  // For each (userId, entity) group with more than 750 live records, remove older records (updated
  // more than 90 days ago). For 'query_history', only records where data.isFavorite is false.
  const groups = await prisma.userSyncData.groupBy({
    by: ['userId', 'entity'],
    where: { deletedAt: null },
    _count: { _all: true },
    having: { id: { _count: { gt: EXCESS_THRESHOLD } } },
  });

  const results: {
    userId: string;
    entity: string;
    excess: number;
    deletedCount: number;
  }[] = [];

  for (const { userId, entity, _count } of groups) {
    const total = _count._all;

    /**
     * If user has a ton of records within the normal time-period threshold, purge stuff regardless
     */
    if (total > EXTREME_EXCESS_THRESHOLD) {
      const excess = total - EXTREME_EXCESS_THRESHOLD;
      const filter = getDeletableRecordsFilter(userId, entity);

      // Get the excess oldest records matching criteria
      const recordsToDelete = await prisma.userSyncData.findMany({
        where: filter,
        orderBy: { updatedAt: 'asc' },
        take: excess,
        select: { id: true },
      });

      if (recordsToDelete.length > 0) {
        const ids = recordsToDelete.map(({ id }) => id);
        // Re-apply the filter so a record favorited between the select and the delete survives
        const delResult = await prisma.userSyncData.deleteMany({
          where: { ...filter, id: { in: ids } },
        });
        logger.info(`Deleted ${delResult.count} records for user ${userId} on entity ${entity}`);
        results.push({ userId, entity, excess, deletedCount: delResult.count });
      } else {
        results.push({ userId, entity, excess, deletedCount: 0 });
      }
      continue;
    }

    if (total > EXCESS_THRESHOLD) {
      const excess = total - EXCESS_THRESHOLD;

      const filter: Prisma.UserSyncDataWhereInput = {
        ...getDeletableRecordsFilter(userId, entity),
        updatedAt: { lte: olderThanThreshold },
      };

      // Get the excess oldest records matching criteria
      const recordsToDelete = await prisma.userSyncData.findMany({
        where: filter,
        orderBy: { updatedAt: 'asc' },
        take: excess,
        select: { id: true },
      });

      if (recordsToDelete.length > 0) {
        const ids = recordsToDelete.map(({ id }) => id);
        const delResult = await prisma.userSyncData.deleteMany({
          where: { ...filter, id: { in: ids } },
        });
        logger.info(`Deleted ${delResult.count} records for user ${userId} on entity ${entity}`);
        results.push({ userId, entity, excess, deletedCount: delResult.count });
      } else {
        results.push({ userId, entity, excess, deletedCount: 0 });
      }
    }
  }

  return { deletedRecordResults: deletedResult.count, userResults: results };
}
