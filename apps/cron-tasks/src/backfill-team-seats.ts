import Stripe from 'stripe';
import { prisma } from './config/db.config';
import { ENV } from './config/env-config';
import { logger } from './config/logger.config';
import { backfillTeamSeats } from './utils/backfill-team-seats.utils';

/**
 * One-off entry point: migrate self-serve teams to purchased seats by mirroring their Stripe quantity.
 * Run with DRY_RUN=true first, review the WARN lines, then run for real. Exits non-zero when any team
 * could not be read from Stripe so a partial run is obvious.
 */

// Keep in sync with STRIPE_API_VERSION in apps/api/src/app/services/stripe.service.ts
const STRIPE_API_VERSION = '2026-08-26.dahlia';

if (!ENV.STRIPE_API_KEY) {
  logger.error('STRIPE_API_KEY is required to backfill team seats');
  process.exit(1);
}

const stripe = new Stripe(ENV.STRIPE_API_KEY, { apiVersion: STRIPE_API_VERSION });

backfillTeamSeats({ prisma, stripe, dryRun: ENV.DRY_RUN, logger })
  .then((result) => {
    logger.info(
      result,
      result.dryRun ? 'Team seat backfill completed (DRY RUN - counts are what would have been written)' : 'Team seat backfill completed',
    );
    if (result.failures > 0) {
      logger.error({ failures: result.failures }, 'Team seat backfill finished with failures, re-run after resolving the errors above');
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
