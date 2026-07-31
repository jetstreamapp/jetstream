import { prisma } from './config/db.config';
import { logger } from './config/logger.config';
import { manageSsoCertificateExpiration } from './utils/sso-certificate-expiration.utils';

manageSsoCertificateExpiration(prisma)
  .then((result) => {
    logger.info(
      result,
      result.testMode
        ? 'SSO certificate expiration notifications completed (TEST MODE - counts are what would have been sent)'
        : 'SSO certificate expiration notifications completed',
    );
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
