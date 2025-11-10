import { prisma } from './config/db.config';
import { logger } from './config/logger.config';
import { manageOrgExpiration } from './utils/salesforce-org-expiration.utils';

manageOrgExpiration(prisma)
  .then((result) => {
    logger.info('Org expiration management completed', result);
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
