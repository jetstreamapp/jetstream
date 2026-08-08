import { splitRelativePath } from './path-utils';

/**
 * Directory-tree operations shared by the two backends that speak the File System Access handle API:
 * the OPFS storage worker (root from `navigator.storage.getDirectory()`) and the user-chosen-folder
 * store (root from `showDirectoryPicker()`). The two roots come from different typings — the DOM
 * lib's `FileSystemDirectoryHandle` and our hand-rolled `FsaDirectoryHandle` — but they are the same
 * API, so these helpers are generic over the minimal shape both satisfy.
 *
 * Every path is validated by `splitRelativePath` before a handle is touched, so a corrupted row can
 * never traverse outside the history root. Dependency-free apart from `path-utils` (also tiny) so
 * importing this does not grow the worker bundle.
 */

/** The `kind`/`name` pair every File System Access handle exposes */
interface FsEntryLike {
  readonly kind: string;
  readonly name: string;
}

export interface FsDirectoryLike<TFile> extends FsEntryLike {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsDirectoryLike<TFile>>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<TFile>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  values(): AsyncIterableIterator<FsEntryLike>;
}

export async function resolveDir<TFile>(
  root: FsDirectoryLike<TFile>,
  dirSegments: string[],
  create: boolean,
): Promise<FsDirectoryLike<TFile>> {
  let dir = root;
  for (const segment of dirSegments) {
    dir = await dir.getDirectoryHandle(segment, { create });
  }
  return dir;
}

export async function resolveFile<TFile>(root: FsDirectoryLike<TFile>, relativePath: string, create: boolean): Promise<TFile> {
  const segments = splitRelativePath(relativePath);
  const dir = await resolveDir(root, segments.slice(0, -1), create);
  return await dir.getFileHandle(segments[segments.length - 1], { create });
}

/** Recursively delete a directory. Resolves (does not reject) when it is already gone. */
export async function removeDir<TFile>(root: FsDirectoryLike<TFile>, relativeDirPath: string): Promise<void> {
  const segments = splitRelativePath(relativeDirPath);
  try {
    const parent = await resolveDir(root, segments.slice(0, -1), false);
    await parent.removeEntry(segments[segments.length - 1], { recursive: true });
  } catch (ex) {
    if (isNotFoundError(ex)) {
      return;
    }
    throw ex;
  }
}

/** Best-effort cleanup of a partial file — every failure is ignored. */
export async function removeFileQuietly<TFile>(root: FsDirectoryLike<TFile>, relativePath: string): Promise<void> {
  try {
    const segments = splitRelativePath(relativePath);
    const dir = await resolveDir(root, segments.slice(0, -1), false);
    await dir.removeEntry(segments[segments.length - 1]);
  } catch {
    // best-effort cleanup of a partial file
  }
}

/**
 * Enumerate the `<orgFolder>/<entryKey>` directories under the history root. Org folders are
 * re-resolved by name rather than iterated as handles because `values()` only guarantees the
 * `kind`/`name` pair across the two handle typings.
 */
export async function listEntryDirs<TFile>(root: FsDirectoryLike<TFile>): Promise<Array<{ orgFolder: string; entryKey: string }>> {
  const dirs: Array<{ orgFolder: string; entryKey: string }> = [];
  for await (const orgEntry of root.values()) {
    if (orgEntry.kind !== 'directory') {
      continue;
    }
    const orgHandle = await root.getDirectoryHandle(orgEntry.name);
    for await (const entry of orgHandle.values()) {
      if (entry.kind === 'directory') {
        dirs.push({ orgFolder: orgEntry.name, entryKey: entry.name });
      }
    }
  }
  return dirs;
}

function isNotFoundError(ex: unknown): boolean {
  return (ex as { name?: string } | null)?.name === 'NotFoundError';
}
