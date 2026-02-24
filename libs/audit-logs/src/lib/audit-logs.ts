import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import { NOOP } from '@jetstream/shared/utils';

export enum AuditLogAction {
  // Org actions
  ORG_REACTIVATED = 'ORG_REACTIVATED',
  ORG_EXPIRATION_WARNING = 'ORG_EXPIRATION_WARNING',
  ORG_EXPIRED = 'ORG_EXPIRED',
  ORG_CREDENTIALS_EXPIRED = 'ORG_CREDENTIALS_EXPIRED',

  // Team management
  TEAM_UPDATED = 'TEAM_UPDATED',
  LOGIN_CONFIG_UPDATED = 'LOGIN_CONFIG_UPDATED',

  // Team members
  TEAM_MEMBER_ROLE_UPDATED = 'TEAM_MEMBER_ROLE_UPDATED',
  TEAM_MEMBER_STATUS_UPDATED = 'TEAM_MEMBER_STATUS_UPDATED',
  TEAM_SESSION_REVOKED = 'TEAM_SESSION_REVOKED',

  // Invitations
  TEAM_INVITATION_CREATED = 'TEAM_INVITATION_CREATED',
  TEAM_INVITATION_RESENT = 'TEAM_INVITATION_RESENT',
  TEAM_INVITATION_CANCELLED = 'TEAM_INVITATION_CANCELLED',
  TEAM_INVITATION_ACCEPTED = 'TEAM_INVITATION_ACCEPTED',

  // SSO configuration
  SSO_SAML_CONFIG_CREATED = 'SSO_SAML_CONFIG_CREATED',
  SSO_SAML_CONFIG_UPDATED = 'SSO_SAML_CONFIG_UPDATED',
  SSO_SAML_CONFIG_DELETED = 'SSO_SAML_CONFIG_DELETED',
  SSO_OIDC_CONFIG_CREATED = 'SSO_OIDC_CONFIG_CREATED',
  SSO_OIDC_CONFIG_UPDATED = 'SSO_OIDC_CONFIG_UPDATED',
  SSO_OIDC_CONFIG_DELETED = 'SSO_OIDC_CONFIG_DELETED',
  SSO_SETTINGS_UPDATED = 'SSO_SETTINGS_UPDATED',

  // Domain verification
  DOMAIN_VERIFICATION_ADDED = 'DOMAIN_VERIFICATION_ADDED',
  DOMAIN_VERIFIED = 'DOMAIN_VERIFIED',
  DOMAIN_DELETED = 'DOMAIN_DELETED',
}

export enum AuditLogResource {
  SALESFORCE_ORG = 'salesforce_org',
  TEAM = 'team',
  TEAM_LOGIN_CONFIG = 'login_config',
  TEAM_MEMBER = 'team_member',
  TEAM_INVITATION = 'team_invitation',
  TEAM_SSO_CONFIG = 'sso_config',
  TEAM_DOMAIN_VERIFICATION = 'domain_verification',
}

export interface CreateAuditLogParams {
  userId?: string;
  teamId?: string;
  action: AuditLogAction;
  resource: AuditLogResource;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: CreateAuditLogParams) {
  return await prisma.auditLog.create({
    data: {
      userId: params.userId,
      teamId: params.teamId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      metadata: params.metadata as Prisma.InputJsonValue,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}

/**
 * Fire-and-forget audit log helper for team-scoped actions.
 * Never throws — errors are silently swallowed so a logging failure cannot affect the request.
 */
export function createTeamAuditLog(params: Omit<CreateAuditLogParams, 'teamId'> & { teamId: string }) {
  createAuditLog(params).catch(NOOP);
}

export async function getAuditLogsByUser(userId: string, limit = 100) {
  return await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getAuditLogsByResource(resource: AuditLogResource, resourceId: string, limit = 100) {
  return await prisma.auditLog.findMany({
    where: { resource, resourceId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getAuditLogsByAction(action: AuditLogAction, limit = 100) {
  return await prisma.auditLog.findMany({
    where: { action },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export const AUDIT_LOG_PAGE_SIZE = 25;
export const AUDIT_LOG_PAGE_SIZE_MAX = 100;

export async function getTeamAuditLogs({
  teamId,
  limit,
  cursor,
  startDate,
  endDate,
}: {
  teamId: string;
  limit?: number;
  cursor?: { id: string };
  startDate?: Date;
  endDate?: Date;
}) {
  const take = Math.min(Math.max(limit ?? AUDIT_LOG_PAGE_SIZE, 1), AUDIT_LOG_PAGE_SIZE_MAX);

  const records = await prisma.auditLog.findMany({
    where: {
      teamId,
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    cursor: cursor ? { id: cursor.id } : undefined,
    take: take + 1, // fetch one extra to detect hasMore
    skip: cursor ? 1 : 0,
    orderBy: [{ createdAt: 'desc' }],
  });

  const hasMore = records.length > take;
  return {
    records: records.slice(0, take),
    hasMore,
    nextCursor: hasMore ? records[take - 1].id : null,
  };
}

const AUDIT_LOG_EXPORT_MAX_RECORDS = 10_000;

export async function getTeamAuditLogsForExport({ teamId, startDate, endDate }: { teamId: string; startDate: Date; endDate: Date }) {
  return prisma.auditLog.findMany({
    where: { teamId, createdAt: { gte: startDate, lte: endDate } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ createdAt: 'desc' }],
    take: AUDIT_LOG_EXPORT_MAX_RECORDS,
  });
}
