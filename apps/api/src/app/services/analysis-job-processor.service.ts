import { logger } from '@jetstream/api-config';
import type { Prisma } from '@jetstream/prisma';
import { getOrgForBackgroundJob } from '../routes/route.middleware';
import { getAnalysisJobById, updateAnalysisJobById } from '../db/analysis-job.db';
import { runPermissionExportSoql } from './permission-export-query.service';

/**
 * Schedules async processing so the HTTP handler can return immediately after creating the job row.
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

    const existingResult =
      job.result && typeof job.result === 'object' && !Array.isArray(job.result) ? (job.result as Record<string, unknown>) : {};
    const payload = existingResult.requestPayload;
    const profileIds = payload && typeof payload === 'object' && 'profileIds' in payload ? payload.profileIds : undefined;
    const permissionSetIds = payload && typeof payload === 'object' && 'permissionSetIds' in payload ? payload.permissionSetIds : undefined;
    const profileIdList = Array.isArray(profileIds) ? profileIds.filter((id): id is string => typeof id === 'string') : [];
    const permissionSetIdList = Array.isArray(permissionSetIds)
      ? permissionSetIds.filter((id): id is string => typeof id === 'string')
      : [];

    const { jetstreamConn } = await getOrgForBackgroundJob({
      userId: job.userId,
      salesforceOrgUniqueId: job.salesforceOrgUniqueId,
      requestId: jobId,
    });

    const exportPayload = await runPermissionExportSoql(jetstreamConn, profileIdList, permissionSetIdList);

    const nextResult = {
      ...existingResult,
      phase: 'permission_export_v1',
      summary: `Exported ${exportPayload.counts.permissionSets} permission sets, ${exportPayload.counts.permissionSetAssignments} assignments, ${exportPayload.counts.permissionSetGroups} permission set groups (${exportPayload.counts.permissionSetGroupComponents} components, ${exportPayload.counts.mutingPermissionSets} muting permission sets), ${exportPayload.counts.objectPermissions} object permission rows, ${exportPayload.counts.fieldPermissions} field permission rows, ${exportPayload.counts.permissionSetTabSettings} tab settings (truncated=${exportPayload.truncated}).`,
      truncated: exportPayload.truncated,
      counts: exportPayload.counts,
      export: {
        permissionSets: exportPayload.permissionSets,
        permissionSetAssignments: exportPayload.permissionSetAssignments,
        permissionSetGroups: exportPayload.permissionSetGroups,
        permissionSetGroupComponents: exportPayload.permissionSetGroupComponents,
        mutingPermissionSets: exportPayload.mutingPermissionSets,
        objectPermissions: exportPayload.objectPermissions,
        fieldPermissions: exportPayload.fieldPermissions,
        permissionSetTabSettings: exportPayload.permissionSetTabSettings,
      },
    } as unknown as Prisma.InputJsonValue;

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
