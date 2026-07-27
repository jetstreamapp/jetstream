import { listEntryDirs, removeDir, removeFileQuietly, resolveFile } from './fs-handle-ops';
import { GzipEncoder, createGzipEncoder, gzipBytes } from './gzip-utils';
import { DATA_HISTORY_ROOT_DIR } from './path-utils';
import type {
  EstimateResult,
  HistoryWorkerRequest,
  HistoryWorkerResponse,
  ListEntryDirsResult,
  OpenStreamResult,
  StreamCloseResult,
  WriteFileResult,
} from './worker-messages';

/**
 * Dedicated worker that owns ALL OPFS I/O for Data History.
 *
 * Writes use `FileSystemSyncAccessHandle` because it is the only write API supported across every
 * target browser (Safari added main-thread `createWritable` far later than Chrome/Firefox), and
 * sync access handles are worker-only — which is why this worker exists. gzip runs in here too so
 * the main thread only ever hands over raw chunks.
 *
 * The directory-tree walking and gzip mechanics are shared with the user-chosen-folder store
 * (`fs-handle-ops` / `gzip-utils`); only the write API differs. Every runtime import here is
 * dependency-free, so the emitted worker bundle stays a single small chunk in every app's Vite build.
 */

/**
 * Minimal typings for worker-only OPFS APIs. `createSyncAccessHandle` lives in TypeScript's
 * webworker lib, which cannot be combined with the DOM lib this project compiles against — so we
 * declare exactly what we use.
 */
interface OpfsSyncAccessHandle {
  write(buffer: Uint8Array, options?: { at?: number }): number;
  truncate(newSize: number): void;
  getSize(): number;
  flush(): void;
  close(): void;
}

interface OpfsFileHandle extends FileSystemFileHandle {
  createSyncAccessHandle(): Promise<OpfsSyncAccessHandle>;
}

interface HistoryWorkerScope {
  onmessage: ((event: MessageEvent<HistoryWorkerRequest>) => void) | null;
  postMessage(message: HistoryWorkerResponse, transfer?: Transferable[]): void;
}

interface OpenStreamState {
  accessHandle: OpfsSyncAccessHandle;
  bytesWritten: number;
  /** Present only for gzip streams */
  gzipEncoder?: GzipEncoder;
  path: string;
}

// globalThis === self in a worker; globalThis avoids the no-restricted-globals lint rule
const workerScope = globalThis as unknown as HistoryWorkerScope;

let rootDirPromise: Promise<FileSystemDirectoryHandle> | null = null;
const openStreams = new Map<number, OpenStreamState>();

function getRootDir(): Promise<FileSystemDirectoryHandle> {
  if (!rootDirPromise) {
    rootDirPromise = navigator.storage
      .getDirectory()
      .then((opfsRoot) => opfsRoot.getDirectoryHandle(DATA_HISTORY_ROOT_DIR, { create: true }));
    // Allow retry on failure rather than caching a rejected promise forever
    rootDirPromise.catch(() => {
      rootDirPromise = null;
    });
  }
  return rootDirPromise;
}

/** Exclusive write handle for a file — the only write API available in every target browser */
async function openSyncAccessHandle(relativePath: string): Promise<OpfsSyncAccessHandle> {
  const fileHandle = (await resolveFile<FileSystemFileHandle>(await getRootDir(), relativePath, true)) as OpfsFileHandle;
  return await fileHandle.createSyncAccessHandle();
}

/** Write a whole buffer to a sync access handle at `offset`, returning the bytes written */
function writeAt(accessHandle: OpfsSyncAccessHandle, bytes: Uint8Array, offset: number): number {
  let written = 0;
  while (written < bytes.byteLength) {
    written += accessHandle.write(bytes.subarray(written), { at: offset + written });
  }
  return written;
}

async function handleWriteFile(path: string, gzip: boolean, bytes: Uint8Array): Promise<WriteFileResult> {
  const output = gzip ? await gzipBytes(bytes) : bytes;
  const accessHandle = await openSyncAccessHandle(path);
  try {
    accessHandle.truncate(0);
    const written = writeAt(accessHandle, output, 0);
    accessHandle.flush();
    return { bytes: written };
  } finally {
    accessHandle.close();
  }
}

