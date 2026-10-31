import { resolve } from 'node:path';

/**
 * Allowlist of files the renderer may ask the main process to open or reveal (`openFile` /
 * `showFileInFolder` IPC). The renderer only ever learns a file path because the main process
 * downloaded that file and returned the path, so the main process can hold the authoritative
 * record of which paths it handed out and refuse anything else — `shell.openPath` runs whatever the
 * OS associates with the file, so letting a renderer name an arbitrary path would let a compromised
 * renderer launch an executable or script.
 *
 * Bounded: jobs (and therefore the paths the renderer can still reference) live only in renderer
 * memory and die with a reload, so a small recent window is plenty.
 */
const MAX_TRACKED_FILES = 200;

/** Insertion-ordered, so the oldest entry is always the first one iterated */
const openableFiles = new Set<string>();

/** Record a file the main process just finished writing. Returns the resolved absolute path. */
export function registerOpenableFile(filePath: string): string {
  const resolvedPath = resolve(filePath);
  // Re-registering moves the entry to the newest position instead of leaving it to age out early
  openableFiles.delete(resolvedPath);
  openableFiles.add(resolvedPath);
  while (openableFiles.size > MAX_TRACKED_FILES) {
    const oldestPath = openableFiles.values().next().value;
    if (oldestPath === undefined) {
      break;
    }
    openableFiles.delete(oldestPath);
  }
  return resolvedPath;
}

/**
 * The resolved absolute path when `filePath` names a registered download, otherwise `null`.
 * Resolved before the lookup so a relative or non-normalized spelling of a registered path neither
 * slips through nor is spuriously refused.
 */
export function resolveOpenableFile(filePath: unknown): string | null {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return null;
  }
  const resolvedPath = resolve(filePath);
  return openableFiles.has(resolvedPath) ? resolvedPath : null;
}

/** Test-only: forget every registered file. */
export function clearOpenableFiles(): void {
  openableFiles.clear();
}
