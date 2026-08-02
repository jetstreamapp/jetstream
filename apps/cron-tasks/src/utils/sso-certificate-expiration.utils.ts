import { AuditLogAction, AuditLogResource, createAuditLog } from '@jetstream/audit-logs';
import { sendSsoCertificateExpirationEmail } from '@jetstream/email';
import { PrismaClient } from '@jetstream/prisma';
import {
  computeNextCertNotificationDate,
  getDaysUntilCertExpiration,
  getErrorMessageAndStackObj,
  pluralizeFromNumber,
} from '@jetstream/shared/utils';
import { TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_STATUS_ACTIVE, TeamStatusSchema } from '@jetstream/types';
import { endOfDay } from 'date-fns';
import { logger } from '../config/logger.config';

export interface SsoCertificateExpirationResult {
  /** In test mode every count is what the run *would* have done — nothing was sent or written. */
  testMode: boolean;
  configurationsDue: number;
  teamsNotified: number;
  emailsSent: number;
  teamsWithoutRecipients: number;
  failures: number;
}

/** `daysUntilExpiration` goes negative once the certificate has expired, which reads badly inline. */
function describeExpiration(daysUntilExpiration: number) {
  if (daysUntilExpiration === 0) {
    return 'expires today';
  }
  if (daysUntilExpiration < 0) {
    const daysSinceExpiration = Math.abs(daysUntilExpiration);
    return `expired ${daysSinceExpiration} ${pluralizeFromNumber('day', daysSinceExpiration)} ago`;
  }
  return `expires in ${daysUntilExpiration} ${pluralizeFromNumber('day', daysUntilExpiration)}`;
}

/**
 * Email team admins when their SAML IdP signing certificate is approaching (or past) expiration.
 *
 * Only SAML is covered: OIDC resolves signing keys from the provider's JWKS endpoint on every login,
 * so provider key rotation is picked up automatically and there is nothing to expire on our side.
 *
 * Note that an expired certificate does not itself break logins — neither node-saml nor xml-crypto
 * checks notAfter, they only use the embedded public key. The outage happens when the IdP rotates to
 * a new certificate and the one stored in Jetstream stops matching the assertion signature. That is
 * why reminders continue up to and including the expiration date rather than stopping short of it.
 */
