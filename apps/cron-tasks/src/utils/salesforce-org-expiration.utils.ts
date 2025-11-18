import { sendEmail } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createAuditLog } from '@jetstream/audit-logs';
import { sendOrgExpirationWarningEmail } from '@jetstream/email';
import { Prisma, PrismaClient } from '@jetstream/prisma';
import { addDays, endOfDay } from 'date-fns';
import Papa from 'papaparse';
import { logger } from '../config/logger.config';

const INACTIVITY_DAYS = 90;
const WARNING_PERIOD_DAYS = 30; // Grace period after inactivity before expiration
const NOTIFICATION_DAYS = [30, 7, 3, 0];
const USER_INACTIVITY_DAYS = 90; // Skip email if user hasn't logged in for this many days
const DUMMY_ENCRYPTED_TOKEN = 'v2:EXPIRED_TOKEN_PLACEHOLDER';
const CONNECTION_ERROR_MESSAGE = 'Credentials expired due to inactivity';

/**
 * Compute the next notification date based on expiration date and thresholds
 * Returns the smallest threshold date strictly greater than now, or null if none remain
 */
function computeNextNotificationDate(expirationDate: Date, now: Date, thresholds: number[]): Date | null {
  const candidates = thresholds
    .map((t) => endOfDay(addDays(expirationDate, -t)))
    .filter((d) => d > now)
    .sort((a, b) => a.getTime() - b.getTime());

  return candidates.length > 0 ? candidates[0] : null;
}

interface OrgExpirationResult {
  scheduled: number;
  notified30Days: number;
  notified7Days: number;
  notified3Days: number;
  expired: number;
}

