import type { HistoryFileStore, HistoryFileStoreCapabilities, HistoryWriteStream } from './file-store.types';
import { listEntryDirs, removeDir, removeFileQuietly, resolveFile } from './fs-handle-ops';
import { DataHistoryDirectoryPermissionError, FsaDirectoryHandle, FsaFileHandle } from './fsa-types';
import { abortQuietly, createGzipEncoder, gzipBytes } from './gzip-utils';

/**
 * File store backed by a USER-CHOSEN real directory via the File System Access API
 * (Chromium-only; the picker gating lives in `isFileSystemAccessSupported`). Files are visible to
 * the user, included in their backups, and survive clearing site data.
 *
 * Unlike OPFS, no worker is needed — FSA writes use `createWritable`, which is main-thread safe in
 * every browser that has the API at all. The directory-tree and gzip mechanics are shared with the
 * OPFS worker (`fs-handle-ops` / `gzip-utils`); only the write API differs.
 *
 * `init()` throws `DataHistoryDirectoryPermissionError` when the persisted handle has lost
 * read-write permission — re-granting requires a user gesture (`requestAccess`), so callers fall
 * back to OPFS and surface a "re-connect" affordance in settings.
 */
export class DirectoryHandleFileStore implements HistoryFileStore {
  readonly type = 'directory' as const;
  readonly capabilities: HistoryFileStoreCapabilities = {
    compressFiles: false,
    userVisibleFiles: true,
    needsPermissionCheck: true,
    supportsReindex: true,
    survivesSiteDataClear: true,
  };

  private readonly rootHandle: FsaDirectoryHandle;
  private readonly scopeDir: string;
  private readonly onPermissionError?: () => void;
  /**
   * `<chosen folder>/<scopeDir>` — the tree this store actually reads and writes, resolved by
   * `init()`. Two accounts on one machine can pick the SAME folder (nothing stops them; the handle
   * is stored per user but the filesystem is shared), and without this segment each would see the
   * other's entries as orphans to sweep and as manifests to reindex into its own history.
   */
  private scopedRootHandle: FsaDirectoryHandle | null = null;

  constructor(rootHandle: FsaDirectoryHandle, scopeDir: string, options?: { onPermissionError?: () => void }) {
    this.rootHandle = rootHandle;
    this.scopeDir = scopeDir;
    this.onPermissionError = options?.onPermissionError;
  }

  /** The folder the USER picked — what settings displays, not the scoped subfolder underneath it */
  get directoryName(): string {
    return this.rootHandle.name;
  }

  async init(): Promise<void> {
    if ((await this.rootHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      throw new DataHistoryDirectoryPermissionError();
    }
    this.scopedRootHandle = await this.guardPermission(() => this.rootHandle.getDirectoryHandle(this.scopeDir, { create: true }));
  }

  /** Every read/write goes through the per-user root, never the folder the user picked. */
  private get scopedRoot(): FsaDirectoryHandle {
    if (!this.scopedRootHandle) {
      throw new Error('Data history folder store has not been initialized');
    }
    return this.scopedRootHandle;
  }

  /** Must be called from a user gesture (settings "re-connect" button) */
  async requestAccess(): Promise<boolean> {
    return (await this.rootHandle.requestPermission({ mode: 'readwrite' })) === 'granted';
  }

  async createWriteStream(relativePath: string, options: { gzip: boolean }): Promise<HistoryWriteStream> {
    // `resolveFile(create: true)` creates the file entry immediately, so remember whether one
    // already existed: abort() must clean up the empty stub WE created, but must never delete
    // pre-existing content — FSA writes land in a swap file, so an aborted overwrite leaves the
    // original file intact, and deleting the target here would destroy that good data.
    const fileExistedBefore = await this.fileExists(relativePath);
    const fileHandle = await this.guardPermission(() => resolveFile<FsaFileHandle>(this.scopedRoot, relativePath, true));
    const writable = await this.guardPermission(() => fileHandle.createWritable());
    let bytesWritten = 0;
    const writeToFile = async (chunk: Uint8Array) => {
      await this.guardPermission(() => writable.write(chunk));
      bytesWritten += chunk.byteLength;
    };
    const discardTargetIfCreated = async () => {
      if (!fileExistedBefore) {
        await removeFileQuietly(this.scopedRoot, relativePath);
      }
    };

    if (!options.gzip) {
      return {
        write: writeToFile,
        close: async () => {
          await this.guardPermission(() => writable.close());
          return { bytes: bytesWritten };
        },
        abort: async () => {
          await abortQuietly(writable.abort());
          await discardTargetIfCreated();
        },
      };
    }

    const encoder = createGzipEncoder(writeToFile);
    return {
      write: (chunk: Uint8Array) => encoder.write(chunk),
      close: async () => {
        await encoder.close();
        await this.guardPermission(() => writable.close());
        return { bytes: bytesWritten };
      },
      abort: async () => {
        await encoder.abort();
        await abortQuietly(writable.abort());
        await discardTargetIfCreated();
      },
    };
  }

  private async fileExists(relativePath: string): Promise<boolean> {
    try {
      await resolveFile<FsaFileHandle>(this.scopedRoot, relativePath, false);
      return true;
    } catch {
      return false;
    }
  }

  async writeFile(relativePath: string, data: Uint8Array | Blob, options: { gzip: boolean }): Promise<{ bytes: number }> {
    const input = ArrayBuffer.isView(data) ? data : new Uint8Array(await data.arrayBuffer());
    const output = options.gzip ? await gzipBytes(input) : input;
    const fileHandle = await this.guardPermission(() => resolveFile<FsaFileHandle>(this.scopedRoot, relativePath, true));
    const writable = await this.guardPermission(() => fileHandle.createWritable());
    try {
      await this.guardPermission(() => writable.write(output));
      await this.guardPermission(() => writable.close());
    } catch (ex) {
      await abortQuietly(writable.abort());
      throw ex;
    }
    return { bytes: output.byteLength };
  }

  async readFile(relativePath: string, options: { gunzip: boolean }): Promise<Blob> {
    const fileHandle = await this.guardPermission(() => resolveFile<FsaFileHandle>(this.scopedRoot, relativePath, false));
    const file = await this.guardPermission(() => fileHandle.getFile());
    if (!options.gunzip) {
      return file;
    }
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).blob();
  }

  async deleteEntryDir(relativeDirPath: string): Promise<void> {
    return this.guardPermission(() => removeDir(this.scopedRoot, relativeDirPath));
  }

  async listEntryDirs(): Promise<Array<{ orgFolder: string; entryKey: string }>> {
    return this.guardPermission(() => listEntryDirs(this.scopedRoot));
  }

  async estimate(): Promise<{ usageBytes?: number; quotaBytes?: number } | null> {
    // Real filesystem — the browser storage quota does not apply
    return null;
  }

  /**
   * Detects the folder permission being revoked MID-SESSION (site-settings lock icon) — `init()`
   * only checks once, and without this every subsequent capture would silently fail with no
   * "re-connect" affordance ever surfacing until a full reload.
   *
   * EVERY File System Access call must go through this, not just handle resolution: `getFile()`,
   * `createWritable()`, `write()` and `close()` each re-check permission and reject with
   * `NotAllowedError` on their own. Cleanup calls (`abort()`, `removeFileQuietly`) are the
   * exception — they already swallow failures.
   */
  private async guardPermission<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (ex) {
      if (ex instanceof DOMException && ex.name === 'NotAllowedError') {
        this.onPermissionError?.();
        throw new DataHistoryDirectoryPermissionError();
      }
      throw ex;
    }
  }
}
