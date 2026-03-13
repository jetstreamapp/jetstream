import { prisma } from './config/db.config';
import { logger } from './config/logger.config';
import { gatherAndSendStatsSummary } from './utils/stats-summary.utils';

gatherAndSendStatsSummary(prisma)
  .then(() => {
    logger.info('Stats summary completed');
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