interface TestModeData {
  scheduledOrgs: Array<{ orgId: number; uniqueId: string; username: string; expirationDate: Date }>;
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

export async function manageOrgExpiration(prisma: PrismaClient, initialDate = new Date()): Promise<OrgExpirationResult> {
  const now = endOfDay(initialDate);
  const inactivityThreshold = addDays(now, -INACTIVITY_DAYS);
  const testMode = process.env.TEST_MODE === 'true';

  const result: OrgExpirationResult = {
    scheduled: 0,
    notified30Days: 0,
    notified7Days: 0,
    notified3Days: 0,
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

  // 1. Schedule orgs for expiration that haven't been used in 90 days
  // Set expiration date to WARNING_PERIOD_DAYS in the future to give users time to reactivate
  const expirationDate = addDays(now, WARNING_PERIOD_DAYS);
  const firstNotificationDate = endOfDay(addDays(expirationDate, -30)); // 30 days before expiration

  const orgsToScheduleWhere: Prisma.SalesforceOrgWhereInput = {
    AND: [
      { connectionError: null },
      { expirationScheduledFor: null },
      { OR: [{ lastActivityAt: { lte: inactivityThreshold } }, { lastActivityAt: null, updatedAt: { lte: inactivityThreshold } }] },
    ],
  };

  if (testMode) {
    const orgsToScheduleQuery = await prisma.salesforceOrg.findMany({
      where: orgsToScheduleWhere,
      select: { id: true, uniqueId: true, username: true },
    });
    result.scheduled = orgsToScheduleQuery.length;
    testModeData.scheduledOrgs = orgsToScheduleQuery.map((org) => ({
      orgId: org.id,
      uniqueId: org.uniqueId,
      username: org.username,
      expirationDate,
    }));
    logger.info(`[TEST MODE] Would schedule ${orgsToScheduleQuery.length} orgs for expiration`);
  } else {
    const orgsToSchedule = await prisma.salesforceOrg.updateMany({
      where: orgsToScheduleWhere,
      data: {
        expirationScheduledFor: expirationDate,
        nextExpirationNotificationDate: firstNotificationDate,
      },
    });
    result.scheduled = orgsToSchedule.count;
    logger.info(`Scheduled ${orgsToSchedule.count} orgs for expiration`);
  }

  // 2. Get all orgs due for notification (nextExpirationNotificationDate <= now)
  const userInactivityThreshold = addDays(now, -USER_INACTIVITY_DAYS);
  const orgsToNotifyWhere: Prisma.SalesforceOrgWhereInput = testMode
    ? {
        // In test mode, include orgs that would be scheduled in this run
        connectionError: null,
        OR: [
          {
            expirationScheduledFor: { not: null },
            nextExpirationNotificationDate: { not: null, lte: now },
          },
          {
            // Orgs that would be scheduled in this run (these would get firstNotificationDate = now)
            expirationScheduledFor: null,
            OR: [{ lastActivityAt: { lte: inactivityThreshold } }, { lastActivityAt: null, updatedAt: { lte: inactivityThreshold } }],
          },
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

  // Calculate days until expiration for each org
  const orgsAtThreshold = allScheduledOrgs
    .map((org) => {
      // In test mode, orgs without expirationScheduledFor are newly scheduled
      const effectiveExpirationDate = org.expirationScheduledFor || expirationDate;
      const daysUntilExpiration = Math.max(0, Math.ceil((effectiveExpirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      return { org, daysUntilExpiration };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (orgsAtThreshold.length > 0) {
    // Group orgs by user
    const orgsByUser = orgsAtThreshold.reduce(
      (acc, { org, daysUntilExpiration }) => {
        if (!org.jetstreamUser) return acc;
        const userId = org.jetstreamUser.id;
        if (!acc[userId]) {
          acc[userId] = {
            user: org.jetstreamUser,
            orgs: [],
          };
        }
        acc[userId].orgs.push({ org, daysUntilExpiration });
        return acc;
      },
      {} as Record<
        string,
        {
          user: { id: string; email: string; name: string; lastLoggedIn: Date | null };
          orgs: Array<{ org: (typeof allScheduledOrgs)[number]; daysUntilExpiration: number }>;
        }
      >,
    );

    // Send notifications per user
    for (const [userId, { user, orgs }] of Object.entries(orgsByUser)) {
      const userInactive = !user.lastLoggedIn || user.lastLoggedIn <= userInactivityThreshold;
      const shouldSkipEmail = userInactive;

      if (testMode) {
        if (shouldSkipEmail) {
          logger.info(
            `[TEST MODE] Would skip email for inactive user ${user.email} (last login: ${user.lastLoggedIn?.toISOString() || 'never'}) about ${orgs.length} org(s): ${orgs.map(({ daysUntilExpiration, org }) => `${org.uniqueId} (${daysUntilExpiration}d)`).join(', ')}`,
          );
        } else {
          logger.info(
            `[TEST MODE] Would notify user ${user.email} about ${orgs.length} org(s): ${orgs.map(({ daysUntilExpiration, org }) => `${org.uniqueId} (${daysUntilExpiration}d)`).join(', ')}`,
          );
        }
        // Track notifications for CSV
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
      } else {
        if (shouldSkipEmail) {
          logger.info(
            `Skipping email for inactive user ${user.email} (last login: ${user.lastLoggedIn?.toISOString() || 'never'}) about ${orgs.length} org(s): ${orgs.map(({ daysUntilExpiration, org }) => `${org.uniqueId} (${daysUntilExpiration}d)`).join(', ')}`,
          );
        } else {
          logger.info(
            `Notifying user ${user.email} about ${orgs.length} org(s): ${orgs.map(({ daysUntilExpiration, org }) => `${org.uniqueId} (${daysUntilExpiration}d)`).join(', ')}`,
          );

          // Send email notification
          await sendOrgExpirationWarningEmail({
            emailAddress: user.email,
            orgs: orgs.map(({ org, daysUntilExpiration }) => ({
              username: org.username,
              organizationId: org.organizationId,
              instanceUrl: org.instanceUrl,
              daysUntilExpiration,
            })),
          });
        }
        // Create audit log entry
        await createAuditLog({
          userId,
          action: orgs.some(({ daysUntilExpiration }) => daysUntilExpiration <= 0)
            ? AuditLogAction.ORG_EXPIRED
            : AuditLogAction.ORG_EXPIRATION_WARNING,
          resource: AuditLogResource.SALESFORCE_ORG,
          metadata: {
            orgCount: orgs.length,
            orgDetails: orgs.map(({ org, daysUntilExpiration }) => ({
              orgId: org.id,
              daysUntilExpiration: daysUntilExpiration,
            })),
          },
        });
      }

      // Update counts and set next notification date
      for (const { org, daysUntilExpiration } of orgs) {
        // Map to closest threshold for counting
        if (daysUntilExpiration >= 30) {
          result.notified30Days++;
        } else if (daysUntilExpiration >= 7) {
          result.notified7Days++;
        } else if (daysUntilExpiration >= 3) {
          result.notified3Days++;
        }

        if (!testMode && org.expirationScheduledFor) {
          // Compute next notification date
          const nextNotificationDate = computeNextNotificationDate(org.expirationScheduledFor, now, NOTIFICATION_DAYS);

          await prisma.salesforceOrg.update({
            where: { id: org.id },
            data: {
              nextExpirationNotificationDate: nextNotificationDate,
              lastExpirationNotificationAt: now,
            },
          });
        }
      }
    }
  }

  // 3. Expire orgs (invalidate access tokens)
  const orgsToExpireWhere: Prisma.SalesforceOrgWhereInput = {
    expirationScheduledFor: { lte: now },
    accessToken: { not: DUMMY_ENCRYPTED_TOKEN },
    connectionError: null,
  };

  const orgsToExpire = await prisma.salesforceOrg.findMany({
    where: orgsToExpireWhere,
  });

  if (orgsToExpire.length > 0) {
    if (testMode) {
      result.expired = orgsToExpire.length;
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
          accessToken: DUMMY_ENCRYPTED_TOKEN,
          connectionError: CONNECTION_ERROR_MESSAGE,
        },
      });

      result.expired = orgsToExpire.length;
      logger.info(`Expired ${orgsToExpire.length} org credentials`);

      // Create audit log for expired orgs
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

  // In test mode, generate and email CSV summary
  if (testMode) {
    await sendTestModeSummary(testModeData, result);
  }

  return result;
}

export async function clearOrgExpiration(prisma: PrismaClient, orgId: number, userId?: string): Promise<void> {
  await prisma.salesforceOrg.update({
    where: { id: orgId },
    data: {
      lastActivityAt: new Date(),
      expirationScheduledFor: null,
      nextExpirationNotificationDate: null,
    },
  });

  if (userId) {
    await createAuditLog({
      userId,
      action: AuditLogAction.ORG_REACTIVATED,
      resource: AuditLogResource.SALESFORCE_ORG,
      resourceId: orgId.toString(),
      metadata: {
        reactivatedAt: new Date().toISOString(),
      },
    });
  }

  logger.info(`Cleared expiration for org ${orgId}`);
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
    `Scheduled for expiration: ${result.scheduled}`,
    `Notified (30 days): ${result.notified30Days}`,
    `Notified (7 days): ${result.notified7Days}`,
    `Notified (3 days): ${result.notified3Days}`,
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
