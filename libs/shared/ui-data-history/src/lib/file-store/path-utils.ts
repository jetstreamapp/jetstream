/**
 * Pure path helpers shared by the main thread and the storage worker. Paths are always RELATIVE
 * (`<orgFolder>/<entryKey>/<fileName>`) and validated before touching any filesystem so a
 * corrupted row can never traverse outside the history root in any backend.
 *
 * KEEP THIS MODULE DEPENDENCY-FREE. It is reachable from `history-storage.worker.ts` (directly and
 * through `fs-handle-ops`), and every runtime import here lands in the emitted worker chunk of all
 * four apps' Vite builds. The hashed directory names — the only history path helpers that need a
 * dependency — live in `hashed-dir-names.ts` for exactly this reason.
 */

const SAFE_SEGMENT_REGEX = /^[a-zA-Z0-9._-]+$/;

export const DATA_HISTORY_ROOT_DIR = 'jetstream-history';

export const DATA_HISTORY_FILE_NAMES = {
  manifest: 'manifest.json',
} as const;

export type DataHistoryBaseFileName = 'input.csv' | 'request.json' | 'results.csv' | 'results.json';

/** Payload file name for a backend's compression policy (`input.csv` vs `input.csv.gz`) */
export function getDataHistoryFileName(baseName: DataHistoryBaseFileName, compressed: boolean): string {
  return compressed ? `${baseName}.gz` : baseName;
}

/**
 * Reject an unsafe relative path without needing its segments — for backends that hand the path to
 * another process (Electron IPC) and so cannot rely on resolving handles segment-by-segment to catch
 * traversal. The receiving side validates again; this fails fast on the caller's side of the wire.
 */
export function assertSafeRelativePath(relativePath: string): void {
  splitRelativePath(relativePath);
}

/** Split and validate a relative path. Throws on empty/unsafe segments or traversal attempts. */
export function splitRelativePath(relativePath: string): string[] {
  const segments = relativePath.split('/');
  if (segments.length === 0) {
    throw new Error(`Invalid path: ${relativePath}`);
  }
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || !SAFE_SEGMENT_REGEX.test(segment)) {
      throw new Error(`Invalid path segment in: ${relativePath}`);
    }
  }
  return segments;
}

export function getEntryDirPath(orgFolder: string, entryKey: string): string {
  return `${orgFolder}/${entryKey}`;
}

export function getEntryFilePath(orgFolder: string, entryKey: string, fileName: string): string {
  return `${orgFolder}/${entryKey}/${fileName}`;
}

/** `<orgFolder>/<entryKey>/<fileName>` -> `<orgFolder>/<entryKey>` */
export function getParentDirPath(relativeFilePath: string): string {
  const segments = splitRelativePath(relativeFilePath);
  return segments.slice(0, -1).join('/');
}
