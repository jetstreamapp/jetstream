import { sendEmail } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createAuditLog } from '@jetstream/audit-logs';
import { sendOrgExpirationWarningEmail } from '@jetstream/email';
import { Prisma, PrismaClient } from '@jetstream/prisma';
import { EXPIRED_TOKEN_PLACEHOLDER } from '@jetstream/shared/constants';
import {
  computeNextOrgNotificationDate,
  computeOrgExpirationDate,
  getDaysUntilOrgExpiration,
  getErrorMessageAndStackObj,
  ORG_EXPIRATION_CONNECTION_ERROR,
  ORG_EXPIRATION_NOTIFICATION_DAYS,
  ORG_SCHEDULE_AFTER_IDLE_DAYS,
} from '@jetstream/shared/utils';
import { addDays, endOfDay } from 'date-fns';
import Papa from 'papaparse';
import { logger } from '../config/logger.config';

/**
 * Skip emailing a user who has not logged in for this long. Purely a deliverability guard - mailing
 * abandoned accounts costs sender reputation without changing anything for them. Deliberately much
 * longer than the org inactivity window: by the time it fires, the user has been gone several times
 * longer than an org's entire lifecycle. It never suppresses a warning the user could still act on -
 * see `hasSavableOrg` below.
 */
const USER_INACTIVITY_DAYS = 90;

/**
 * Notification counters keyed by the threshold each org satisfied, rather than by exact day count.
 * An org notified 5 days out (a catch-up after a skipped cron run) buckets into the `1` threshold.
 */
function bucketByThreshold(daysUntilExpiration: number): number {
  const descendingThresholds = [...ORG_EXPIRATION_NOTIFICATION_DAYS].sort((a, b) => b - a);
  // daysUntilExpiration is clamped to >= 0 and 0 is a threshold, so this always matches
  return descendingThresholds.find((threshold) => daysUntilExpiration >= threshold) ?? 0;
}

function emptyThresholdCounts(): Record<number, number> {
  return ORG_EXPIRATION_NOTIFICATION_DAYS.reduce((acc, threshold) => ({ ...acc, [threshold]: 0 }), {} as Record<number, number>);
}

interface OrgExpirationResult {
  testMode: boolean;
  /** Orgs entering the warning window for the first time (`expirationScheduledFor` was null) */
  scheduled: number;
  /** Orgs whose stored date was shrunk toward the Salesforce-derived date (stale rows from the old policy) */
  realigned: number;
  usersNotified: number;
  /** Users skipped as dormant - see USER_INACTIVITY_DAYS */
  usersSkipped: number;
  /** Orgs notified, keyed by the ORG_EXPIRATION_NOTIFICATION_DAYS threshold they satisfied */
  notifiedByThreshold: Record<number, number>;
  /** Users whose email failed - their notification schedule was deliberately left unadvanced so it retries */
  emailFailures: number;
  expired: number;
}

interface TestModeData {
  scheduledOrgs: Array<{ orgId: number; uniqueId: string; username: string; expirationDate: Date; realigned: boolean }>;
  notifications: Array<{
    userEmail: string;
    orgUsername: string;
    orgId: string;
    daysUntilExpiration: number;
    userLastLoggedIn: string | null;
    emailSkipped: boolean;
  }>;
  expiredOrgs: Array<{ orgId: number; uniqueId: string; username: string; orgName: string | null }>;
}

/**
 * Keep Jetstream's view of an org's credentials in sync with Salesforce's refresh token policy.
 *
 * Salesforce invalidates a partner connected app's refresh token after ORG_INACTIVITY_EXPIRATION_DAYS
 * without use. Jetstream cannot extend that, so `expirationScheduledFor` is *derived* from the last
 * time the org was used (`lastActivityAt + 30 days`) rather than granted. The three steps run strictly
 * in order so that a long-overdue org is scheduled, notified, and scrubbed within a single run.
 */
