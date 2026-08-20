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
/** Bytes pulled per `read-file-chunk` round trip — small enough that no single IPC clone is large */
const IPC_READ_CHUNK_BYTES = 4 * 1024 * 1024;

export class NativeFsFileStore implements HistoryFileStore {
  readonly type = 'native' as const;
  readonly capabilities: HistoryFileStoreCapabilities = {
    compressFiles: false,
    userVisibleFiles: true,
    supportsReindex: true,
  };

  private readonly scopeDir: string;

  constructor(scopeDir: string) {
    this.scopeDir = scopeDir;
  }

  async init(): Promise<void> {
    // The main process holds the scope for the rest of the session and resolves every subsequent
    // path under it, so this must be the first op — the factory always awaits it before use.
    await this.request({ op: 'init', scopeDir: this.scopeDir });
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

  async writeFile(relativePath: string, bytes: Uint8Array, options: { gzip: boolean }): Promise<{ bytes: number }> {
    assertSafeRelativePath(relativePath);
    return await this.request({ op: 'write-file', path: relativePath, gzip: options.gzip, bytes });
  }

  /**
   * Read a file back as a Blob, pulling it across IPC in bounded chunks (see the `read-file-chunk`
   * op). With `maxBytes` the walk STOPS at the cap rather than reading to EOF — otherwise a preview
   * of a large results file would copy every byte through the main process to show the head of it.
   *
   * Gzip'd payloads take the whole-file op instead — a gzip stream cannot be decompressed from an
   * arbitrary offset, so the main process caps after inflating. That is not a large-file path in
   * practice: this backend always writes plain files, so a compressed ref only exists on an entry
   * that has not been re-encoded yet.
   */
  async readFile(relativePath: string, options: { gunzip: boolean; maxBytes?: number }): Promise<Blob> {
    assertSafeRelativePath(relativePath);
    if (options.gunzip) {
      const bytes = await this.request({ op: 'read-file', path: relativePath, gunzip: true, maxBytes: options.maxBytes });
      return new Blob([bytes as BlobPart]);
    }
    const chunks: BlobPart[] = [];
    let offset = 0;
    for (;;) {
      const length = options.maxBytes == null ? IPC_READ_CHUNK_BYTES : Math.min(IPC_READ_CHUNK_BYTES, options.maxBytes - offset);
      if (length <= 0) {
        return new Blob(chunks);
      }
      const { bytes, totalBytes } = await this.request({ op: 'read-file-chunk', path: relativePath, offset, length });
      offset += bytes.byteLength;
      if (bytes.byteLength > 0) {
        chunks.push(bytes as BlobPart);
      }
      if (bytes.byteLength === 0 || offset >= totalBytes) {
        return new Blob(chunks);
      }
    }
  }

  async deleteEntryDir(relativeDirPath: string): Promise<void> {
    assertSafeRelativePath(relativeDirPath);
    await this.request({ op: 'delete-dir', path: relativeDirPath });
  }

  async listEntryDirs(): Promise<Array<{ orgFolder: string; entryKey: string }>> {
    const { dirs } = await this.request({ op: 'list-entry-dirs' });
    return dirs;
  }

  private async request<TRequest extends DataHistoryFileOpRequest>(payload: TRequest): Promise<DataHistoryFileOpResult<TRequest>> {
    const electronApi = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!electronApi?.dataHistoryRequest) {
      throw new Error('Native data history storage is not available in this environment');
    }
    return await electronApi.dataHistoryRequest(payload);
  }
}
