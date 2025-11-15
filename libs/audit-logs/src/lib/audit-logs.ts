import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';

export enum AuditLogAction {
  ORG_REACTIVATED = 'ORG_REACTIVATED',
  ORG_EXPIRATION_WARNING = 'ORG_EXPIRATION_WARNING',
  ORG_EXPIRED = 'ORG_EXPIRED',
  ORG_CREDENTIALS_EXPIRED = 'ORG_CREDENTIALS_EXPIRED',
}

export enum AuditLogResource {
  SALESFORCE_ORG = 'salesforce_org',
}

export interface CreateAuditLogParams {
  userId?: string;
  action: AuditLogAction;
  resource: AuditLogResource;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(params: CreateAuditLogParams) {
  return await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      metadata: params.metadata as Prisma.InputJsonValue,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
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
