import { Prisma, PrismaClient } from '@jetstream/prisma';
import { addDays, startOfDay } from 'date-fns';
import { logger } from '../config/logger.config';

export const DELETED_AT_THRESHOLD = 60;
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
  const filter: Prisma.UserSyncDataWhereInput = { userId, entity };
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
  const deletedAtThreshold = addDays(now, DELETED_AT_THRESHOLD * -1);
  const olderThanThreshold = addDays(now, OLDER_THAN_THRESHOLD * -1);

  // 1. Delete records that were marked deleted at least 60 days ago
  const deletedResult = await prisma.userSyncData.deleteMany({
    where: {
      deletedAt: {
        not: null,
        lte: deletedAtThreshold,
      },
    },
  });
  logger.info(`Deleted ${deletedResult.count} records with deletedAt older than 60 days`);

  // 2. For each (userId, entity) group, if total records > 750, remove older records (updated more than 90 days ago)
  // For 'query_history', only delete records where data.isFavorite is false.
  // We'll use Prisma's JSON filtering for PostgreSQL on the data field.

  // First, get distinct (userId, entity) pairs
  const groups = await prisma.userSyncData.findMany({
    select: {
      userId: true,
      entity: true,
    },
    distinct: ['userId', 'entity'],
  });

  const results: {
    userId: string;
    entity: string;
    excess: number;
    deletedCount: number;
  }[] = [];

  for (const { userId, entity } of groups) {
    const total = await prisma.userSyncData.count({
      where: { userId, entity },
    });

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
