import { getErrorMessage } from './utils';

/**
 * Bulk API v1 errors that doom every remaining batch, not just the one that failed. Once the job is
 * gone, closed or over a limit, Salesforce rejects everything sent after it, so the caller should stop
 * submitting rather than fire one doomed request per batch.
 *
 * Salesforce words the "job is no longer accepting batches" case two different ways depending on how
 * the job got there, so both are listed.
 *
 * Reference: https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_reference_errors.htm
 */
export const FATAL_BULK_ERROR_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /ApiBatchItems Limit exceeded/i,
  /InvalidBatch/i,
  /InvalidJob/i,
  /ExceededQuota/i,
  /Job is in invalid state/i,
  /Job already (aborted|closed|completed)/i,
  // "Failed to create batch, since the Job is not Open. Current job state is 'Closed'"
  /Job is not Open/i,
]);

export function isFatalBulkApiError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return FATAL_BULK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
