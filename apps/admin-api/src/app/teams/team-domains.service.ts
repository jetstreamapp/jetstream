import { AdminSessionUser, TeamDomainItem } from '@jetstream/admin/types';
import { prisma } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createAuditLog } from '@jetstream/audit-logs';
import { lockTeamLoginConfiguration } from '@jetstream/auth/server';
import { BLOCKED_PUBLIC_EMAIL_DOMAINS } from '@jetstream/shared/constants';
import { randomBytes } from 'node:crypto';
import { AdminHttpError, ConflictError, NotFoundError, RequestMetadata } from '../utils/route.utils';

const DOMAIN_STATUS_VERIFIED = 'VERIFIED';
/** Same format the main API writes, so a record created here looks like any other */
const VERIFICATION_CODE_PREFIX = 'jetstream-verification=';

/**
 * Marks a domain as verified for a team without the DNS check, the same end state the main API reaches when
 * a team admin verifies through DNS. Approves a pending record the team already added, or creates one.
 * The team's login configuration lists its verified domains, which SSO and domain auto-join rely on.
 */
export async function approveTeamDomain(
  teamId: string,
  domain: string,
  admin: AdminSessionUser,
  requestMetadata: RequestMetadata,
): Promise<TeamDomainItem> {
  if (BLOCKED_PUBLIC_EMAIL_DOMAINS.has(domain)) {
    throw new AdminHttpError(400, `${domain} is a public email provider and cannot belong to a team`);
  }

  const { verification, previousStatus } = await prisma.$transaction(async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) {
      throw new NotFoundError(`Team ${teamId} not found`);
    }
    await lockTeamLoginConfiguration(tx, teamId);

    // DomainVerification.domain is unique across all teams
    const existing = await tx.domainVerification.findUnique({
      where: { domain },
      select: { id: true, teamId: true, status: true, team: { select: { name: true } } },
    });
    if (existing && existing.teamId !== teamId) {
      throw new ConflictError(`${domain} is already claimed by the team "${existing.team.name}" (${existing.teamId})`);
    }

    const verifiedAt = new Date();
    const verification = existing
      ? await tx.domainVerification.update({
          where: { id: existing.id },
          data: { status: DOMAIN_STATUS_VERIFIED, verifiedAt },
        })
      : await tx.domainVerification.create({
          data: {
            teamId,
            domain,
            status: DOMAIN_STATUS_VERIFIED,
            verifiedAt,
            verificationCode: `${VERIFICATION_CODE_PREFIX}${randomBytes(16).toString('hex')}`,
          },
        });

    const verifiedDomains = await tx.domainVerification.findMany({
      where: { teamId, status: DOMAIN_STATUS_VERIFIED },
      select: { domain: true },
    });
    await tx.loginConfiguration.update({
      where: { teamId },
      data: { domains: verifiedDomains.map(({ domain }) => domain) },
    });

    return { verification, previousStatus: existing?.status ?? null };
  });

  await createAuditLog({
    action: AuditLogAction.ADMIN_TEAM_DOMAIN_APPROVED,
    resource: AuditLogResource.TEAM,
    resourceId: teamId,
    metadata: { adminEmail: admin.email, domain, domainVerificationId: verification.id, previousStatus },
    ...requestMetadata,
  });

  return {
    id: verification.id,
    domain: verification.domain,
    status: verification.status,
    verifiedAt: verification.verifiedAt?.toISOString() ?? null,
    createdAt: verification.createdAt.toISOString(),
  };
}
