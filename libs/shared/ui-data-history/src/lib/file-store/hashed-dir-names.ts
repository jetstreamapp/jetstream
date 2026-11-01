import { getDataHistoryUserScopeDirName, sha1Hex } from '@jetstream/shared/utils';
import trim from 'lodash/trim';

/**
 * Directory names derived from an identifier by hashing. Deliberately SEPARATE from `path-utils`:
 * these are the only history path helpers with a dependency (`@jetstream/shared/utils`), and
 * `path-utils` is reachable from the OPFS storage worker, whose bundle must stay dependency-free.
 * Nothing here is used by the worker — it resolves paths that were already built on the main thread.
 */

/**
 * Per-user directory every backend roots its history tree under, so accounts sharing a machine
 * never see or sweep each other's files.
 *
 * This exists because the per-user scoping applied to IndexedDB and localforage does not reach the
 * filesystem: OPFS is per-ORIGIN and the desktop history folder is per-INSTALL, so without this
 * segment a second account on a shared computer inherits one shared history tree. That is not just
 * a read leak — the retention sweep deletes entry directories with no matching row, so the incoming
 * account would silently delete the previous account's history, and `reindex` (native/FSA) would
 * import their entries into its own index.
 *
 * The derivation itself is shared with the Electron main process (which computes the directory
 * from the authenticated user instead of trusting the renderer), so it lives in
 * `@jetstream/shared/utils` and is only re-exported here under the name the stores use.
 */
export const getUserScopeDirName = getDataHistoryUserScopeDirName;

/**
 * Stable, filesystem-safe folder name for an org. The readable prefix keeps user-visible backends
 * (FSA/native) meaningful; the hash suffix prevents collisions between org ids that sanitize to
 * the same string.
 *
 * The `_` trim is lodash's (linear) rather than `/^_+|_+$/` — the `_+$` branch backtracks over
 * every position of an interior underscore run before failing the end anchor, which is quadratic on
 * the long runs sanitizing an untrusted org id readily produces.
 */
export async function getOrgFolderName(orgUniqueId: string): Promise<string> {
  const sanitized = trim(orgUniqueId.toLowerCase().replace(/[^a-z0-9_-]+/g, '_'), '_').slice(0, 40) || 'org';
  const hash = await sha1Hex(orgUniqueId);
  return `${sanitized}-${hash.slice(0, 8)}`;
}
