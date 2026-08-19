import { logger } from '@jetstream/shared/client-logger';
import type { HistoryFileStore, HistoryFileStoreCapabilities, HistoryWriteStream } from './file-store.types';
import type { HistoryWorkerRequestBody, HistoryWorkerResponse, HistoryWorkerResultByOp } from './worker-messages';

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
    compressFiles: true,
    userVisibleFiles: false,
    supportsReindex: false,
  };

  private worker: Worker | null = null;
  private nextRequestId = 1;
  // Stream ids are allocated CLIENT-side: a respawned worker (crash or dispose) restarts its own
  // counters, so worker-side allocation could hand a fresh stream an id a stale handle still holds —
  // letting the stale handle silently append into the wrong entry's file. With client ids a stale
  // handle just fails with "Unknown streamId".
  private nextStreamId = 1;
  private openStreamIds = new Set<number>();
  private disposeRequested = false;
  private pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();

  /**
   * Per-user directory the worker roots its tree under. Held on the instance (rather than read from
   * `user-scope` on demand) so a worker respawn can re-send it synchronously — see `getWorker`.
   */
  private readonly scopeDir: string;

  constructor(scopeDir: string) {
    this.scopeDir = scopeDir;
  }

  async init(): Promise<void> {
    await this.request({ op: 'init', scopeDir: this.scopeDir });
  }

  async createWriteStream(relativePath: string, options: { gzip: boolean }): Promise<HistoryWriteStream> {
    const streamId = this.nextStreamId++;
    const releaseStream = () => {
      this.openStreamIds.delete(streamId);
      this.maybeTerminate();
    };
    // Register BEFORE the round trip: `maybeTerminate` runs synchronously in `onmessage` the moment
    // the open-stream response settles — registering only afterwards (a later microtask) leaves a
    // window where a dispose() requested during the round trip terminates the worker out from under
    // the stream that just opened, and its next write fails with "Unknown streamId".
    this.openStreamIds.add(streamId);
    try {
      await this.request({ op: 'open-stream', streamId, path: relativePath, gzip: options.gzip });
    } catch (ex) {
      releaseStream();
      throw ex;
    }
    return {
      write: async (chunk: Uint8Array) => {
        await this.request({ op: 'stream-write', streamId, bytes: chunk }, [chunk.buffer as ArrayBuffer]);
      },
      close: async () => {
        try {
          return await this.request({ op: 'stream-close', streamId });
        } finally {
          releaseStream();
        }
      },
      abort: async () => {
        try {
          await this.request({ op: 'stream-abort', streamId });
        } finally {
          releaseStream();
        }
      },
    };
  }

  async writeFile(relativePath: string, data: Uint8Array | Blob, options: { gzip: boolean }): Promise<{ bytes: number }> {
    // ArrayBuffer.isView instead of instanceof — realm-safe (instanceof fails cross-realm in jsdom)
    const bytes = ArrayBuffer.isView(data) ? data : new Uint8Array(await data.arrayBuffer());
    // NOT transferred: no other backend consumes the caller's buffer, and detaching it here would
    // make buffer reuse fail only on OPFS in production. Stream chunks (above) stay transferred —
    // they are freshly allocated per chunk.
    return await this.request({ op: 'write-file', path: relativePath, gzip: options.gzip, bytes });
  }

  async readFile(relativePath: string, options: { gunzip: boolean; maxBytes?: number }): Promise<Blob> {
    // `maxBytes` is applied in the worker, not here: the decompression that a capped read needs to
    // stop early happens on that side of the wire.
    return await this.request({ op: 'read-file', path: relativePath, gunzip: options.gunzip, maxBytes: options.maxBytes });
  }

  async deleteEntryDir(relativeDirPath: string): Promise<void> {
    await this.request({ op: 'delete-dir', path: relativeDirPath });
  }

  async listEntryDirs(): Promise<Array<{ orgFolder: string; entryKey: string }>> {
    const { dirs } = await this.request({ op: 'list-entry-dirs' });
    return dirs;
  }

  /**
   * Release the worker once it is idle. Called when the factory drops this store on a backend
   * switch — but a capture handle created before the switch still holds this instance, so
   * termination is DEFERRED until its streams close and no requests are pending. Terminating
   * eagerly would reject the in-flight capture's writes (failing its entry) and discard the
   * worker's open-stream state. Idempotent.
   */
  dispose(): void {
    this.disposeRequested = true;
    this.maybeTerminate();
  }

  private maybeTerminate(): void {
    if (this.disposeRequested && this.openStreamIds.size === 0 && this.pendingRequests.size === 0) {
      this.worker?.terminate();
      this.worker = null;
    }
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./history-storage.worker.ts', import.meta.url), {
        type: 'module',
        name: 'jetstream-data-history-storage',
      });
      // A respawned worker (crash, or an op after dispose) starts with no scope, and every op
      // resolves through its root — so re-scope it immediately rather than waiting for an `init()`
      // that only the factory calls. Fire-and-forget is safe: the worker handles messages in order,
      // so this lands before the op that triggered the spawn, and the reply's unknown id is ignored
      // by the handler below.
      this.worker.postMessage({ id: this.nextRequestId++, op: 'init', scopeDir: this.scopeDir });
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
        this.maybeTerminate();
      };
      this.worker.onerror = (event) => {
        logger.warn('[DATA_HISTORY][OPFS] Storage worker crashed, rejecting pending requests', event.message);
        const error = new Error(`Data history storage worker error: ${event.message || 'unknown'}`);
        const pending = Array.from(this.pendingRequests.values());
        this.pendingRequests.clear();
        pending.forEach(({ reject }) => reject(error));
        // The crashed worker took its open-stream state with it, so those ids can never be released
        // by close()/abort(). Leaving them registered would block `maybeTerminate` forever and leak
        // the respawned worker after a backend switch.
        this.openStreamIds.clear();
        this.worker?.terminate();
        this.worker = null;
      };
    }
    return this.worker;
  }

  private request<TBody extends HistoryWorkerRequestBody>(
    message: TBody,
    transfer?: Transferable[],
  ): Promise<HistoryWorkerResultByOp[TBody['op']]> {
    return new Promise((resolve, reject) => {
      try {
        const worker = this.getWorker();
        const id = this.nextRequestId++;
        // Register only after a successful postMessage — if it throws synchronously (e.g. DataCloneError
        // or a detached transfer buffer) there is no worker reply coming, so a pre-registered entry
        // would leak. The worker's onmessage can't run until this call stack unwinds, so this is safe.
        worker.postMessage({ ...message, id }, transfer || []);
        // The worker replies with `unknown`; this is the single point where the untyped wire value
        // becomes the op's declared result type.
        this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });
      } catch (ex) {
        reject(ex instanceof Error ? ex : new Error(String(ex)));
      }
    });
  }
}
