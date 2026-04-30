import { prisma } from '@jetstream/api-config';
import type { Prisma } from '@jetstream/prisma';

export type AnalysisJobType = 'permission_export' | 'field_usage';

export async function createAnalysisJob(params: {
  userId: string;
  salesforceOrgUniqueId: string;
  jobType: AnalysisJobType;
  initialResult?: Prisma.InputJsonValue;
}) {
  return prisma.analysisJob.create({
    data: {
      userId: params.userId,
      salesforceOrgUniqueId: params.salesforceOrgUniqueId,
      jobType: params.jobType,
      status: 'pending',
      ...(params.initialResult !== undefined ? { result: params.initialResult } : {}),
    },
  });
}

export async function getAnalysisJobForUser(params: { id: string; userId: string }) {
  return prisma.analysisJob.findFirst({
    where: { id: params.id, userId: params.userId },
  });
}

export async function listAnalysisJobsForUserOrg(params: { userId: string; salesforceOrgUniqueId: string; take: number }) {
  return prisma.analysisJob.findMany({
    where: { userId: params.userId, salesforceOrgUniqueId: params.salesforceOrgUniqueId },
    orderBy: { createdAt: 'desc' },
    take: params.take,
  });
}

export async function getAnalysisJobById(id: string) {
  return prisma.analysisJob.findUnique({
    where: { id },
  });
}

export async function updateAnalysisJobById(params: {
  id: string;
  status?: string;
  result?: Prisma.InputJsonValue;
  errorMessage?: string | null;
}) {
  return prisma.analysisJob.update({
    where: { id: params.id },
    data: {
      ...(params.status !== undefined ? { status: params.status } : {}),
      ...(params.result !== undefined ? { result: params.result } : {}),
      ...(params.errorMessage !== undefined ? { errorMessage: params.errorMessage } : {}),
    },
  });
}
