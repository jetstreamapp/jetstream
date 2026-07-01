import { logger } from '@jetstream/shared/client-logger';
import { dexieDb } from './ui-db';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ROWS_PER_ORG_AND_JOB_TYPE = 10;
const JOB_TYPES = ['permission_export', 'field_usage'] as const;

/**
 * Prune `analysis_job_history` rows that exceed the retention policy:
 *  1) drop unpinned rows older than 14 days
 *  2) for each (org, jobType), keep at most the 10 most-recent unpinned rows
 *
 * Pinned rows are always preserved. Errors are logged and swallowed so a failed sweep
 * never blocks app initialization.
 */
export async function pruneAnalysisJobHistory(): Promise<void> {
  try {
    await dexieDb.transaction('rw', dexieDb.analysis_job_history, async () => {
      const fourteenDaysAgo = new Date(Date.now() - FOURTEEN_DAYS_MS);
      await dexieDb.analysis_job_history
        .where('createdAt')
        .below(fourteenDaysAgo)
        .filter((row) => !row.pinned)
        .delete();

      const allOrgs = await dexieDb.analysis_job_history.orderBy('org').uniqueKeys();
      for (const orgKey of allOrgs) {
        const org = String(orgKey);
        for (const jobType of JOB_TYPES) {
          // sortBy returns ascending by createdAt (Dexie always re-sorts in-memory; chained reverse() is a no-op).
          // Reverse the array in JS to put newest first, then drop the first N to retain the newest N.
          const rowsAscending = await dexieDb.analysis_job_history
            .where('[org+jobType+createdAt]')
            .between([org, jobType, new Date(0)], [org, jobType, new Date(8.64e15)])
            .sortBy('createdAt');
          const rowsNewestFirst = rowsAscending.slice().reverse();

          const keysToDelete = rowsNewestFirst
            .filter((row) => !row.pinned)
            .slice(MAX_ROWS_PER_ORG_AND_JOB_TYPE)
            .map((row) => row.key);

          if (keysToDelete.length > 0) {
            await dexieDb.analysis_job_history.bulkDelete(keysToDelete);
          }
        }
      }
    });
  } catch (ex) {
    logger.warn('[DB][ANALYSIS_JOB_HISTORY][PRUNE] Failed to prune analysis_job_history', ex);
  }
}
