import type { HistoryFileStore, HistoryFileStoreCapabilities, HistoryWriteStream } from './file-store.types';
import { DataHistoryDirectoryPermissionError, FsaDirectoryHandle, FsaFileHandle } from './fsa-types';
import { splitRelativePath } from './path-utils';

/**
 * File store backed by a USER-CHOSEN real directory via the File System Access API
 * (Chromium-only; the picker gating lives in `isFileSystemAccessSupported`). Files are visible to
 * the user, included in their backups, and survive clearing site data.
 *
 * Unlike OPFS, no worker is needed — FSA writes use `createWritable`, which is main-thread safe in
 * every browser that has the API at all. gzip runs through the same native CompressionStream.
 *
 * `init()` throws `DataHistoryDirectoryPermissionError` when the persisted handle has lost
 * read-write permission — re-granting requires a user gesture (`requestAccess`), so callers fall
 * back to OPFS and surface a "re-connect" affordance in settings.
 */
export class DirectoryHandleFileStore implements HistoryFileStore {
  readonly type = 'directory' as const;
  readonly capabilities: HistoryFileStoreCapabilities = {
    userVisibleFiles: true,
    needsPermissionCheck: true,
    supportsReindex: true,
    survivesSiteDataClear: true,
  };

  private readonly rootHandle: FsaDirectoryHandle;

  constructor(rootHandle: FsaDirectoryHandle) {
    this.rootHandle = rootHandle;
  }

  get directoryName(): string {
    return this.rootHandle.name;
  }

  async init(): Promise<void> {
    if ((await this.rootHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      throw new DataHistoryDirectoryPermissionError();
    }
  }

  /** Must be called from a user gesture (settings "re-connect" button) */
  async requestAccess(): Promise<boolean> {
    return (await this.rootHandle.requestPermission({ mode: 'readwrite' })) === 'granted';
  }

  async createWriteStream(relativePath: string, options: { gzip: boolean }): Promise<HistoryWriteStream> {
    const fileHandle = await this.getFileHandle(relativePath, true);
    const writable = await fileHandle.createWritable();
    let bytesWritten = 0;

    if (!options.gzip) {
      return {
        write: async (chunk: Uint8Array) => {
          await writable.write(chunk);
          bytesWritten += chunk.byteLength;
        },
        close: async () => {
          await writable.close();
          return { bytes: bytesWritten };
        },
        abort: async () => {
          await abortQuietly(writable.abort());
          await this.deleteFileQuietly(relativePath);
        },
      };
    }

    const compression = new CompressionStream('gzip');
    const gzipWriter = compression.writable.getWriter();
    const reader = compression.readable.getReader();
    const pumpPromise = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        await writable.write(value);
        bytesWritten += value.byteLength;
      }
    })();
    // Mark handled so an abort() mid-write never surfaces as an unhandled rejection; close() still
    // awaits the original promise and receives any error
    pumpPromise.catch(() => undefined);

    return {
      write: async (chunk: Uint8Array) => {
        await gzipWriter.write(chunk as Uint8Array<ArrayBuffer>);
      },
      close: async () => {
        await gzipWriter.close();
        await pumpPromise;
        await writable.close();
        return { bytes: bytesWritten };
      },
      abort: async () => {
        await abortQuietly(gzipWriter.abort());
        await abortQuietly(pumpPromise);
        await abortQuietly(writable.abort());
        await this.deleteFileQuietly(relativePath);
      },
    };
  }

  async writeFile(relativePath: string, data: Uint8Array | Blob, options: { gzip: boolean }): Promise<{ bytes: number }> {
    const input = ArrayBuffer.isView(data) ? data : new Uint8Array(await data.arrayBuffer());
    const output = options.gzip ? await gzipBytes(input) : input;
    const fileHandle = await this.getFileHandle(relativePath, true);
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(output);
    } catch (ex) {
      await abortQuietly(writable.abort());
      throw ex;
    }
    await writable.close();
    return { bytes: output.byteLength };
  }

  async readFile(relativePath: string, options: { gunzip: boolean }): Promise<Blob> {
    const fileHandle = await this.getFileHandle(relativePath, false);
    const file = await fileHandle.getFile();
    if (!options.gunzip) {
      return file;
    }
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).blob();
  }

  async deleteEntryDir(relativeDirPath: string): Promise<void> {
    const segments = splitRelativePath(relativeDirPath);
    try {
      const parent = await this.getDirHandle(segments.slice(0, -1), false);
      await parent.removeEntry(segments[segments.length - 1], { recursive: true });
    } catch (ex) {
      if (isNotFoundError(ex)) {
        return;
      }
      throw ex;
    }
  }

  async listEntryDirs(): Promise<Array<{ orgFolder: string; entryKey: string }>> {
    const dirs: Array<{ orgFolder: string; entryKey: string }> = [];
    for await (const orgHandle of this.rootHandle.values()) {
      if (orgHandle.kind !== 'directory') {
        continue;
      }
      for await (const entryHandle of orgHandle.values()) {
        if (entryHandle.kind === 'directory') {
          dirs.push({ orgFolder: orgHandle.name, entryKey: entryHandle.name });
        }
      }
    }
    return dirs;
  }

  async estimate(): Promise<{ usageBytes?: number; quotaBytes?: number } | null> {
    // Real filesystem — the browser storage quota does not apply
    return null;
  }

  private async getDirHandle(dirSegments: string[], create: boolean): Promise<FsaDirectoryHandle> {
    let dir = this.rootHandle;
    for (const segment of dirSegments) {
      dir = await dir.getDirectoryHandle(segment, { create });
    }
    return dir;
  }

  private async getFileHandle(relativePath: string, create: boolean): Promise<FsaFileHandle> {
    const segments = splitRelativePath(relativePath);
    const dir = await this.getDirHandle(segments.slice(0, -1), create);
    return await dir.getFileHandle(segments[segments.length - 1], { create });
  }

  private async deleteFileQuietly(relativePath: string): Promise<void> {
    try {
      const segments = splitRelativePath(relativePath);
      const dir = await this.getDirHandle(segments.slice(0, -1), false);
      await dir.removeEntry(segments[segments.length - 1]);
    } catch {
      // best-effort cleanup of a partial file
    }
  }
}

function isNotFoundError(ex: unknown): boolean {
  return ex instanceof DOMException && ex.name === 'NotFoundError';
}

async function abortQuietly(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {
    // already closed/errored
  }
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
