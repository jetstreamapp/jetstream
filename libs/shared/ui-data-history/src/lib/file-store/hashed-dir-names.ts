import { sha1Hex } from '@jetstream/shared/utils';

/**
 * Directory names derived from an identifier by hashing. Deliberately SEPARATE from `path-utils`:
 * these are the only history path helpers with a dependency (`@jetstream/shared/utils`), and
 * `path-utils` is reachable from the OPFS storage worker, whose bundle must stay dependency-free.
 * Nothing here is used by the worker — it resolves paths that were already built on the main thread.
 */

/**
 * Length of the hashed user id in a scope directory name. Full SHA-1 is unnecessarily long for a
 * folder users may browse (native/FSA backends), and 16 hex chars is far past collision risk for
 * the number of accounts that ever share one machine.
 */
const USER_SCOPE_HASH_LENGTH = 16;

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
 * The user id is hashed rather than used verbatim, matching `getScopedDexieDbName` — on canvas the
 * scope id is a Salesforce username, which is email-shaped and does not belong in a folder name.
 */
export async function getUserScopeDirName(userId: string): Promise<string> {
  if (!userId) {
    throw new Error('A user id is required to scope data history storage');
  }
  return `u-${(await sha1Hex(userId)).slice(0, USER_SCOPE_HASH_LENGTH)}`;
}

/**
 * Strip leading and trailing `_` in a single linear pass.
 *
 * Deliberately not `/^_+|_+$/` — the `_+$` branch backtracks over every position of an interior
 * underscore run before failing the end anchor, which is quadratic on the long runs that sanitizing
 * an untrusted org id readily produces (a punctuation-heavy id collapses to one `_` per character).
 */
function trimUnderscores(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === '_') {
    start++;
  }
  while (end > start && value[end - 1] === '_') {
    end--;
  }
  return value.slice(start, end);
}

/**
 * Stable, filesystem-safe folder name for an org. The readable prefix keeps user-visible backends
 * (FSA/native) meaningful; the hash suffix prevents collisions between org ids that sanitize to
 * the same string.
 */
export async function getOrgFolderName(orgUniqueId: string): Promise<string> {
  const sanitized = trimUnderscores(orgUniqueId.toLowerCase().replace(/[^a-z0-9_-]+/g, '_')).slice(0, 40) || 'org';
  const hash = await sha1Hex(orgUniqueId);
  return `${sanitized}-${hash.slice(0, 8)}`;
}
