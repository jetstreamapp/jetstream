import { getExceptionLog } from '@jetstream/api-config';
import { prisma } from './config/db.config';
import { logger } from './config/logger.config';
import { getAmplitudeChart } from './utils/amplitude-dashboard-api';

const CHART_IDS = {
  LOAD: {
    YEAR: 'rens73dw',
    MONTH: 'iyt2blcf',
    WEEK: 'so649gq9',
  },
  QUERY: {
    YEAR: '33tylew6',
    MONTH: 'icruamqk',
    WEEK: 'zs6f0dl8',
  },
};

(async () => {
  try {
    logger.info('[ANALYTICS SUMMARY] Exporting data from amplitude');

    const CHART_LOAD_YEAR = (await getAmplitudeChart(CHART_IDS.LOAD.YEAR)).data.seriesCollapsed[0][0].value;
    const CHART_LOAD_MONTH = (await getAmplitudeChart(CHART_IDS.LOAD.MONTH)).data.seriesCollapsed[0][0].value;
    const CHART_LOAD_WEEK = (await getAmplitudeChart(CHART_IDS.LOAD.WEEK)).data.seriesCollapsed[0][0].value;

    const CHART_QUERY_YEAR = (await getAmplitudeChart(CHART_IDS.QUERY.YEAR)).data.seriesCollapsed[0][0].value;
    const CHART_QUERY_MONTH = (await getAmplitudeChart(CHART_IDS.QUERY.MONTH)).data.seriesCollapsed[0][0].value;
    const CHART_QUERY_WEEK = (await getAmplitudeChart(CHART_IDS.QUERY.WEEK)).data.seriesCollapsed[0][0].value;

    logger.info('[ANALYTICS SUMMARY] Saving data to database');

    const loadResults = await prisma.analyticsSummary.upsert({
      create: {
        type: 'LOAD_SUMMARY',
        year: CHART_LOAD_YEAR,
        month: CHART_LOAD_MONTH,
        week: CHART_LOAD_WEEK,
      },
      update: {
        year: CHART_LOAD_YEAR,
        month: CHART_LOAD_MONTH,
        week: CHART_LOAD_WEEK,
      },
      where: {
        type: 'LOAD_SUMMARY',
      },
    });

    logger.info('[ANALYTICS SUMMARY] Load data saved', { loadResults });

    const queryResults = await prisma.analyticsSummary.upsert({
      create: {
        type: 'QUERY_SUMMARY',
        year: CHART_QUERY_YEAR,
        month: CHART_QUERY_MONTH,
        week: CHART_QUERY_WEEK,
      },
      update: {
        year: CHART_QUERY_YEAR,
        month: CHART_QUERY_MONTH,
        week: CHART_QUERY_WEEK,
      },
      where: {
        type: 'QUERY_SUMMARY',
      },
    });

    logger.info({ queryResults }, '[ANALYTICS SUMMARY] Query data saved');

    logger.info('[ANALYTICS SUMMARY] Done');
  } catch (ex) {
    logger.error(getExceptionLog(ex), '[ANALYTICS SUMMARY][ERROR]');
    logger.error(ex.stack);
  }
})();
