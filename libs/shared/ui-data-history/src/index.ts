/**
 * Public surface of `@jetstream/ui/data-history`. Deliberately NARROW: the capture/read service, the
 * backend-management flows, and the bulk-results appender are the feature's API; everything under
 * `file-store/` (the stores, the factory, path/scope helpers) and the retention sweep are internals
 * whose invariants `activateBackend()` and the service enforce. Exposing them would put every way of
 * switching backends or sweeping entries without those guards one import away.
 */
export * from './lib/data-history-backends';
export * from './lib/data-history-bulk-results';
export * from './lib/data-history.service';
// Lets the host app point swallowed capture failures at its error tracker (this lib cannot import
// one — see `failure-reporter.ts`)
export {
  getDataHistoryErrorDetails,
  setDataHistoryFailureReporter,
  type DataHistoryErrorDetails,
  type DataHistoryFailureInfo,
  type DataHistoryFailureOperation,
  type DataHistoryFailureReporter,
} from './lib/failure-reporter';
// The only internals consumers legitimately need: the test seam on the real factory, the cross-document
// "backend changed elsewhere" subscription, the "is storage bound to a user yet" gate, and the error
// type read paths surface to the UI
export { setHistoryFileStoreForTests, subscribeToHistoryBackendChanges } from './lib/file-store/file-store-factory';
export { DataHistoryDirectoryPermissionError } from './lib/file-store/fsa-types';
export { whenDataHistoryUserScopeReady } from './lib/file-store/user-scope';
