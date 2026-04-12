import { prisma } from './config/db.config';
import { logger } from './config/logger.config';
import { detectFirewallSpike } from './utils/cloudflare-spike-detector.utils';

detectFirewallSpike(prisma)
  .then((result) => {
    logger.info(result, 'Cloudflare spike detection completed');
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
