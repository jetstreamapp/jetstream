import { logger } from '@jetstream/api-config';
import type { Prisma } from '@jetstream/prisma';
import { getOrgForBackgroundJob } from '../routes/route.middleware';
import { getAnalysisJobById, updateAnalysisJobById } from '../db/analysis-job.db';
import { buildIssueCodeSummary, buildPermissionExportFindings } from '../lib/permission-export/build-permission-export-findings';
import { FIELD_USAGE_MAX_ROWS_PER_OBJECT, runFieldUsageQueryForObjects } from './field-usage-query.service';
import { computeFieldUsageWhereUsed } from './field-usage-where-used.service';
import { runPermissionExportSoql } from './permission-export-query.service';

/**
 * Schedules async processing so the HTTP handler can return immediately after creating the job row.
 */
export function enqueuePermissionExportJobProcessing(jobId: string): void {
  setImmediate(() => {
    void runPermissionExportJob(jobId);
  });
}

export function enqueueFieldUsageJobProcessing(jobId: string): void {
  setImmediate(() => {
    void runFieldUsageJob(jobId);
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
    const objectApiNames = payload && typeof payload === 'object' && 'objectApiNames' in payload ? payload.objectApiNames : undefined;

    const { jetstreamConn } = await getOrgForBackgroundJob({
      userId: job.userId,
      salesforceOrgUniqueId: job.salesforceOrgUniqueId,
      requestId: jobId,
    });

    const exportPayload = await runPermissionExportSoql(jetstreamConn, profileIdList, permissionSetIdList, {
      objectApiNames,
    });

    const findings = buildPermissionExportFindings(exportPayload.objectPermissions, exportPayload.fieldPermissions);
    const issueCodeSummary = buildIssueCodeSummary(findings);

    const nextResult = {
      ...existingResult,
      phase: 'permission_export_v1',
      summary: `Exported ${exportPayload.counts.permissionSets} permission sets, ${exportPayload.counts.permissionSetAssignments} assignments, ${exportPayload.counts.permissionSetGroups} permission set groups (${exportPayload.counts.permissionSetGroupComponents} components, ${exportPayload.counts.mutingPermissionSets} muting permission sets), ${exportPayload.counts.objectPermissions} object permission rows, ${exportPayload.counts.fieldPermissions} field permission rows, ${exportPayload.counts.permissionSetTabSettings} tab settings (truncated=${exportPayload.truncated}). ${findings.length} issue(s).`,
      truncated: exportPayload.truncated,
      counts: exportPayload.counts,
      findings,
      issueCodeSummary,
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

async function runFieldUsageJob(jobId: string): Promise<void> {
  try {
    const job = await getAnalysisJobById(jobId);
    if (!job || job.jobType !== 'field_usage') {
      return;
    }
    if (job.status !== 'pending') {
      return;
    }

    await updateAnalysisJobById({ id: jobId, status: 'running' });

    const existingResult =
      job.result && typeof job.result === 'object' && !Array.isArray(job.result) ? (job.result as Record<string, unknown>) : {};
    const payload = existingResult.requestPayload;
    const rawNames =
      payload && typeof payload === 'object' && 'objectApiNames' in payload
        ? (payload as { objectApiNames?: unknown }).objectApiNames
        : undefined;
    const objectApiNames = Array.isArray(rawNames) ? rawNames.filter((n): n is string => typeof n === 'string' && n.trim().length > 0) : [];
    const loadFullScan: boolean =
      payload != null && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>).loadFullScan === true
        : false;

    if (objectApiNames.length === 0) {
      await updateAnalysisJobById({
        id: jobId,
        status: 'failed',
        errorMessage: 'field_usage job requires requestPayload.objectApiNames (non-empty string array).',
      });
      return;
    }

    const { jetstreamConn } = await getOrgForBackgroundJob({
      userId: job.userId,
      salesforceOrgUniqueId: job.salesforceOrgUniqueId,
      requestId: jobId,
    });

    const queryOutcome = await runFieldUsageQueryForObjects(jetstreamConn, objectApiNames, { loadFullScan });
    let whereUsed: Record<string, unknown> = {};
    try {
      whereUsed = (await computeFieldUsageWhereUsed(jetstreamConn, queryOutcome.objects)) as unknown as Record<string, unknown>;
    } catch (wuEx) {
      logger.warn({ err: wuEx, jobId }, 'field usage where-used failed; continuing without map');
      whereUsed = {};
    }

    const okCount = objectApiNames.filter((o) => !queryOutcome.failedObjects.includes(o) && !queryOutcome.objects[o]?.error).length;
    const summaryParts = [
      `Field Usage for ${okCount}/${objectApiNames.length} Object(s).${loadFullScan ? ' No per-object row cap.' : ''}`,
      queryOutcome.anyQueryTruncated
        ? loadFullScan
          ? 'Some objects may still show truncated scans for very large data sets or API limits.'
          : `Row scan capped at ${String(FIELD_USAGE_MAX_ROWS_PER_OBJECT)} rows per Object where noted.`
        : '',
      queryOutcome.failedObjects.length > 0 ? `Failed: ${queryOutcome.failedObjects.join(', ')}.` : '',
    ].filter(Boolean);

    const nextResult = {
      ...existingResult,
      phase: 'field_usage_v1',
      summary: summaryParts.join(' '),
      truncated: queryOutcome.anyQueryTruncated,
      objects: queryOutcome.objects,
      whereUsed,
      failedObjects: queryOutcome.failedObjects,
    } as unknown as Prisma.InputJsonValue;

    await updateAnalysisJobById({
      id: jobId,
      status: 'completed',
      result: nextResult,
    });
  } catch (ex) {
    logger.error({ err: ex, jobId }, 'field usage analysis job processor failed');
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
