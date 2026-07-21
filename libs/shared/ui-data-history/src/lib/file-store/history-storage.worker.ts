import { DATA_HISTORY_ROOT_DIR, splitRelativePath } from './path-utils';
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
 * sync access handles are worker-only — which is why this worker exists. gzip runs in here too
 * (native `CompressionStream`) so the main thread only ever hands over raw chunks.
 *
 * Kept dependency-free apart from `path-utils` (tiny) and type-only imports, so the emitted worker
 * bundle stays a single small chunk in every app's Vite build.
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
  gzipWriter?: WritableStreamDefaultWriter<BufferSource>;
  /** Drains the CompressionStream readable into the access handle; resolves when fully flushed */
  gzipPumpPromise?: Promise<void>;
  path: string;
}

// globalThis === self in a worker; globalThis avoids the no-restricted-globals lint rule
const workerScope = globalThis as unknown as HistoryWorkerScope;

let rootDirPromise: Promise<FileSystemDirectoryHandle> | null = null;
let nextStreamId = 1;
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

async function getDirHandle(dirSegments: string[], create: boolean): Promise<FileSystemDirectoryHandle> {
  let dir = await getRootDir();
  for (const segment of dirSegments) {
    dir = await dir.getDirectoryHandle(segment, { create });
  }
  return dir;
}

async function getFileHandle(relativePath: string, create: boolean): Promise<OpfsFileHandle> {
  const segments = splitRelativePath(relativePath);
  const fileName = segments[segments.length - 1];
  const dir = await getDirHandle(segments.slice(0, -1), create);
  return (await dir.getFileHandle(fileName, { create })) as OpfsFileHandle;
}

async function gzipBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function handleWriteFile(path: string, gzip: boolean, bytes: Uint8Array): Promise<WriteFileResult> {
  const fileHandle = await getFileHandle(path, true);
  const output = gzip ? await gzipBytes(bytes) : bytes;
  const accessHandle = await fileHandle.createSyncAccessHandle();
  try {
    accessHandle.truncate(0);
    let offset = 0;
    while (offset < output.byteLength) {
      offset += accessHandle.write(output.subarray(offset), { at: offset });
    }
    accessHandle.flush();
    return { bytes: offset };
  } finally {
    accessHandle.close();
  }
}

async function handleOpenStream(path: string, gzip: boolean): Promise<OpenStreamResult> {
  const fileHandle = await getFileHandle(path, true);
  const accessHandle = await fileHandle.createSyncAccessHandle();
  accessHandle.truncate(0);

  const state: OpenStreamState = { accessHandle, bytesWritten: 0, path };

  if (gzip) {
    const compression = new CompressionStream('gzip');
    state.gzipWriter = compression.writable.getWriter();
    const reader = compression.readable.getReader();
    state.gzipPumpPromise = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        let offset = 0;
        while (offset < value.byteLength) {
          offset += accessHandle.write(value.subarray(offset), { at: state.bytesWritten + offset });
        }
        state.bytesWritten += value.byteLength;
      }
    })();
    // Mark handled so an abort() mid-write never surfaces as an unhandled rejection; close() still
    // awaits the original promise and receives any error
    state.gzipPumpPromise.catch(() => undefined);
  }

  const streamId = nextStreamId++;
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
  if (state.gzipWriter) {
    // structured clone always yields a plain ArrayBuffer-backed view, never SharedArrayBuffer
    await state.gzipWriter.write(bytes as Uint8Array<ArrayBuffer>);
  } else {
    let offset = 0;
    while (offset < bytes.byteLength) {
      offset += state.accessHandle.write(bytes.subarray(offset), { at: state.bytesWritten + offset });
    }
    state.bytesWritten += bytes.byteLength;
  }
}

async function handleStreamClose(streamId: number): Promise<StreamCloseResult> {
  const state = getStream(streamId);
  openStreams.delete(streamId);
  try {
    if (state.gzipWriter) {
      await state.gzipWriter.close();
      await state.gzipPumpPromise;
    }
    state.accessHandle.flush();
    return { bytes: state.bytesWritten };
  } finally {
    state.accessHandle.close();
  }
}

async function handleStreamAbort(streamId: number): Promise<void> {
  const state = openStreams.get(streamId);
  if (!state) {
    return;
  }
  openStreams.delete(streamId);
  try {
    await state.gzipWriter?.abort();
  } catch {
    // writer may already be errored/closed
  }
  try {
    state.accessHandle.close();
  } catch {
    // best-effort
  }
  await deleteFileQuietly(state.path);
}

async function deleteFileQuietly(relativePath: string): Promise<void> {
  try {
    const segments = splitRelativePath(relativePath);
    const dir = await getDirHandle(segments.slice(0, -1), false);
    await dir.removeEntry(segments[segments.length - 1]);
  } catch {
    // best-effort cleanup of a partial file
  }
}

async function handleReadFile(path: string, gunzip: boolean): Promise<Blob> {
  const fileHandle = await getFileHandle(path, false);
  const file = await fileHandle.getFile();
  if (!gunzip) {
    return file;
  }
  const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).blob();
}

async function handleDeleteDir(path: string): Promise<void> {
  const segments = splitRelativePath(path);
  try {
    const parent = await getDirHandle(segments.slice(0, -1), false);
    await parent.removeEntry(segments[segments.length - 1], { recursive: true });
  } catch (ex) {
    if (ex instanceof DOMException && ex.name === 'NotFoundError') {
      return;
    }
    throw ex;
  }
}

async function handleListEntryDirs(): Promise<ListEntryDirsResult> {
  const dirs: Array<{ orgFolder: string; entryKey: string }> = [];
  const root = await getRootDir();
  for await (const orgHandle of root.values()) {
    if (orgHandle.kind !== 'directory') {
      continue;
    }
    for await (const entryHandle of orgHandle.values()) {
      if (entryHandle.kind === 'directory') {
        dirs.push({ orgFolder: orgHandle.name, entryKey: entryHandle.name });
      }
    }
  }
  return { dirs };
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
      return await handleOpenStream(request.path, request.gzip);
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
      return await handleDeleteDir(request.path);
    }
    case 'list-entry-dirs': {
      return await handleListEntryDirs();
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
