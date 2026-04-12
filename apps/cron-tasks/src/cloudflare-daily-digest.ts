import { prisma } from './config/db.config';
import { logger } from './config/logger.config';
import { sendCloudflareDailyDigest } from './utils/cloudflare-daily-digest.utils';

sendCloudflareDailyDigest(prisma)
  .then((result) => {
    logger.info(result, 'Cloudflare daily digest completed');
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
