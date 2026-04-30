import { logger } from '@jetstream/api-config';
import type { Prisma } from '@jetstream/prisma';
import { getAnalysisJobById, updateAnalysisJobById } from '../db/analysis-job.db';

/**
 * Schedules async processing so the HTTP handler can return immediately after creating the job row.
 * v1: marks permission_export jobs completed with a scaffold summary (no Salesforce export yet).
 */
export function enqueuePermissionExportJobProcessing(jobId: string): void {
  setImmediate(() => {
    void runPermissionExportJob(jobId);
  });
}

async function runPermissionExportJob(jobId: string): Promise<void> {
  try {
    const job = await getAnalysisJobById(jobId);
    if (!job || job.jobType !== 'permission_export') {
      return;
    }
    if (job.status !== 'pending') {
      return;
    }

    await updateAnalysisJobById({ id: jobId, status: 'running' });

    await new Promise((resolve) => setTimeout(resolve, 400));

    const existingResult =
      job.result && typeof job.result === 'object' && !Array.isArray(job.result) ? (job.result as Record<string, unknown>) : {};
    const payload = existingResult.requestPayload;
    const profileIds = payload && typeof payload === 'object' && 'profileIds' in payload ? payload.profileIds : undefined;
    const permissionSetIds = payload && typeof payload === 'object' && 'permissionSetIds' in payload ? payload.permissionSetIds : undefined;
    const profileCount = Array.isArray(profileIds) ? profileIds.length : 0;
    const permissionSetCount = Array.isArray(permissionSetIds) ? permissionSetIds.length : 0;

    const nextResult: Prisma.InputJsonValue = {
      ...existingResult,
      summary: `Permission export job completed (v1 scaffold). Profiles: ${profileCount}, permission sets: ${permissionSetCount}.`,
      phase: 'v1_staging',
    };

    await updateAnalysisJobById({
      id: jobId,
      status: 'completed',
      result: nextResult,
    });
  } catch (ex) {
    logger.error({ err: ex, jobId }, 'analysis job processor failed');
    try {
      const message = ex instanceof Error ? ex.message.slice(0, 2000) : 'Unknown error';
      await updateAnalysisJobById({
        id: jobId,
        status: 'failed',
        errorMessage: message,
      });
    } catch {
      // ignore secondary failure
    }
  }
}