export async function manageSsoCertificateExpiration(
  prisma: PrismaClient,
  initialDate = new Date(),
): Promise<SsoCertificateExpirationResult> {
  const now = endOfDay(initialDate);
  const testMode = process.env.TEST_MODE === 'true';

  const result: SsoCertificateExpirationResult = {
    testMode,
    configurationsDue: 0,
    teamsNotified: 0,
    emailsSent: 0,
    teamsWithoutRecipients: 0,
    failures: 0,
  };

  if (testMode) {
    logger.info('Running in TEST MODE - no emails will be sent and no updates will be made');
  }

  // nextCertNotificationDate is seeded when the certificate is saved and advanced after each send;
  // null means every reminder has been delivered, which takes the configuration out of this query.
  const configurationsDue = await prisma.samlConfiguration.findMany({
    where: {
      idpCertificateExpiresAt: { not: null },
      nextCertNotificationDate: { not: null, lte: now },
    },
    select: {
      id: true,
      idpEntityId: true,
      idpCertificateExpiresAt: true,
      loginConfiguration: {
        select: {
          ssoEnabled: true,
          team: {
            select: {
              id: true,
              name: true,
              status: true,
              members: {
                where: { role: TEAM_MEMBER_ROLE_ADMIN, status: TEAM_MEMBER_STATUS_ACTIVE },
                select: { user: { select: { id: true, email: true } } },
              },
            },
          },
        },
      },
    },
  });

  result.configurationsDue = configurationsDue.length;
  logger.info(`Found ${configurationsDue.length} SAML configuration(s) due for a certificate expiration notification`);

  for (const config of configurationsDue) {
    const { idpCertificateExpiresAt, idpEntityId, id: samlConfigId } = config;
    const team = config.loginConfiguration.team;

    // A SamlConfiguration always hangs off a LoginConfiguration, but the team relation is optional in
    // the schema — skip rather than crash the whole run on an orphaned configuration.
    if (!team || !idpCertificateExpiresAt) {
      logger.warn({ samlConfigId }, 'Skipping SAML configuration with no team or expiration date');
      continue;
    }

    const daysUntilExpiration = getDaysUntilCertExpiration(idpCertificateExpiresAt, now);
    const nextNotificationDate = computeNextCertNotificationDate(idpCertificateExpiresAt, now);
    const admins = team.members.map(({ user }) => user);

    // Inactive teams and teams with SSO turned off keep their schedule advanced (so they don't pile
    // up as permanently-due work) but are not emailed — nothing is breaking for them today.
    if (team.status !== TeamStatusSchema.enum.ACTIVE || !config.loginConfiguration.ssoEnabled) {
      logger.info(
        { teamId: team.id, samlConfigId, teamStatus: team.status, ssoEnabled: config.loginConfiguration.ssoEnabled },
        'Skipping notification for inactive team or disabled SSO',
      );
      if (!testMode) {
        await advanceSchedule(prisma, samlConfigId, nextNotificationDate);
      }
      continue;
    }

    if (admins.length === 0) {
      result.teamsWithoutRecipients++;
      logger.warn({ teamId: team.id, samlConfigId }, 'No active admins to notify about expiring SSO certificate');
      if (!testMode) {
        await advanceSchedule(prisma, samlConfigId, nextNotificationDate);
      }
      continue;
    }

    if (testMode) {
      logger.info(
        `[TEST MODE] Would notify ${admins.length} admin(s) for team ${team.name} (${team.id}) that the SSO certificate ${describeExpiration(daysUntilExpiration)}: ${admins.map(({ email }) => email).join(', ')}`,
      );
      result.teamsNotified++;
      result.emailsSent += admins.length;
      continue;
    }

    // Send to every admin before touching the schedule. If any send fails the schedule is left alone
    // so the next run retries — duplicate emails to the admins that did receive one are a far better
    // failure mode than silently skipping a threshold on an imminent SSO outage.
    const sendResults = await Promise.allSettled(
      admins.map(({ email }) =>
        sendSsoCertificateExpirationEmail({
          emailAddress: email,
          teamName: team.name,
          idpEntityId,
          expiresAt: idpCertificateExpiresAt,
          daysUntilExpiration,
        }),
      ),
    );

    const failed = sendResults.filter((sendResult) => sendResult.status === 'rejected');
    result.emailsSent += sendResults.length - failed.length;

    if (failed.length > 0) {
      result.failures++;
      failed.forEach((sendResult) => {
        logger.error(
          { ...getErrorMessageAndStackObj((sendResult as PromiseRejectedResult).reason), teamId: team.id, samlConfigId },
          'Failed to send SSO certificate expiration email',
        );
      });
      logger.warn({ teamId: team.id, samlConfigId }, 'Leaving notification schedule unchanged so the next run retries');
      continue;
    }

    result.teamsNotified++;
    logger.info(
      `Notified ${admins.length} admin(s) for team ${team.name} (${team.id}) — certificate ${describeExpiration(daysUntilExpiration)}`,
    );

    await advanceSchedule(prisma, samlConfigId, nextNotificationDate, now);

    // Awaited (rather than the fire-and-forget createTeamAuditLog) because the cron calls
    // process.exit as soon as this resolves, which would drop an in-flight insert.
    await createAuditLog({
      teamId: team.id,
      // The expiration date itself (0) is still a warning — the certificate does not become expired
      // until the date has passed, which is when `daysUntilExpiration` goes negative.
      action: daysUntilExpiration < 0 ? AuditLogAction.SSO_CERT_EXPIRED : AuditLogAction.SSO_CERT_EXPIRATION_WARNING,
      resource: AuditLogResource.TEAM_SSO_CONFIG,
      resourceId: samlConfigId,
      metadata: {
        idpEntityId,
        expiresAt: idpCertificateExpiresAt.toISOString(),
        daysUntilExpiration,
        notifiedAdminCount: admins.length,
        notifiedEmails: admins.map(({ email }) => email),
      },
    });
  }

  return result;
}

/**
 * Move a configuration to its next threshold. `notifiedAt` is only passed when an email actually went
 * out — teams that were skipped (inactive, SSO disabled, no admins) still advance so they don't stay
 * permanently due, but leaving lastCertNotificationAt untouched keeps it an honest record of sends.
 */
function advanceSchedule(prisma: PrismaClient, samlConfigId: string, nextNotificationDate: Date | null, notifiedAt?: Date) {
  return prisma.samlConfiguration.update({
    where: { id: samlConfigId },
    data: {
      nextCertNotificationDate: nextNotificationDate,
      ...(notifiedAt ? { lastCertNotificationAt: notifiedAt } : {}),
    },
  });
}
