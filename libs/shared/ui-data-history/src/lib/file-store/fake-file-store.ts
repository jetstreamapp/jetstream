import { DataHistoryStorageBackend } from '@jetstream/types';
import type { HistoryFileStore, HistoryFileStoreCapabilities, HistoryWriteStream } from './file-store.types';
import { gzipBytes, readStoredBlob } from './gzip-utils';
import { splitRelativePath } from './path-utils';

/**
 * In-memory `HistoryFileStore` used by unit tests (OPFS does not exist in jsdom) and by the
 * contract test suite that every backend implementation must pass. Applies REAL gzip via
 * `CompressionStream` so compressed round-trips behave identically to production backends.
 *
 * `simulateFailure` lets tests assert the capture layer's failure isolation: return true to make
 * the next matching operation throw. The backend `type`/`capabilities` are configurable so
 * migration/reindex tests can impersonate any backend.
 */
export class FakeFileStore implements HistoryFileStore {
  readonly type: DataHistoryStorageBackend;
  readonly capabilities: HistoryFileStoreCapabilities;

  files = new Map<string, { bytes: Uint8Array; gzip: boolean }>();
  simulateFailure: ((op: string, path?: string) => boolean) | null = null;

  constructor(type: DataHistoryStorageBackend = 'opfs', capabilities?: Partial<HistoryFileStoreCapabilities>) {
    this.type = type;
    this.capabilities = {
      compressFiles: true,
      userVisibleFiles: false,
      supportsReindex: false,
      ...capabilities,
    };
  }

  async init(): Promise<void> {
    this.throwIfFailureSimulated('init');
  }

  async createWriteStream(relativePath: string, options: { gzip: boolean }): Promise<HistoryWriteStream> {
    this.throwIfFailureSimulated('open-stream', relativePath);
    splitRelativePath(relativePath);
    const chunks: Uint8Array[] = [];
    let closed = false;
    return {
      write: async (chunk: Uint8Array) => {
        this.throwIfFailureSimulated('stream-write', relativePath);
        if (closed) {
          throw new Error('Stream is closed');
        }
        chunks.push(chunk);
      },
      close: async () => {
        this.throwIfFailureSimulated('stream-close', relativePath);
        closed = true;
        const combined = concatChunks(chunks);
        const bytes = options.gzip ? await gzipBytes(combined) : combined;
        this.files.set(relativePath, { bytes, gzip: options.gzip });
        return { bytes: bytes.byteLength };
      },
      abort: async () => {
        closed = true;
        chunks.length = 0;
        this.files.delete(relativePath);
      },
    };
  }

  async writeFile(relativePath: string, data: Uint8Array, options: { gzip: boolean }): Promise<{ bytes: number }> {
    this.throwIfFailureSimulated('write-file', relativePath);
    splitRelativePath(relativePath);
    const bytes = options.gzip ? await gzipBytes(data) : data;
    this.files.set(relativePath, { bytes, gzip: options.gzip });
    return { bytes: bytes.byteLength };
  }

  async readFile(relativePath: string, options: { gunzip: boolean; maxBytes?: number }): Promise<Blob> {
    this.throwIfFailureSimulated('read-file', relativePath);
    const file = this.files.get(relativePath);
    if (!file) {
      throw new Error(`File not found: ${relativePath}`);
    }
    return readStoredBlob(new Blob([file.bytes as BlobPart]), options);
  }

  async deleteEntryDir(relativeDirPath: string): Promise<void> {
    this.throwIfFailureSimulated('delete-dir', relativeDirPath);
    const prefix = `${relativeDirPath}/`;
    for (const path of Array.from(this.files.keys())) {
      if (path.startsWith(prefix)) {
        this.files.delete(path);
      }
    }
  }

  async listEntryDirs(): Promise<Array<{ orgFolder: string; entryKey: string }>> {
    this.throwIfFailureSimulated('list-entry-dirs');
    const dirs = new Map<string, { orgFolder: string; entryKey: string }>();
    for (const path of this.files.keys()) {
      const segments = path.split('/');
      if (segments.length >= 3) {
        dirs.set(`${segments[0]}/${segments[1]}`, { orgFolder: segments[0], entryKey: segments[1] });
      }
    }
    return Array.from(dirs.values());
  }

  private throwIfFailureSimulated(op: string, path?: string) {
    if (this.simulateFailure?.(op, path)) {
      throw new Error(`Simulated failure for ${op}${path ? ` (${path})` : ''}`);
    }
  }
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}
