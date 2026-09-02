import { logger, prisma } from '@jetstream/api-config';
import type { Maybe } from '@jetstream/types';

/**
 * Blocked-domain lookups for user-chosen email addresses (disposable/burner mail providers).
 *
 * This exists for deliverability, not security: burner signups generate bounces that damage sending
 * reputation and make the bounce rate useless as an abuse signal. Anyone determined can register a
 * throwaway domain, so this is never the only control on a path.
 *
 * The full list lives in the BlockedEmailDomain table and is kept current by the
 * blocked-email-domain-sync cron task, so nothing is held in memory here - each check is one
 * indexed query.
 */

/** Bounds the candidate list, which becomes an IN clause built from attacker-controlled input. */
const MAX_DOMAIN_LABELS = 6;

/**
 * The domain plus every parent suffix, most specific first, so `mail.burner.example` matches a list
 * entry for `burner.example`. Bounded at MAX_DOMAIN_LABELS labels.
 *
 * A bare TLD is never a candidate - a stray `com` row must not be able to block the world.
 */
export function getBlockedDomainCandidates(email: Maybe<string>): string[] {
  if (!email) {
    return [];
  }
  // Deliberately rsplit: an address may contain '@' in a quoted local part, and the domain is
  // always what follows the LAST one.
  const domain = email.trim().toLowerCase().split('@').pop()?.replace(/\.$/, '');
  if (!domain || !domain.includes('.') || domain.length > 255) {
    return [];
  }

  const labels = domain.split('.');
  if (labels.some((label) => !label)) {
    return [];
  }

  const candidates: string[] = [];
  const firstIndex = Math.max(0, labels.length - MAX_DOMAIN_LABELS);
  // Stop before the bare TLD (labels.length - 1).
  for (let i = firstIndex; i < labels.length - 1; i++) {
    candidates.push(labels.slice(i).join('.'));
  }
  return candidates;
}

/**
 * Whether the address' domain is blocked. The most specific matching row wins, so an explicit
 * `blocked = false` row for `relay.example.com` keeps working even while `example.com` is blocked.
 *
 * Fails OPEN: a database problem must not stop people from signing up. Every caller is on a path
 * that needs the database to succeed anyway, so an outage cannot be used to slip past this.
 */
export async function isEmailDomainBlocked(email: Maybe<string>): Promise<boolean> {
  const candidates = getBlockedDomainCandidates(email);
  if (!candidates.length) {
    return false;
  }

  try {
    const matches = await prisma.blockedEmailDomain.findMany({
      select: { domain: true, blocked: true },
      where: { domain: { in: candidates } },
    });
    if (!matches.length) {
      return false;
    }

    const matchesByDomain = new Map(matches.map(({ domain, blocked }) => [domain, blocked]));
    // candidates is already ordered most-specific-first.
    for (const candidate of candidates) {
      const blocked = matchesByDomain.get(candidate);
      if (blocked !== undefined) {
        return blocked;
      }
    }
    return false;
  } catch (ex) {
    logger.error({ err: ex }, '[BLOCKED_EMAIL_DOMAIN] Lookup failed, allowing the address through');
    return false;
  }
}
