import { logger } from '@jetstream/shared/client-logger';
import type { HistoryFileStore, HistoryFileStoreCapabilities, HistoryWriteStream } from './file-store.types';
import type {
  EstimateResult,
  HistoryWorkerRequestBody,
  HistoryWorkerResponse,
  ListEntryDirsResult,
  OpenStreamResult,
  StreamCloseResult,
  WriteFileResult,
} from './worker-messages';

/**
 * Default Data History file store: OPFS, with all I/O delegated to a dedicated worker
 * (`history-storage.worker.ts`) over a small promise-map RPC. The worker is spawned lazily on
 * first use and respawned automatically if it dies — pending requests are rejected, and the
 * capture layer above converts those rejections into failed history entries without ever
 * affecting a user operation.
 */
export class OpfsFileStore implements HistoryFileStore {
  readonly type = 'opfs' as const;
  readonly capabilities: HistoryFileStoreCapabilities = {
    userVisibleFiles: false,
    needsPermissionCheck: false,
    supportsReindex: false,
    survivesSiteDataClear: false,
  };

  private worker: Worker | null = null;
  private nextRequestId = 1;
  private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();

  async init(): Promise<void> {
    await this.request({ op: 'init' });
  }

  async createWriteStream(relativePath: string, options: { gzip: boolean }): Promise<HistoryWriteStream> {
    const { streamId } = (await this.request({ op: 'open-stream', path: relativePath, gzip: options.gzip })) as OpenStreamResult;
    return {
      write: async (chunk: Uint8Array) => {
        await this.request({ op: 'stream-write', streamId, bytes: chunk }, [chunk.buffer as ArrayBuffer]);
      },
      close: async () => {
        return (await this.request({ op: 'stream-close', streamId })) as StreamCloseResult;
      },
      abort: async () => {
        await this.request({ op: 'stream-abort', streamId });
      },
    };
  }

  async writeFile(relativePath: string, data: Uint8Array | Blob, options: { gzip: boolean }): Promise<{ bytes: number }> {
    // ArrayBuffer.isView instead of instanceof — realm-safe (instanceof fails cross-realm in jsdom)
    const bytes = ArrayBuffer.isView(data) ? data : new Uint8Array(await data.arrayBuffer());
    return (await this.request({ op: 'write-file', path: relativePath, gzip: options.gzip, bytes }, [
      bytes.buffer as ArrayBuffer,
    ])) as WriteFileResult;
  }

  async readFile(relativePath: string, options: { gunzip: boolean }): Promise<Blob> {
    return (await this.request({ op: 'read-file', path: relativePath, gunzip: options.gunzip })) as Blob;
  }

  async deleteEntryDir(relativeDirPath: string): Promise<void> {
    await this.request({ op: 'delete-dir', path: relativeDirPath });
  }

  async listEntryDirs(): Promise<Array<{ orgFolder: string; entryKey: string }>> {
    const { dirs } = (await this.request({ op: 'list-entry-dirs' })) as ListEntryDirsResult;
    return dirs;
  }

  async estimate(): Promise<{ usageBytes?: number; quotaBytes?: number } | null> {
    try {
      return (await this.request({ op: 'estimate' })) as EstimateResult;
    } catch {
      return null;
    }
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./history-storage.worker.ts', import.meta.url), {
        type: 'module',
        name: 'jetstream-data-history-storage',
      });
      this.worker.onmessage = (event: MessageEvent<HistoryWorkerResponse>) => {
        const response = event.data;
        const pending = this.pendingRequests.get(response.id);
        if (!pending) {
          return;
        }
        this.pendingRequests.delete(response.id);
        if (response.success) {
          pending.resolve(response.result);
        } else {
          pending.reject(new Error(response.error));
        }
      };
      this.worker.onerror = (event) => {
        logger.warn('[DATA_HISTORY][OPFS] Storage worker crashed, rejecting pending requests', event.message);
        const error = new Error(`Data history storage worker error: ${event.message || 'unknown'}`);
        const pending = Array.from(this.pendingRequests.values());
        this.pendingRequests.clear();
        pending.forEach(({ reject }) => reject(error));
        this.worker?.terminate();
        this.worker = null;
      };
    }
    return this.worker;
  }

  private request(message: HistoryWorkerRequestBody, transfer?: Transferable[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      try {
        const worker = this.getWorker();
        const id = this.nextRequestId++;
        this.pendingRequests.set(id, { resolve, reject });
        worker.postMessage({ ...message, id }, transfer || []);
      } catch (ex) {
        reject(ex instanceof Error ? ex : new Error(String(ex)));
      }
    });
  }
}
