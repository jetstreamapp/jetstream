import { startOfDay, subDays } from 'date-fns';
import { prisma } from './config/db.config';
import { logger } from './config/logger.config';
import { queryDailyEventCounts } from './utils/betterstack-telemetry-api';

const ROLLUP_TYPES = {
  LOAD: 'LOAD',
  QUERY: 'QUERY',
} as const;

/**
 * Number of trailing days re-fetched from Better Stack on every run. Days are upserted, so
 * re-fetching a window makes the job idempotent and tolerant of missed runs or late-arriving events.
 */
const REFRESH_WINDOW_DAYS = 7;

async function upsertDailyRollup(date: Date, type: string, count: number) {
  await prisma.analyticsEventRollup.upsert({
    create: { date, type, count },
    update: { count },
    where: { date_type: { date, type } },
  });
}

async function sumRollupSince(type: string, since: Date): Promise<number> {
  const result = await prisma.analyticsEventRollup.aggregate({
    _sum: { count: true },
    where: { type, date: { gte: since } },
  });
  return result._sum.count ?? 0;
}

(async () => {
  try {
    logger.info('[ANALYTICS SUMMARY] Fetching daily event counts from Better Stack');

    const today = startOfDay(new Date());
    const dailyCounts = await queryDailyEventCounts({ startDate: subDays(today, REFRESH_WINDOW_DAYS), endDate: today });

    logger.info(`[ANALYTICS SUMMARY] Saving ${dailyCounts.length} day(s) of rollup data`);

    for (const { date, loadRecords, queryCount } of dailyCounts) {
      const day = new Date(`${date}T00:00:00.000Z`);
      await upsertDailyRollup(day, ROLLUP_TYPES.LOAD, loadRecords);
      await upsertDailyRollup(day, ROLLUP_TYPES.QUERY, queryCount);
    }

    const [loadWeek, loadMonth, loadYear, queryWeek, queryMonth, queryYear] = await Promise.all([
      sumRollupSince(ROLLUP_TYPES.LOAD, subDays(today, 7)),
      sumRollupSince(ROLLUP_TYPES.LOAD, subDays(today, 30)),
      sumRollupSince(ROLLUP_TYPES.LOAD, subDays(today, 365)),
      sumRollupSince(ROLLUP_TYPES.QUERY, subDays(today, 7)),
      sumRollupSince(ROLLUP_TYPES.QUERY, subDays(today, 30)),
      sumRollupSince(ROLLUP_TYPES.QUERY, subDays(today, 365)),
    ]);

    logger.info('[ANALYTICS SUMMARY] Saving data to database');

    const loadResults = await prisma.analyticsSummary.upsert({
      create: {
        type: 'LOAD_SUMMARY',
        year: loadYear,
        month: loadMonth,
        week: loadWeek,
      },
      update: {
        year: loadYear,
        month: loadMonth,
        week: loadWeek,
      },
      where: {
        type: 'LOAD_SUMMARY',
      },
    });

    logger.info({ loadResults }, '[ANALYTICS SUMMARY] Load data saved');

    const queryResults = await prisma.analyticsSummary.upsert({
      create: {
        type: 'QUERY_SUMMARY',
        year: queryYear,
        month: queryMonth,
        week: queryWeek,
      },
      update: {
        year: queryYear,
        month: queryMonth,
        week: queryWeek,
      },
      where: {
        type: 'QUERY_SUMMARY',
      },
    });

    logger.info({ queryResults }, '[ANALYTICS SUMMARY] Query data saved');

    logger.info('[ANALYTICS SUMMARY] Done');
  } catch (ex) {
    logger.error({ err: ex }, '[ANALYTICS SUMMARY][ERROR]');
    logger.error(ex.stack);
  }
})();
