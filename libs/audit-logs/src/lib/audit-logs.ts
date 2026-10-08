import { logger, prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';

export enum AuditLogAction {
  // Org actions
  ORG_ADDED = 'ORG_ADDED',
  ORG_DELETED = 'ORG_DELETED',
  ORG_TOKEN_REFRESHED = 'ORG_TOKEN_REFRESHED',
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

  // Purchased seats
  TEAM_SEATS_UPDATED = 'TEAM_SEATS_UPDATED',
  TEAM_SEATS_DECREASE_SCHEDULED = 'TEAM_SEATS_DECREASE_SCHEDULED',
  TEAM_SEATS_DECREASE_CANCELLED = 'TEAM_SEATS_DECREASE_CANCELLED',
  TEAM_SEATS_DECREASE_APPLIED = 'TEAM_SEATS_DECREASE_APPLIED',
  TEAM_SEATS_BACKFILLED = 'TEAM_SEATS_BACKFILLED',
  TEAM_MEMBER_ADD_BLOCKED_NO_SEATS = 'TEAM_MEMBER_ADD_BLOCKED_NO_SEATS',
  TEAM_MEMBER_ADD_BLOCKED_PAST_DUE = 'TEAM_MEMBER_ADD_BLOCKED_PAST_DUE',

  // SSO configuration
  SSO_SAML_CONFIG_CREATED = 'SSO_SAML_CONFIG_CREATED',
  SSO_SAML_CONFIG_UPDATED = 'SSO_SAML_CONFIG_UPDATED',
  SSO_SAML_CONFIG_DELETED = 'SSO_SAML_CONFIG_DELETED',
  SSO_OIDC_CONFIG_CREATED = 'SSO_OIDC_CONFIG_CREATED',
  SSO_OIDC_CONFIG_UPDATED = 'SSO_OIDC_CONFIG_UPDATED',
  SSO_OIDC_CONFIG_DELETED = 'SSO_OIDC_CONFIG_DELETED',
  SSO_SETTINGS_UPDATED = 'SSO_SETTINGS_UPDATED',
  SSO_CERT_EXPIRATION_WARNING = 'SSO_CERT_EXPIRATION_WARNING',
  SSO_CERT_EXPIRED = 'SSO_CERT_EXPIRED',

  // Domain verification
  DOMAIN_VERIFICATION_ADDED = 'DOMAIN_VERIFICATION_ADDED',
  DOMAIN_VERIFIED = 'DOMAIN_VERIFIED',
  DOMAIN_DELETED = 'DOMAIN_DELETED',

  // Salesforce Canvas app authorization
  CANVAS_ORG_AUTHORIZED = 'CANVAS_ORG_AUTHORIZED',
  CANVAS_ORG_DELETED = 'CANVAS_ORG_DELETED',
}

export enum AuditLogResource {
  SALESFORCE_ORG = 'salesforce_org',
  TEAM = 'team',
  TEAM_LOGIN_CONFIG = 'login_config',
  TEAM_MEMBER = 'team_member',
  TEAM_INVITATION = 'team_invitation',
  TEAM_SEATS = 'team_seats',
  TEAM_SSO_CONFIG = 'sso_config',
  TEAM_DOMAIN_VERIFICATION = 'domain_verification',
  SALESFORCE_CANVAS_ORG = 'salesforce_canvas_org',
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

/**
 * Column widths from the AuditLog model. The request-derived values are written as received, and a
 * client can send a User-Agent (or an id) longer than its column: without this cap the insert fails
 * and the action it should have recorded leaves no trail at all.
 */
const AUDIT_LOG_COLUMN_LIMITS = {
  resourceId: 255,
  ipAddress: 45,
  userAgent: 500,
} as const;

function fitToColumn(value: string | undefined, maxLength: number): string | undefined {
  if (!value || value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

export async function createAuditLog(params: CreateAuditLogParams) {
  return await prisma.auditLog.create({
    data: {
      userId: params.userId,
      teamId: params.teamId,
      action: params.action,
      resource: params.resource,
      resourceId: fitToColumn(params.resourceId, AUDIT_LOG_COLUMN_LIMITS.resourceId),
      metadata: params.metadata as Prisma.InputJsonValue,
      ipAddress: fitToColumn(params.ipAddress, AUDIT_LOG_COLUMN_LIMITS.ipAddress),
      userAgent: fitToColumn(params.userAgent, AUDIT_LOG_COLUMN_LIMITS.userAgent),
    },
  });
}

/**
 * Fire-and-forget audit log helper for team-scoped actions.
 * Never throws so a logging failure cannot affect the request, but a failed write is logged at error
 * level: an audit entry that silently never lands is exactly what an attacker covering their tracks wants.
 */
export function createTeamAuditLog(params: Omit<CreateAuditLogParams, 'teamId'> & { teamId: string }) {
  createAuditLog(params).catch((ex) => {
    logger.error(
      { ...getErrorMessageAndStackObj(ex), teamId: params.teamId, userId: params.userId, action: params.action, resource: params.resource },
      '[AUDIT_LOG] Failed to write team audit log entry',
    );
  });
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
