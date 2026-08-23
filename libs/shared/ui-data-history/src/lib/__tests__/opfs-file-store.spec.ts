import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDataHistoryErrorDetails } from '../failure-reporter';
import { OpfsFileStore } from '../file-store/opfs-file-store';

/**
 * Stands in for the real storage worker so the store can be driven through its `onerror` path without
 * OPFS (which jsdom does not implement) or a real module load.
 */
class StubWorker {
  static instances: StubWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    StubWorker.instances.push(this);
  }
}

const originalWorker = globalThis.Worker;

/**
 * Starts a request so there is a pending promise for the crash to reject, and hands back the worker
 * that request spawned.
 */
function startPendingRequest() {
  const store = new OpfsFileStore('u-0123456789abcdef');
  const pending = store.init();
  const worker = StubWorker.instances.at(-1);
  if (!worker) {
    throw new Error('Expected the store to spawn a worker');
  }
  return { store, pending, worker };
}

describe('OpfsFileStore worker error handling', () => {
  beforeEach(() => {
    StubWorker.instances = [];
    globalThis.Worker = StubWorker as unknown as typeof Worker;
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
  });

  it('reports the message and source location of an exception thrown inside the worker', async () => {
    const { pending, worker } = startPendingRequest();

    worker.onerror?.(
      new ErrorEvent('error', {
        message: 'Uncaught TypeError: handle.createSyncAccessHandle is not a function',
        filename: 'https://getjetstream.app/assets/history-storage.worker-abc123.js',
        lineno: 42,
        colno: 17,
      }),
    );

    await expect(pending).rejects.toThrow(
      'Data history storage worker error: Uncaught TypeError: handle.createSyncAccessHandle is not a function ' +
        '(https://getjetstream.app/assets/history-storage.worker-abc123.js:42:17)',
    );
  });

  // A module that fails to load fires a plain `error` Event with no message/filename/lineno/colno,
  // which is exactly the crash shape that used to report only "unknown".
  it('names the worker module when the error event carries no detail at all', async () => {
    const { pending, worker } = startPendingRequest();

    worker.onerror?.(new Event('error') as ErrorEvent);

    await expect(pending).rejects.toThrow('Data history storage worker error: worker module failed to load (./history-storage.worker.ts)');
  });

  it('attaches the crash detail to the rejected error so it reaches the error tracker', async () => {
    const { pending, worker } = startPendingRequest();

    worker.onerror?.(new ErrorEvent('error', { message: 'boom', filename: 'worker.js', lineno: 7, colno: 3 }));

    const error = await pending.catch((ex: unknown) => ex);
    expect(getDataHistoryErrorDetails(error)).toEqual({
      message: 'boom',
      filename: 'worker.js',
      lineno: 7,
      colno: 3,
      workerModule: undefined,
    });
  });

  it('terminates the crashed worker and spawns a fresh one for the next request', async () => {
    const { store, pending, worker } = startPendingRequest();

    worker.onerror?.(new Event('error') as ErrorEvent);
    await expect(pending).rejects.toThrow();
    expect(worker.terminate).toHaveBeenCalledTimes(1);

    const retry = store.init();
    expect(StubWorker.instances).toHaveLength(2);

    StubWorker.instances[1].onerror?.(new Event('error') as ErrorEvent);
    await expect(retry).rejects.toThrow();
  });
});
