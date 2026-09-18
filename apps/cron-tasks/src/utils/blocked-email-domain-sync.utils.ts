import { PrismaClient } from '@jetstream/prisma';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ENV } from '../config/env-config';
import { logger } from '../config/logger.config';

/**
 * Community-maintained disposable-domain blocklist, newline delimited with `//` comments. Holds
 * roughly 8,000 domains and is additive far more often than it is subtractive.
 */
const DEFAULT_LIST_URL =
  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

/**
 * A short fetch is far more likely to be a truncated response or an upstream repo change than a
 * genuine mass-delisting, and acting on one would silently drop most of the blocklist. Kept a little
 * over half the list's real size: high enough that a truncated response cannot clear it, low enough
 * that ordinary churn never trips it. Raise this if the upstream list grows substantially.
 */
const MIN_EXPECTED_DOMAINS = 5000;

/** Postgres caps bind parameters per statement; the list is far larger than one statement should carry. */
const BATCH_SIZE = 1000;

const VALID_DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export interface BlockedEmailDomainSyncResult {
  /** In test mode every count is what the run *would* have done — nothing was written. */
  testMode: boolean;
  fetched: number;
  skippedInvalid: number;
  added: number;
  removed: number;
  totalAfterSync: number;
}

function parseDomainList(body: string) {
  const domains = new Set<string>();
  let skippedInvalid = 0;

  for (const line of body.split('\n')) {
    // The upstream file uses `//` for comments; `#` costs nothing to tolerate in case that changes.
    const domain = line.trim().toLowerCase().replace(/\.$/, '');
    if (!domain || domain.startsWith('//') || domain.startsWith('#')) {
      continue;
    }
    if (domain.length > 255 || !VALID_DOMAIN.test(domain)) {
      skippedInvalid++;
      continue;
    }
    domains.add(domain);
  }

  return { domains, skippedInvalid };
}

async function fetchDomainList(url: string) {
  const response = await fetch(url, { headers: { Accept: 'text/plain' }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`Blocklist fetch failed with ${response.status} ${response.statusText}`);
  }
  return response.text();
}

/**
 * Refresh the disposable-domain blocklist from the upstream list.
 *
 * Only LIST_SYNC rows are ever deleted, and a domain that already exists is never rewritten, so a
 * MANUAL decision in either direction (a hand-added block, or an allowlist row with blocked = false)
 * always survives the next run. That is what keeps the legitimate forwarding services public lists
 * tend to include usable - they ship as seeded MANUAL allowlist rows, so this job needs no
 * hardcoded exceptions of its own.
 */
export async function syncBlockedEmailDomains(prisma: PrismaClient): Promise<BlockedEmailDomainSyncResult> {
  const testMode = process.env.TEST_MODE === 'true';
  const url = ENV.BLOCKED_EMAIL_DOMAIN_LIST_URL || DEFAULT_LIST_URL;

  if (testMode) {
    logger.info('Running in TEST MODE - no changes will be written');
  }

  const { domains, skippedInvalid } = parseDomainList(await fetchDomainList(url));

  if (domains.size < MIN_EXPECTED_DOMAINS) {
    throw new Error(`Blocklist contained only ${domains.size} usable domains (expected at least ${MIN_EXPECTED_DOMAINS}) - aborting`);
  }

  const existingRows = await prisma.blockedEmailDomain.findMany({ select: { domain: true, source: true } });
  const existingDomains = new Set(existingRows.map(({ domain }) => domain));
  const existingSyncedDomains = existingRows.filter(({ source }) => source === 'LIST_SYNC').map(({ domain }) => domain);

  const domainsToAdd = [...domains].filter((domain) => !existingDomains.has(domain));
  const domainsToRemove = existingSyncedDomains.filter((domain) => !domains.has(domain));

  let added = 0;
  let removed = 0;

  if (!testMode) {
    // Both loops are guarded because splitArrayToMaxSize returns [[]] rather than [] for an empty
    // input, which would otherwise cost a no-op round trip on a run with nothing to do.
    if (domainsToAdd.length) {
      for (const batch of splitArrayToMaxSize(domainsToAdd, BATCH_SIZE)) {
        const { count } = await prisma.blockedEmailDomain.createMany({
          data: batch.map((domain) => ({ domain, blocked: true, source: 'LIST_SYNC' as const })),
          // Tolerates a row added concurrently (or by hand) between the read above and this write.
          skipDuplicates: true,
        });
        added += count;
      }
    }

    if (domainsToRemove.length) {
      for (const batch of splitArrayToMaxSize(domainsToRemove, BATCH_SIZE)) {
        const { count } = await prisma.blockedEmailDomain.deleteMany({
          where: { domain: { in: batch }, source: 'LIST_SYNC' },
        });
        removed += count;
      }
    }
  } else {
    added = domainsToAdd.length;
    removed = domainsToRemove.length;
  }

  const totalAfterSync = testMode ? existingDomains.size + added - removed : await prisma.blockedEmailDomain.count();

  return { testMode, fetched: domains.size, skippedInvalid, added, removed, totalAfterSync };
}
