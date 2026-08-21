import { DataHistoryStorageBackend } from '@jetstream/types';

/**
 * Where a swallowed failure happened. A closed set rather than a free-form string so the error
 * tracker groups by the code path instead of by whatever message the underlying storage API used.
 */
export type DataHistoryFailureOperation = 'init' | 'start-entry' | 'capture-step' | 'finalize';

export interface DataHistoryFailureInfo {
  operation: DataHistoryFailureOperation;
  error: unknown;
  entryKey?: string;
  backend?: DataHistoryStorageBackend;
}

export type DataHistoryFailureReporter = (info: DataHistoryFailureInfo) => void;

/**
 * Diagnostic context attached to an Error so it survives the trip to the error tracker. `logger.warn`
 * is a no-op unless the user turns logging on, and the reported Error is the only thing that reaches
 * the reporter — so anything a failure needs to be diagnosable has to ride on the Error itself. The
 * host app forwards these alongside the operation context (see `useInitDataHistory`).
 */
export type DataHistoryErrorDetails = Record<string, string | number | boolean | undefined>;

const ERROR_DETAILS_KEY = 'dataHistoryErrorDetails';

export function withDataHistoryErrorDetails<TError extends Error>(error: TError, details: DataHistoryErrorDetails): TError {
  return Object.assign(error, { [ERROR_DETAILS_KEY]: details });
}

export function getDataHistoryErrorDetails(error: unknown): DataHistoryErrorDetails | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const details = (error as Record<string, unknown>)[ERROR_DETAILS_KEY];
  return typeof details === 'object' && details !== null ? (details as DataHistoryErrorDetails) : undefined;
}

/**
 * Conditions where the environment said no rather than Jetstream being broken: the user revoked or
 * denied folder access, a picker ran outside a user gesture, or a stream was aborted because the
 * user cancelled or the backend switched. Every one of these has a UI affordance already and is
 * expected in normal use, so reporting them would bury the defects worth investigating.
 *
 * Names are matched instead of types because the FSA and OPFS APIs reject with `DOMException`,
 * which is not reliably `instanceof Error` across engines.
 */
const IGNORED_ERROR_NAMES = new Set([
  'DataHistoryDirectoryPermissionError',
  'NotAllowedError',
  'NotFoundError',
  'SecurityError',
  'AbortError',
]);

let reporter: DataHistoryFailureReporter | null = null;

/**
 * Give data history somewhere to send failures it had to swallow. Injected rather than imported
 * because the error tracker lives in `@jetstream/shared/ui-utils`, which pulls in Sentry — this lib
 * keeps its import graph small enough for the browser extension (see `platform.ts`).
 *
 * Pass null to unset (tests, teardown).
 */
export function setDataHistoryFailureReporter(value: DataHistoryFailureReporter | null): void {
  reporter = value;
}

function isExpectedCondition(error: unknown): boolean {
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined;
  return typeof name === 'string' && IGNORED_ERROR_NAMES.has(name);
}

/**
 * Capture failures are swallowed so they can never break the user's data operation, which also makes
 * them invisible: `logger.warn` is a no-op unless the user turns logging on, so a systemic failure
 * (an exhausted quota, a backend broken on one platform) otherwise surfaces only as a support ticket.
 *
 * Only unexpected failures are reported — see `IGNORED_ERROR_NAMES`. Reporting must never throw:
 * this is called from catch blocks whose whole purpose is to not fail.
 */
export function reportDataHistoryFailure(info: DataHistoryFailureInfo): void {
  if (!reporter || isExpectedCondition(info.error)) {
    return;
  }
  try {
    reporter(info);
  } catch {
    // A broken reporter cannot be allowed to break capture
  }
}
