import type { AnalysisJobType, AsyncJob, AsyncJobProgress } from '@jetstream/types';
import { atom } from 'jotai';

export interface AnalysisJobRuntimeState {
  /** AsyncJob.id from the global jobs system, links runtime state to the Jobs popover entry. */
  jobId: string;
  /** Dexie row key that will receive the final result. Same as job.meta.jobHistoryKey. */
  jobHistoryKey: string;
  /** Most recent progress event from the job runner. */
  progress: AsyncJobProgress | null;
  /** When the job was kicked off, used for elapsed-time display. */
  startedAt: Date;
}

/**
 * Keyed by `${orgUniqueId}:${jobType}` so the views can subscribe to the matching in-flight job
 * without scanning the global jobsState. Concurrency rule: one job per (org, jobType).
 */
export const analysisJobRuntimeStateAtom = atom<Record<string, AnalysisJobRuntimeState>>({});

export function analysisJobRuntimeStateKey(orgUniqueId: string, jobType: AnalysisJobType): string {
  return `${orgUniqueId}:${jobType}`;
}

/**
 * Returns true if the global jobs map currently holds an in-flight analysis job of the given type
 * for the given org. Used by selection screens to block double-enqueue.
 */
export function isAnalysisJobActive(
  jobs: Record<string, AsyncJob<unknown>>,
  orgUniqueId: string,
  jobType: AnalysisJobType,
): boolean {
  return Object.values(jobs).some((job) => {
    if (!job) {
      return false;
    }
    const matchesType =
      (jobType === 'permission_export' && job.type === 'PermissionExportAnalysis') ||
      (jobType === 'field_usage' && job.type === 'FieldUsageAnalysis');
    if (!matchesType) {
      return false;
    }
    const inFlight = job.status === 'pending' || job.status === 'in-progress';
    if (!inFlight) {
      return false;
    }
    const meta = job.meta as { orgUniqueId?: string } | undefined;
    return meta?.orgUniqueId === orgUniqueId;
  });
}
