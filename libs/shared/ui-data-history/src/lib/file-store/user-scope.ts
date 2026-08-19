import { getUserScopeDirName } from './hashed-dir-names';

/**
 * The authenticated user every file store is currently rooted under.
 *
 * Data History keeps its index in the per-user Dexie database but its payloads on a filesystem that
 * has no concept of a Jetstream account (per-origin OPFS, a per-install desktop folder, a
 * user-chosen directory). This module is what carries the account identity across that gap: it is
 * set when history initializes for a signed-in user and cleared on logout, and every backend roots
 * its tree at {@link getUserScopeDir}.
 *
 * Reads FAIL rather than falling back to an unscoped root: a silent fallback is exactly the
 * pre-scoping behavior and would be invisible, mixing one account's payloads into the shared tree
 * while its index rows point at scoped paths.
 */

let scopedUserId: string | null = null;
let scopeDirPromise: Promise<string> | null = null;
let scopeReadyResolvers: Array<() => void> = [];

/**
 * Bind file storage to a user. Idempotent for the same id; a different id re-scopes (callers must
 * drop cached stores — `setDataHistoryUserScope` is always paired with `resetHistoryFileStores`).
 */
export function setDataHistoryUserScope(userId: string): void {
  if (!userId) {
    throw new Error('A user id is required to scope data history storage');
  }
  if (scopedUserId === userId) {
    return;
  }
  scopedUserId = userId;
  scopeDirPromise = getUserScopeDirName(userId);
  // Never leave a rejected promise cached — the next call should be able to retry
  scopeDirPromise.catch(() => {
    if (scopedUserId === userId) {
      scopedUserId = null;
      scopeDirPromise = null;
    }
  });
  const resolvers = scopeReadyResolvers;
  scopeReadyResolvers = [];
  resolvers.forEach((resolve) => resolve());
}

/** Unbind (logout / user switch) so no store can be built against the departing account's tree. */
export function clearDataHistoryUserScope(): void {
  scopedUserId = null;
  scopeDirPromise = null;
}

/**
 * Resolves once storage is bound to a user (immediately when already bound). UI that queries
 * history storage on mount awaits this rather than racing `initDataHistory()` — on a hard refresh
 * straight onto such a page, the mount effect runs before app initialization has bound the scope.
 * Never rejects; a page rendered with no signed-in user simply keeps waiting.
 */
export function whenDataHistoryUserScopeReady(): Promise<void> {
  if (scopeDirPromise) {
    return Promise.resolve();
  }
  return new Promise((resolve) => scopeReadyResolvers.push(resolve));
}

/** True when storage is already bound to this exact user — lets callers skip a needless re-scope. */
export function isDataHistoryUserScope(userId: string): boolean {
  return !!scopeDirPromise && scopedUserId === userId;
}

/** Directory name every backend roots under. Throws when no user is bound — see module comment. */
export function getUserScopeDir(): Promise<string> {
  if (!scopeDirPromise) {
    throw new Error('Data history storage has not been scoped to a user. Call initDataHistory() before accessing history files.');
  }
  return scopeDirPromise;
}