export async function manageOrgExpiration(prisma: PrismaClient, initialDate = new Date()): Promise<OrgExpirationResult> {
  const now = endOfDay(initialDate);
  const testMode = process.env.TEST_MODE === 'true';

  const result: OrgExpirationResult = {
    testMode,
    scheduled: 0,
    realigned: 0,
    usersNotified: 0,
    usersSkipped: 0,
    notifiedByThreshold: emptyThresholdCounts(),
    emailFailures: 0,
    expired: 0,
  };

  const testModeData: TestModeData = {
    scheduledOrgs: [],
    notifications: [],
    expiredOrgs: [],
  };

  if (testMode) {
    logger.info('Running in TEST MODE - no actual updates will be made');
  }

  // 1. Record the derived expiration date for every org at or past the warning window
  const idleSince = addDays(now, -ORG_SCHEDULE_AFTER_IDLE_DAYS);

  const scheduleCandidateWhere: Prisma.SalesforceOrgWhereInput = {
    connectionError: null,
    accessToken: { not: EXPIRED_TOKEN_PLACEHOLDER },
    OR: [{ lastActivityAt: { lte: idleSince } }, { lastActivityAt: null, updatedAt: { lte: idleSince } }],
  };

  const scheduleCandidates = await prisma.salesforceOrg.findMany({
    where: scheduleCandidateWhere,
    select: { id: true, uniqueId: true, username: true, lastActivityAt: true, updatedAt: true, expirationScheduledFor: true },
  });

  /**
   * Expiration dates for orgs this run has scheduled (or, in test mode, would have scheduled).
   * Step 2 reads through this so it can notify on the same run the date is computed, without having
   * to re-read the rows or assume a single shared date across every org.
   */
  const scheduledExpirationByOrgId = new Map<number, Date>();

  interface ScheduleGroup {
    expirationDate: Date;
    activityBaseDate: Date;
    needsActivityBackfill: boolean;
    orgIds: number[];
  }
  const scheduleGroups = new Map<string, ScheduleGroup>();

  for (const org of scheduleCandidates) {
    const activityBaseDate = endOfDay(org.lastActivityAt ?? org.updatedAt);
    const expirationDate = computeOrgExpirationDate(activityBaseDate);

    /**
     * Shrink only. `updatedAt` is bumped by any write at all - a label edit, an org move, a token
     * refresh, even this cron's own updates - so allowing the derived date to move later would hand
     * orgs a grace period Salesforce never gave them and re-fire notifications every run. Leaving an
     * already-correct row untouched is also what makes repeat runs on the same day idempotent.
     */
    if (org.expirationScheduledFor && org.expirationScheduledFor <= expirationDate) {
      continue;
    }

    const realigned = !!org.expirationScheduledFor;
    if (realigned) {
      result.realigned++;
    } else {
      result.scheduled++;
    }

    scheduledExpirationByOrgId.set(org.id, expirationDate);

    if (testMode) {
      testModeData.scheduledOrgs.push({
        orgId: org.id,
        uniqueId: org.uniqueId,
        username: org.username,
        expirationDate,
        realigned,
      });
      continue;
    }

    // `lastActivityAt` is only backfilled when it is null, so the group key has to account for it
    const needsActivityBackfill = !org.lastActivityAt;
    const key = `${expirationDate.getTime()}:${needsActivityBackfill}`;
    const existingGroup = scheduleGroups.get(key);
    if (existingGroup) {
      existingGroup.orgIds.push(org.id);
    } else {
      scheduleGroups.set(key, { expirationDate, activityBaseDate, needsActivityBackfill, orgIds: [org.id] });
    }
  }

  if (testMode) {
    logger.info(`[TEST MODE] Would schedule ${result.scheduled} and realign ${result.realigned} orgs for expiration`);
  } else {
    // endOfDay collapses the group key to a calendar day, so steady state is a single statement per run
    for (const { expirationDate, activityBaseDate, needsActivityBackfill, orgIds } of scheduleGroups.values()) {
      await prisma.salesforceOrg.updateMany({
        where: { id: { in: orgIds } },
        data: {
          expirationScheduledFor: expirationDate,
          // The deadline just changed, so notify on this run rather than waiting for the next threshold
          nextExpirationNotificationDate: now,
          /**
           * Pin the inactivity base for legacy rows that predate `lastActivityAt`. Without this the
           * derived date depends on `updatedAt`, a column this cron mutates itself. Note the pinned
           * value means "last known write" for those rows, not literally "last used".
           */
          ...(needsActivityBackfill ? { lastActivityAt: activityBaseDate } : {}),
        },
      });
    }
    logger.info(`Scheduled ${result.scheduled} and realigned ${result.realigned} orgs for expiration`);
  }

  // 2. Notify owners of every org whose next notification has come due
  const userInactivityThreshold = addDays(now, -USER_INACTIVITY_DAYS);
  const orgsToNotifyWhere: Prisma.SalesforceOrgWhereInput = testMode
    ? {
        // No writes happened in test mode, so union in the orgs step 1 would have scheduled
        connectionError: null,
        OR: [
          { expirationScheduledFor: { not: null }, nextExpirationNotificationDate: { not: null, lte: now } },
          { id: { in: [...scheduledExpirationByOrgId.keys()] } },
        ],
      }
    : {
        expirationScheduledFor: { not: null },
        nextExpirationNotificationDate: { not: null, lte: now },
        connectionError: null,
      };

  const allScheduledOrgs = await prisma.salesforceOrg.findMany({
    where: orgsToNotifyWhere,
    include: {
      jetstreamUser: {
        select: {
          id: true,
          email: true,
          name: true,
          lastLoggedIn: true,
        },
      },
    },
  });

  const orgsAtThreshold = allScheduledOrgs.flatMap((org) => {
    // Prefer the date step 1 just derived - in test mode the stored value is still the stale one
    const effectiveExpirationDate = scheduledExpirationByOrgId.get(org.id) ?? org.expirationScheduledFor;
    if (!effectiveExpirationDate) {
      return [];
    }
    /**
     * Clamped at 0 so an org whose derived date is months in the past reads as "connection ended"
     * rather than a negative countdown. This drives the email wording, the audit action, and the counters.
     */
    const daysUntilExpiration = Math.max(0, getDaysUntilOrgExpiration(effectiveExpirationDate, now));
    return [{ org, effectiveExpirationDate, daysUntilExpiration }];
  });

  if (orgsAtThreshold.length > 0) {
    // Group orgs by user so each user gets a single email covering all of their expiring orgs
    const orgsByUser = orgsAtThreshold.reduce(
      (acc, { org, effectiveExpirationDate, daysUntilExpiration }) => {
        if (!org.jetstreamUser) return acc;
        const userId = org.jetstreamUser.id;
        if (!acc[userId]) {
          acc[userId] = {
            user: org.jetstreamUser,
            orgs: [],
          };
        }
        acc[userId].orgs.push({ org, effectiveExpirationDate, daysUntilExpiration });
        return acc;
      },
      {} as Record<
        string,
        {
          user: { id: string; email: string; name: string; lastLoggedIn: Date | null };
          orgs: Array<{ org: (typeof allScheduledOrgs)[number]; effectiveExpirationDate: Date; daysUntilExpiration: number }>;
        }
      >,
    );

    for (const [userId, { user, orgs }] of Object.entries(orgsByUser)) {
      const userInactive = !user.lastLoggedIn || user.lastLoggedIn <= userInactivityThreshold;
      // Never let the dormancy guard swallow a warning for a connection the user could still save
      const hasSavableOrg = orgs.some(({ daysUntilExpiration }) => daysUntilExpiration > 0);
      const shouldSkipEmail = userInactive && !hasSavableOrg;
      const orgSummary = orgs.map(({ daysUntilExpiration, org }) => `${org.uniqueId} (${daysUntilExpiration}d)`).join(', ');
      const testModePrefix = testMode ? '[TEST MODE] Would ' : '';

      if (shouldSkipEmail) {
        result.usersSkipped++;
        logger.info(
          `${testModePrefix}Skip email for inactive user ${user.email} (last login: ${user.lastLoggedIn?.toISOString() || 'never'}) about ${orgs.length} org(s): ${orgSummary}`,
        );
      } else {
        logger.info(`${testModePrefix}Notify user ${user.email} about ${orgs.length} org(s): ${orgSummary}`);
      }

      if (testMode) {
        if (!shouldSkipEmail) {
          result.usersNotified++;
        }
        orgs.forEach(({ org, daysUntilExpiration }) => {
          testModeData.notifications.push({
            userEmail: user.email,
            orgUsername: org.username,
            orgId: org.uniqueId,
            daysUntilExpiration,
            userLastLoggedIn: user.lastLoggedIn?.toISOString() || null,
            emailSkipped: shouldSkipEmail,
          });
        });
        orgs.forEach(({ daysUntilExpiration }) => result.notifiedByThreshold[bucketByThreshold(daysUntilExpiration)]++);
        continue;
      }

      if (!shouldSkipEmail) {
        try {
          await sendOrgExpirationWarningEmail({
            emailAddress: user.email,
            orgs: orgs.map(({ org, daysUntilExpiration }) => ({
              username: org.username,
              organizationId: org.organizationId,
              instanceUrl: org.instanceUrl,
              daysUntilExpiration,
            })),
          });
        } catch (error) {
          /**
           * Leave the schedule untouched so the next run retries this user. A duplicate email is a
           * far better outcome than silently burning one of only three notifications.
           */
          result.emailFailures++;
          logger.error(
            { userId, ...getErrorMessageAndStackObj(error) },
            `Failed to send org expiration email to ${user.email} - schedule left unadvanced for retry`,
          );
          continue;
        }
        result.usersNotified++;
      }

      await createAuditLog({
        userId,
        action: orgs.some(({ daysUntilExpiration }) => daysUntilExpiration <= 0)
          ? AuditLogAction.ORG_EXPIRED
          : AuditLogAction.ORG_EXPIRATION_WARNING,
        resource: AuditLogResource.SALESFORCE_ORG,
        metadata: {
          orgCount: orgs.length,
          emailSkipped: shouldSkipEmail,
          orgDetails: orgs.map(({ org, daysUntilExpiration }) => ({
            orgId: org.id,
            daysUntilExpiration,
          })),
        },
      });

      for (const { org, effectiveExpirationDate, daysUntilExpiration } of orgs) {
        result.notifiedByThreshold[bucketByThreshold(daysUntilExpiration)]++;

        await prisma.salesforceOrg.update({
          where: { id: org.id },
          data: {
            // null once every threshold has passed, which takes the org out of this query for good
            nextExpirationNotificationDate: computeNextOrgNotificationDate(effectiveExpirationDate, now),
            lastExpirationNotificationAt: now,
          },
        });
      }
    }
  }

  // 3. Scrub credentials Salesforce has already invalidated
  const orgsToExpireWhere: Prisma.SalesforceOrgWhereInput = {
    expirationScheduledFor: { lte: now },
    accessToken: { not: EXPIRED_TOKEN_PLACEHOLDER },
    connectionError: null,
  };

  const orgsToExpire = await prisma.salesforceOrg.findMany({
    where: orgsToExpireWhere,
  });

  if (orgsToExpire.length > 0) {
    result.expired = orgsToExpire.length;
    if (testMode) {
      testModeData.expiredOrgs = orgsToExpire.map((org) => ({
        orgId: org.id,
        uniqueId: org.uniqueId,
        username: org.username,
        orgName: org.orgName,
      }));
      logger.info(`[TEST MODE] Would expire ${orgsToExpire.length} org credentials`);
    } else {
      await prisma.salesforceOrg.updateMany({
        where: {
          id: { in: orgsToExpire.map(({ id }) => id) },
        },
        data: {
          accessToken: EXPIRED_TOKEN_PLACEHOLDER,
          connectionError: ORG_EXPIRATION_CONNECTION_ERROR,
        },
      });

      logger.info(`Expired ${orgsToExpire.length} org credentials`);

      for (const org of orgsToExpire) {
        if (org.jetstreamUserId2) {
          await createAuditLog({
            userId: org.jetstreamUserId2,
            action: AuditLogAction.ORG_CREDENTIALS_EXPIRED,
            resource: AuditLogResource.SALESFORCE_ORG,
            resourceId: org.id.toString(),
            metadata: {
              orgId: org.id,
              uniqueId: org.uniqueId,
              username: org.username,
              orgName: org.orgName,
            },
          });
        }
      }
    }
  }

  if (testMode) {
    await sendTestModeSummary(testModeData, result);
  }

  return result;
}

