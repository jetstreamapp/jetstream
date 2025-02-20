import { PrismaClient } from '@prisma/client';
import { addDays } from 'date-fns';
import * as dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import { v4 as uuid } from 'uuid';
import {
  cleanUpUserSyncHistory,
  DELETED_AT_THRESHOLD,
  EXCESS_THRESHOLD,
  EXTREME_EXCESS_THRESHOLD,
  OLDER_THAN_THRESHOLD,
} from '../utils/clean-up-user-sync-history.utils';

dotenv.config();

const hashRecordSyncKey = (key: string): string => {
  return createHash('SHA1').update(key).digest('hex');
};
// Ensure this runs against a test database
export const prisma = new PrismaClient({
  datasourceUrl: process.env.PRISMA_TEST_DB_URI || 'postgres://postgres:postgres@postgres:5432/testdb',
});

export function generateSyncRecords({
  entity,
  count,
  userId,
  orgId,
  isFavorite,
  updatedAt,
  deletedAt,
}: {
  entity: 'query_history' | 'load_saved_mapping';
  count: number;
  userId: string;
  orgId: string;
  isFavorite?: boolean;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  const createdAt = addDays(new Date(), -30);
  return new Array(count).fill(0).map(() => {
    const key = `qh_${orgId}:SELECTIdFROMAccount${uuid()}`;
    const hashedKey = hashRecordSyncKey(key);
    return {
      id: uuid(),
      userId: userId,
      orgId: orgId,
      key,
      hashedKey,
      entity: entity,
      data: {
        key,
        isFavorite: isFavorite,
      },
      createdAt: createdAt,
      updatedAt: updatedAt,
      deletedAt: deletedAt,
    };
  });
}

describe('UserSyncData Cleanup Integration Test', () => {
  // let seedResults: Awaited<ReturnType<typeof seedDatabase>> = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    // Clean up table before each test
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
    // await prisma.user.deleteMany({});
  });

  it('should delete all deletedAt records beyond threshold', async () => {
    const userId = uuid();
    const orgId = uuid();

    await prisma.user.create({
      data: { id: userId, email: `test@${userId}.com`, name: userId, userId: userId },
    });

    const syncRecordsBeforeThreshold = generateSyncRecords({
      entity: 'query_history',
      count: 200,
      userId,
      orgId,
      isFavorite: false,
      updatedAt: new Date(),
      deletedAt: addDays(new Date(), (DELETED_AT_THRESHOLD - 1) * -1),
    });

    const syncRecordsAfterThreshold = generateSyncRecords({
      entity: 'query_history',
      count: 750,
      userId,
      orgId,
      isFavorite: false,
      updatedAt: new Date(),
      deletedAt: addDays(new Date(), (DELETED_AT_THRESHOLD + 1) * -1),
    });

    const { count } = await prisma.userSyncData.createMany({
      data: [...syncRecordsBeforeThreshold, ...syncRecordsAfterThreshold],
    });
    let dbCount = await prisma.userSyncData.count();
    // ensure insert worked correctly
    expect(count).toEqual(200 + 750);
    expect(count).toEqual(dbCount);

    await cleanUpUserSyncHistory(prisma);

    // should delete all soft-deleted records beyond expiration date
    dbCount = await prisma.userSyncData.count();
    expect(dbCount).toEqual(200);
  });

  it('should not delete records below threshold', async () => {
    const userId = uuid();
    const orgId = uuid();

    await prisma.user.create({
      data: { id: userId, email: `test@${userId}.com`, name: userId, userId: userId },
    });

    const syncRecords = generateSyncRecords({
      entity: 'query_history',
      count: 150,
      userId,
      orgId,
      isFavorite: false,
      updatedAt: new Date(),
      deletedAt: null,
    });

    const { count } = await prisma.userSyncData.createMany({
      data: syncRecords,
    });
    let dbCount = await prisma.userSyncData.count();
    // ensure insert worked correctly
    expect(count).toEqual(150);
    expect(count).toEqual(dbCount);

    await cleanUpUserSyncHistory(prisma);

    // nothing should have been deleted
    dbCount = await prisma.userSyncData.count();
    expect(count).toEqual(150);
    expect(count).toEqual(dbCount);
  });

  it('Should not delete records beyond threshold if records are newer than OLDER_THAN_THRESHOLD and count is within EXTREME_EXCESS_THRESHOLD', async () => {
    const userId = uuid();
    const orgId = uuid();

    await prisma.user.create({
      data: { id: userId, email: `test@${userId}.com`, name: userId, userId: userId },
    });

    const recordCount = EXCESS_THRESHOLD + EXCESS_THRESHOLD;

    const syncRecordsBeforeThreshold = generateSyncRecords({
      entity: 'query_history',
      count: recordCount,
      userId,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });

    const { count } = await prisma.userSyncData.createMany({
      data: syncRecordsBeforeThreshold,
    });
    let dbCount = await prisma.userSyncData.count();
    // ensure insert worked correctly
    expect(count).toEqual(recordCount);
    expect(count).toEqual(dbCount);

    await cleanUpUserSyncHistory(prisma);

    // no records should have been deleted
    dbCount = await prisma.userSyncData.count();
    expect(dbCount).toEqual(recordCount);
  });

  it('Should delete records beyond threshold if older than OLDER_THAN_THRESHOLD', async () => {
    const userId = uuid();
    const orgId = uuid();

    await prisma.user.create({
      data: { id: userId, email: `test@${userId}.com`, name: userId, userId: userId },
    });

    const syncRecordsBeforeThreshold = generateSyncRecords({
      entity: 'query_history',
      count: EXCESS_THRESHOLD,
      userId,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });

    const syncRecordsAfterThreshold = generateSyncRecords({
      entity: 'query_history',
      count: 1234,
      userId,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD + OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });

    const { count } = await prisma.userSyncData.createMany({
      data: [...syncRecordsBeforeThreshold, ...syncRecordsAfterThreshold],
    });
    let dbCount = await prisma.userSyncData.count();
    // ensure insert worked correctly
    expect(count).toEqual(EXCESS_THRESHOLD + 1234);
    expect(count).toEqual(dbCount);

    await cleanUpUserSyncHistory(prisma);

    // All excess records should have been deleted
    dbCount = await prisma.userSyncData.count();
    expect(dbCount).toEqual(EXCESS_THRESHOLD);
  });

  it('Should not delete favorites if under extreme threshold', async () => {
    const userId = uuid();
    const orgId = uuid();

    await prisma.user.create({
      data: { id: userId, email: `test@${userId}.com`, name: userId, userId: userId },
    });

    const syncRecordsBeforeThreshold = generateSyncRecords({
      entity: 'query_history',
      count: EXCESS_THRESHOLD,
      userId,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });

    const syncRecordsIsFavoriteAfterThreshold = generateSyncRecords({
      entity: 'query_history',
      count: 123,
      userId,
      orgId,
      isFavorite: true,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD + OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });

    const syncRecordsAfterThreshold = generateSyncRecords({
      entity: 'query_history',
      count: 456,
      userId,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD + OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });

    const { count } = await prisma.userSyncData.createMany({
      data: [...syncRecordsBeforeThreshold, ...syncRecordsIsFavoriteAfterThreshold, ...syncRecordsAfterThreshold],
    });
    let dbCount = await prisma.userSyncData.count();
    // ensure insert worked correctly
    expect(count).toEqual(EXCESS_THRESHOLD + 123 + 456);
    expect(count).toEqual(dbCount);

    await cleanUpUserSyncHistory(prisma);

    // All excess records should have been deleted
    dbCount = await prisma.userSyncData.count();
    expect(dbCount).toEqual(EXCESS_THRESHOLD + 123);
  });

  it('Should delete EXTREME_EXCESS_PURGE_COUNT if records are beyond EXTREME_EXCESS_THRESHOLD and not yet beyond OLDER_THAN_THRESHOLD', async () => {
    const userId = uuid();
    const orgId = uuid();

    await prisma.user.create({
      data: { id: userId, email: `test@${userId}.com`, name: userId, userId: userId },
    });

    const syncRecordsBeforeThreshold = generateSyncRecords({
      entity: 'query_history',
      count: EXCESS_THRESHOLD,
      userId,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });

    const syncRecordsBeforeThresholdButExcess = generateSyncRecords({
      entity: 'query_history',
      count: EXTREME_EXCESS_THRESHOLD + EXTREME_EXCESS_THRESHOLD,
      userId,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });

    const totalRecordCount = EXCESS_THRESHOLD + EXTREME_EXCESS_THRESHOLD + EXTREME_EXCESS_THRESHOLD;

    const { count } = await prisma.userSyncData.createMany({
      data: [...syncRecordsBeforeThreshold, ...syncRecordsBeforeThresholdButExcess],
    });
    let dbCount = await prisma.userSyncData.count();
    // ensure insert worked correctly
    expect(count).toEqual(totalRecordCount);
    expect(count).toEqual(dbCount);

    await cleanUpUserSyncHistory(prisma);

    // All excess records should have been deleted
    dbCount = await prisma.userSyncData.count();
    expect(dbCount).toEqual(EXTREME_EXCESS_THRESHOLD);
  });

  it('Delete scope should be limited to user+entity', async () => {
    const userId1 = uuid();
    const userId2 = uuid();
    const userId3 = uuid();
    const orgId = uuid();

    await prisma.user.createMany({
      data: [
        { id: userId1, email: `test@${userId1}.com`, name: userId1, userId: userId1 },
        { id: userId2, email: `test@${userId2}.com`, name: userId2, userId: userId2 },
        { id: userId3, email: `test@${userId3}.com`, name: userId3, userId: userId3 },
      ],
    });

    const user1_queryHistoryToKeep = generateSyncRecords({
      entity: 'query_history',
      count: EXCESS_THRESHOLD,
      userId: userId1,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });
    const user1_queryHistoryToDelete = generateSyncRecords({
      entity: 'query_history',
      count: 11,
      userId: userId1,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD + OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });
    const user1_savedMappingToKeep = generateSyncRecords({
      entity: 'load_saved_mapping',
      count: EXCESS_THRESHOLD,
      userId: userId1,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });
    const user1_savedMappingToDelete = generateSyncRecords({
      entity: 'load_saved_mapping',
      count: 22,
      userId: userId1,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD + OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });

    const user2_queryHistory = generateSyncRecords({
      entity: 'query_history',
      count: 554,
      userId: userId2,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD + OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });
    const user2_savedMapping = generateSyncRecords({
      entity: 'load_saved_mapping',
      count: 543,
      userId: userId2,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD + OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });
    const user3_queryHistory = generateSyncRecords({
      entity: 'query_history',
      count: EXCESS_THRESHOLD,
      userId: userId3,
      orgId,
      isFavorite: false,
      updatedAt: addDays(new Date(), Math.floor(Math.random() * OLDER_THAN_THRESHOLD + OLDER_THAN_THRESHOLD) * -1),
      deletedAt: null,
    });

    const { count } = await prisma.userSyncData.createMany({
      data: [
        ...user1_queryHistoryToKeep,
        ...user1_queryHistoryToDelete,
        ...user1_savedMappingToKeep,
        ...user1_savedMappingToDelete,
        ...user2_queryHistory,
        ...user2_savedMapping,
        ...user3_queryHistory,
      ],
    });
    const dbCount = await prisma.userSyncData.count();
    // ensure insert worked correctly
    expect(count).toEqual(EXCESS_THRESHOLD + 11 + EXCESS_THRESHOLD + 22 + 554 + 543 + EXCESS_THRESHOLD);
    expect(count).toEqual(dbCount);

    await cleanUpUserSyncHistory(prisma);

    // All excess records should have been deleted
    expect(await prisma.userSyncData.count({ where: { userId: userId1, entity: 'query_history' } })).toEqual(EXCESS_THRESHOLD);
    expect(await prisma.userSyncData.count({ where: { userId: userId1, entity: 'load_saved_mapping' } })).toEqual(EXCESS_THRESHOLD);
    expect(await prisma.userSyncData.count({ where: { userId: userId2, entity: 'query_history' } })).toEqual(554);
    expect(await prisma.userSyncData.count({ where: { userId: userId2, entity: 'load_saved_mapping' } })).toEqual(543);
    expect(await prisma.userSyncData.count({ where: { userId: userId3, entity: 'query_history' } })).toEqual(EXCESS_THRESHOLD);
    expect(await prisma.userSyncData.count({ where: { userId: userId3, entity: 'load_saved_mapping' } })).toEqual(0);
  });
});