async function handleOpenStream(streamId: number, path: string, gzip: boolean): Promise<OpenStreamResult> {
  if (openStreams.has(streamId)) {
    throw new Error(`Duplicate streamId ${streamId}`);
  }
  const accessHandle = await openSyncAccessHandle(path);
  accessHandle.truncate(0);

  const state: OpenStreamState = { accessHandle, bytesWritten: 0, path };
  if (gzip) {
    state.gzipEncoder = createGzipEncoder((chunk) => {
      state.bytesWritten += writeAt(accessHandle, chunk, state.bytesWritten);
    });
  }

  openStreams.set(streamId, state);
  return { streamId };
}

function getStream(streamId: number): OpenStreamState {
  const state = openStreams.get(streamId);
  if (!state) {
    throw new Error(`Unknown streamId ${streamId}`);
  }
  return state;
}

async function handleStreamWrite(streamId: number, bytes: Uint8Array): Promise<void> {
  const state = getStream(streamId);
  if (state.gzipEncoder) {
    await state.gzipEncoder.write(bytes);
  } else {
    state.bytesWritten += writeAt(state.accessHandle, bytes, state.bytesWritten);
  }
}

async function handleStreamClose(streamId: number): Promise<StreamCloseResult> {
  const state = getStream(streamId);
  try {
    await state.gzipEncoder?.close();
    state.accessHandle.flush();
    openStreams.delete(streamId);
    try {
      state.accessHandle.close();
    } catch {
      // already closed
    }
    return { bytes: state.bytesWritten };
  } catch (ex) {
    // A failed close (e.g. quota exhausted flushing the gzip trailer) must clean up like an abort:
    // forget the stream, release the lock, discard the partial file. The stream cannot stay in
    // `openStreams` (the caller's follow-up abort may never arrive), and forgetting it WITHOUT
    // removing the file would leak an untracked partial file inside a live entry's directory —
    // invisible to the orphan sweep, and charged against the very quota that just ran out.
    openStreams.delete(streamId);
    try {
      state.accessHandle.close();
    } catch {
      // already closed
    }
    await removeFileQuietly(await getRootDir(), state.path);
    throw ex;
  }
}

async function handleStreamAbort(streamId: number): Promise<void> {
  const state = openStreams.get(streamId);
  if (!state) {
    return;
  }
  openStreams.delete(streamId);
  await state.gzipEncoder?.abort();
  try {
    state.accessHandle.close();
  } catch {
    // best-effort
  }
  await removeFileQuietly(await getRootDir(), state.path);
}

async function handleReadFile(path: string, gunzip: boolean): Promise<Blob> {
  const fileHandle = await resolveFile<FileSystemFileHandle>(await getRootDir(), path, false);
  const file = await fileHandle.getFile();
  if (!gunzip) {
    return file;
  }
  const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).blob();
}

async function handleEstimate(): Promise<EstimateResult> {
  const estimate = await navigator.storage.estimate();
  return { usageBytes: estimate.usage, quotaBytes: estimate.quota };
}

async function handleRequest(request: HistoryWorkerRequest): Promise<unknown> {
  switch (request.op) {
    case 'init': {
      await getRootDir();
      return undefined;
    }
    case 'write-file': {
      return await handleWriteFile(request.path, request.gzip, request.bytes);
    }
    case 'open-stream': {
      return await handleOpenStream(request.streamId, request.path, request.gzip);
    }
    case 'stream-write': {
      return await handleStreamWrite(request.streamId, request.bytes);
    }
    case 'stream-close': {
      return await handleStreamClose(request.streamId);
    }
    case 'stream-abort': {
      return await handleStreamAbort(request.streamId);
    }
    case 'read-file': {
      return await handleReadFile(request.path, request.gunzip);
    }
    case 'delete-dir': {
      return await removeDir(await getRootDir(), request.path);
    }
    case 'list-entry-dirs': {
      return { dirs: await listEntryDirs(await getRootDir()) } satisfies ListEntryDirsResult;
    }
    case 'estimate': {
      return await handleEstimate();
    }
  }
}

workerScope.onmessage = (event: MessageEvent<HistoryWorkerRequest>) => {
  const request = event.data;
  handleRequest(request)
    .then((result) => {
      workerScope.postMessage({ id: request.id, success: true, result });
    })
    .catch((ex: unknown) => {
      workerScope.postMessage({ id: request.id, success: false, error: ex instanceof Error ? ex.message : String(ex) });
    });
};