// Test mode helper function
async function sendTestModeSummary(testModeData: TestModeData, result: OrgExpirationResult): Promise<void> {
  const attachments: Array<{ filename: string; data: Buffer }> = [];

  // Create CSV attachments
  if (testModeData.scheduledOrgs.length > 0) {
    const scheduledCsv = Papa.unparse(testModeData.scheduledOrgs);
    attachments.push({
      filename: 'scheduled-orgs.csv',
      data: Buffer.from(scheduledCsv, 'utf-8'),
    });
  }

  if (testModeData.notifications.length > 0) {
    const notificationsCsv = Papa.unparse(testModeData.notifications);
    attachments.push({
      filename: 'notifications.csv',
      data: Buffer.from(notificationsCsv, 'utf-8'),
    });
  }

  if (testModeData.expiredOrgs.length > 0) {
    const expiredCsv = Papa.unparse(testModeData.expiredOrgs);
    attachments.push({
      filename: 'expired-orgs.csv',
      data: Buffer.from(expiredCsv, 'utf-8'),
    });
  }

  // Calculate how many emails would actually be sent
  const emailsToSend = testModeData.notifications.filter(({ emailSkipped }) => !emailSkipped).length;
  const emailsSkipped = testModeData.notifications.filter(({ emailSkipped }) => emailSkipped).length;
  const uniqueUsersToEmail = new Set(
    testModeData.notifications.filter(({ emailSkipped }) => !emailSkipped).map(({ userEmail }) => userEmail),
  ).size;

  // Email body with summary
  const emailText = [
    'Org Expiration Test Mode Summary',
    '',
    `Newly scheduled for expiration: ${result.scheduled}`,
    `Realigned to the Salesforce-derived date: ${result.realigned}`,
    ...Object.entries(result.notifiedByThreshold).map(([threshold, count]) => `Notified (${threshold} days): ${count}`),
    `Expired: ${result.expired}`,
    '',
    `Emails to send: ${uniqueUsersToEmail} users (${emailsToSend} orgs)`,
    `Emails skipped (inactive users): ${emailsSkipped} orgs`,
    '',
    'See attached CSV files for details.',
  ].join('\n');

  const emailHtml = emailText.replace(/\n/g, '<br>');

  try {
    await sendEmail({
      to: 'support@getjetstream.app',
      subject: 'Org Expiration Test Mode Summary',
      text: emailText,
      html: emailHtml,
      attachment: attachments,
    });
    logger.info('Test mode summary email sent to support@getjetstream.app');
  } catch (error) {
    logger.error({ error }, 'Failed to send test mode summary email');
  }
}
