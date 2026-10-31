import { installProcessErrorHandlers } from '@jetstream/api-config';
import { prisma } from './config/db.config';
import { logger } from './config/logger.config';
import { manageOrgExpiration } from './utils/salesforce-org-expiration.utils';

// The only cron job that loads @jetstream/api-config, which used to install these handlers on import
installProcessErrorHandlers();

manageOrgExpiration(prisma)
  .then((result) => {
    logger.info(result, 'Org expiration management completed');
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
