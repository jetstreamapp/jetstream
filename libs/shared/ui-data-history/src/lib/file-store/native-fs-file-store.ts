import type { DataHistoryFileOpRequest, DataHistoryFileOpResult } from '@jetstream/desktop/types';
import type { HistoryFileStore, HistoryFileStoreCapabilities, HistoryWriteStream } from './file-store.types';
import { assertSafeRelativePath } from './path-utils';

/**
 * Desktop-only file store: real filesystem via Electron IPC. The renderer sends the SAME op-based
 * request shapes the OPFS worker uses (one protocol, different transport); the main process
 * (`data-history-file.service.ts` in apps/jetstream-desktop) executes them with Node fs + zlib
 * under a user-configurable base directory (default `<userData>/data-history`). Paths are validated
 * on BOTH sides of the wire — `assertSafeRelativePath` here fails fast, and the main process
 * re-validates every segment before touching the filesystem (it cannot trust the renderer).
 *
 * NOTE: `read-file` returns raw bytes over IPC (Blobs are not structured-cloneable across the
 * context bridge) and is wrapped into a Blob here.
 */
export class NativeFsFileStore implements HistoryFileStore {
  readonly type = 'native' as const;
  readonly capabilities: HistoryFileStoreCapabilities = {
    compressFiles: false,
    userVisibleFiles: true,
    needsPermissionCheck: false,
    supportsReindex: true,
    survivesSiteDataClear: true,
  };

  async init(): Promise<void> {
    await this.request({ op: 'init' });
  }

  async createWriteStream(relativePath: string, options: { gzip: boolean }): Promise<HistoryWriteStream> {
    assertSafeRelativePath(relativePath);
    const { streamId } = await this.request({ op: 'open-stream', path: relativePath, gzip: options.gzip });
    return {
      write: async (chunk: Uint8Array) => {
        await this.request({ op: 'stream-write', streamId, bytes: chunk });
      },
      close: () => this.request({ op: 'stream-close', streamId }),
      abort: async () => {
        await this.request({ op: 'stream-abort', streamId });
      },
    };
  }

  async writeFile(relativePath: string, data: Uint8Array | Blob, options: { gzip: boolean }): Promise<{ bytes: number }> {
    assertSafeRelativePath(relativePath);
    const bytes = ArrayBuffer.isView(data) ? data : new Uint8Array(await data.arrayBuffer());
    return await this.request({ op: 'write-file', path: relativePath, gzip: options.gzip, bytes });
  }

  async readFile(relativePath: string, options: { gunzip: boolean }): Promise<Blob> {
    assertSafeRelativePath(relativePath);
    const bytes = await this.request({ op: 'read-file', path: relativePath, gunzip: options.gunzip });
    return new Blob([bytes as BlobPart]);
  }

  async deleteEntryDir(relativeDirPath: string): Promise<void> {
    assertSafeRelativePath(relativeDirPath);
    await this.request({ op: 'delete-dir', path: relativeDirPath });
  }

  async listEntryDirs(): Promise<Array<{ orgFolder: string; entryKey: string }>> {
    const { dirs } = await this.request({ op: 'list-entry-dirs' });
    return dirs;
  }

  async estimate(): Promise<{ usageBytes?: number; quotaBytes?: number } | null> {
    try {
      return await this.request({ op: 'estimate' });
    } catch {
      return null;
    }
  }

  private async request<TRequest extends DataHistoryFileOpRequest>(payload: TRequest): Promise<DataHistoryFileOpResult<TRequest>> {
    const electronApi = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!electronApi?.dataHistoryRequest) {
      throw new Error('Native data history storage is not available in this environment');
    }
    return await electronApi.dataHistoryRequest(payload);
  }
}
