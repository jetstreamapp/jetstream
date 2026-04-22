// Cron entrypoint for the Cloudflare analytics archiver.
//
// Deployment:
//   - Render cron service running `yarn start:cron:cloudflare-analytics-archiver`.
//   - Suggested schedule: hourly at :10 past the hour.
//   - Required env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_IDS, CLOUDFLARE_ANALYTICS_DBURI.
//   - Optional env: CLOUDFLARE_ANALYTICS_MAX_BACKFILL_HOURS (default 48),
//                   CLOUDFLARE_ANALYTICS_ROW_LIMIT (default 1000, the Cloudflare cap).
//   - Schema lives at apps/cron-tasks/db/cloudflare-analytics-schema.sql — apply by hand.

import { getCloudflareAnalyticsPool } from './config/db.config';
import { logger } from './config/logger.config';
import { archiveCloudflareAnalytics } from './utils/cloudflare-analytics-archiver.utils';

archiveCloudflareAnalytics(getCloudflareAnalyticsPool())
  .then((result) => {
    logger.info(result, 'Cloudflare analytics archiver completed');
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
