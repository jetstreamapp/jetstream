import { DataHistoryFileOpRequest, DataHistoryFileOpResult, DataHistoryFileOpResultByOp } from '@jetstream/desktop/types';
import { app } from 'electron';
import logger from 'electron-log';
import { createWriteStream, promises as fs, WriteStream } from 'fs';
import { dirname, isAbsolute, join, resolve, sep } from 'path';
import { finished } from 'stream/promises';
import writeFileAtomic from 'write-file-atomic';
import { createGzip, gunzipSync, Gzip, gzipSync } from 'zlib';
import { getUserPreferences, updateUserPreferences } from './persistence.service';

/**
 * Native filesystem backing for Data History (renderer counterpart: `NativeFsFileStore` in
 * `@jetstream/ui/data-history`). Executes the same op-based protocol the renderer's OPFS worker
 * uses, but with Node fs + zlib under a user-configurable base directory.
 *
 * Paths from the renderer are RELATIVE (`<orgFolder>/<entryKey>/<fileName>`) and validated
 * segment-by-segment so a corrupted request can never escape the base directory.
 */

const SAFE_SEGMENT_REGEX = /^[a-zA-Z0-9._-]+$/;
const HISTORY_DIR_NAME = 'data-history';
const RELOCATED_DIR_NAME = 'jetstream-data-history';

/**
 * Identifies the renderer window an op came from. Every op arrives through the IPC handler, which
 * always supplies `event.sender.id` — there is no such thing as an unowned stream, and the owner
 * check is what stops one window from writing into or closing a stream another window opened.
 */
export interface DataHistoryOpContext {
  senderId: number;
}

interface OpenStreamState {
  fileStream: WriteStream;
  gzip?: Gzip;
  bytesWritten: number;
  absolutePath: string;
  /** `webContents.id` of the renderer that opened the stream — see `abortDataHistoryStreamsForSender` */
  ownerId: number;
  /** Set once `handleStreamError` has torn this stream down (guards duplicate 'error' events) */
  errored?: boolean;
}

let nextStreamId = 1;
const openStreams = new Map<number, OpenStreamState>();
let relocationInProgress = false;
/** Mutating ops currently between their relocation check and their last filesystem write — see `withMutationGuard` */
let inFlightMutations = 0;

/**
 * Mutating ops must not interleave with a folder relocation: the relocation's copy can take many
 * seconds on a large history, and a file written under the source folder mid-copy is silently lost
 * when the source is removed (POSIX keeps writing to the unlinked inode and reports success).
 *
 * Checked once up front AND counted for the op's whole duration: an op that passed the check and is
 * awaiting its first `mkdir` holds no open stream yet, so the relocation's `openStreams` check alone
 * would let it start while the copy is already running. IPC handlers run on the main thread, so the
 * check-and-increment here and the check-and-set in `setDataHistoryFolderPath` never interleave.
 */
async function withMutationGuard<T>(task: () => Promise<T>): Promise<T> {
  if (relocationInProgress) {
    throw new Error('The data history folder is being moved — try again when the move completes');
  }
  inFlightMutations++;
  try {
    return await task();
  } finally {
    inFlightMutations--;
  }
}

/**
 * Deleting a directory out from under an open write stream orphans that stream's file the same way
 * (writes keep "succeeding" into an unlinked inode). Checked in MAIN because the renderer-side
 * in-flight guards cannot see streams owned by another window.
 */
function assertNoOpenStreamsUnder(absoluteDirPath: string): void {
  for (const state of openStreams.values()) {
    if (state.absolutePath.startsWith(absoluteDirPath + sep)) {
      throw new Error('This entry is still being written — try again when the current load finishes');
    }
  }
}
// Errors from streams torn down by `handleStreamError`, parked until the renderer's next op on
// that stream collects them. The renderer always follows a failed write with close/abort, so
// entries here are short-lived.
const erroredStreams = new Map<number, { error: Error; ownerId: number }>();

function splitRelativePath(relativePath: string): string[] {
  const segments = relativePath.split('/');
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || !SAFE_SEGMENT_REGEX.test(segment)) {
      throw new Error(`Invalid path segment in: ${relativePath}`);
    }
  }
  return segments;
}

/**
 * The history CONTAINER: one folder per install, holding a subfolder per Jetstream account. This is
 * what the folder preference points at and what relocation moves — never where files are read or
 * written. Use {@link getScopedBaseDir} for that.
 *
 * The preference is only ever written by `setDataHistoryFolderPath` (the IPC preferences handler
 * strips it), but the file it lives in is plain JSON on disk — a relative or empty value is treated
 * as unset rather than resolved against the process cwd.
 */
function getBaseDir(): string {
  const configured = getUserPreferences().dataHistoryFolder;
  return configured && isAbsolute(configured) ? configured : join(app.getPath('userData'), HISTORY_DIR_NAME);
}

/**
 * Per-user subfolder of the container, set by the `init` op.
 *
 * `<userData>` is per-OS-user but NOT per Jetstream account, so several accounts signing in on one
 * machine would otherwise share a single history tree — where each one's retention sweep deletes
 * the others' entries as orphans and `reindex` imports their manifests into its own index. Held in
 * a module variable because a user switch reloads the whole desktop app, so a single active account
 * per main process is an invariant, not an assumption about timing.
 */
let currentScopeDir: string | null = null;

function requireScopeDir(): string {
  if (!currentScopeDir) {
    throw new Error('Data history storage has not been initialized for a user');
  }
  return currentScopeDir;
}

function getScopedBaseDir(): string {
  return join(getBaseDir(), requireScopeDir());
}

function resolveRelativePath(relativePath: string): string {
  return join(getScopedBaseDir(), ...splitRelativePath(relativePath));
}

function writeToStream(stream: NodeJS.WritableStream, buffer: Buffer): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    stream.write(buffer, (err) => (err ? rejectPromise(err) : resolvePromise()));
  });
}

/**
 * The ONE teardown for a stream that will not complete — an fs error, an explicit abort, or its
 * renderer going away: forget it, destroy the Node streams (releasing the descriptor), and discard
 * the partial file so nothing untracked is left inside a live entry's directory.
 */
function discardStream(streamId: number, state: OpenStreamState): Promise<void> {
  openStreams.delete(streamId);
  state.gzip?.destroy();
  state.fileStream.destroy();
  return fs.rm(state.absolutePath, { force: true }).catch(() => undefined);
}

/**
 * A write-stream 'error' (disk full, folder deleted, ...) with no listener would surface as an
 * uncaught exception in the main process. Tear the stream down, discard the partial file, and
 * park the error for the renderer's next op on this stream to collect.
 */
function handleStreamError(streamId: number, state: OpenStreamState, error: Error): void {
  if (state.errored) {
    return;
  }
  state.errored = true;
  logger.warn('[DATA_HISTORY] History write stream failed', state.absolutePath, error);
  erroredStreams.set(streamId, { error, ownerId: state.ownerId });
  void discardStream(streamId, state);
}

/**
 * Collect (and clear) the parked error for a stream torn down by `handleStreamError`. Owner-checked
 * like `getStream` so another window can neither consume nor clear a stream's parked error.
 */
function takeStreamError(streamId: number, senderId: number): Error | undefined {
  const parked = erroredStreams.get(streamId);
  if (!parked || parked.ownerId !== senderId) {
    return undefined;
  }
  erroredStreams.delete(streamId);
  return parked.error;
}

/**
 * Tear down every stream opened by a renderer that is going away. A renderer that reloads or closes
 * mid-capture never sends `stream-close`/`stream-abort`, so without this the file handle stays open
 * for the life of the process — leaking a descriptor, keeping a truncated partial file on disk, and
 * making `setDataHistoryFolderPath` reject forever ("history files are being written").
 */
export async function abortDataHistoryStreamsForSender(ownerId: number): Promise<void> {
  for (const [streamId, state] of Array.from(openStreams.entries())) {
    if (state.ownerId === ownerId) {
      await discardStream(streamId, state);
    }
  }
  for (const [streamId, parked] of Array.from(erroredStreams.entries())) {
    if (parked.ownerId === ownerId) {
      erroredStreams.delete(streamId);
    }
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * One handler per op, typed so every implementation is CHECKED against exactly its op's declared
 * result shape. A single switch typed as the union of all result shapes would leave each `return`
 * unchecked while the renderer trusts the exact per-op shape.
 */
const opHandlers: {
  [K in DataHistoryFileOpRequest['op']]: (
    request: Extract<DataHistoryFileOpRequest, { op: K }>,
    context: DataHistoryOpContext,
  ) => Promise<DataHistoryFileOpResultByOp[K]>;
} = {
  init: async (request) => {
    // Validated like any other path segment — it arrives from the renderer and is joined onto the
    // history folder, so a crafted value must not be able to escape it.
    const segments = splitRelativePath(request.scopeDir);
    if (segments.length !== 1) {
      throw new Error(`Invalid data history user scope: ${request.scopeDir}`);
    }
    currentScopeDir = segments[0];
    await fs.mkdir(getScopedBaseDir(), { recursive: true });
  },
  'write-file': (request) =>
    withMutationGuard(async () => {
      const absolutePath = resolveRelativePath(request.path);
      await fs.mkdir(dirname(absolutePath), { recursive: true });
      const input = Buffer.from(request.bytes);
      const output = request.gzip ? gzipSync(input) : input;
      // Temp-file + fsync + rename (the same helper the preferences file uses), so a crash mid-write
      // can never leave a truncated file at the target path
      await writeFileAtomic(absolutePath, output);
      return { bytes: output.byteLength };
    }),
  'open-stream': (request, { senderId }) =>
    withMutationGuard(async () => {
      const absolutePath = resolveRelativePath(request.path);
      await fs.mkdir(dirname(absolutePath), { recursive: true });
      const fileStream = createWriteStream(absolutePath);
      const state: OpenStreamState = { fileStream, bytesWritten: 0, absolutePath, ownerId: senderId };
      const streamId = nextStreamId++;
      fileStream.on('error', (error) => handleStreamError(streamId, state, error));
      if (request.gzip) {
        const gzip = createGzip();
        gzip.on('data', (chunk: Buffer) => {
          state.bytesWritten += chunk.length;
        });
        gzip.on('error', (error) => handleStreamError(streamId, state, error));
        gzip.pipe(fileStream);
        state.gzip = gzip;
      }
      openStreams.set(streamId, state);
      return { streamId };
    }),
  'stream-write': async (request, { senderId }) => {
    const streamError = takeStreamError(request.streamId, senderId);
    if (streamError) {
      throw streamError;
    }
    const state = getStream(request.streamId, senderId);
    const buffer = Buffer.from(request.bytes);
    if (state.gzip) {
      await writeToStream(state.gzip, buffer);
    } else {
      await writeToStream(state.fileStream, buffer);
      state.bytesWritten += buffer.length;
    }
  },
  'stream-close': async (request, { senderId }) => {
    const streamError = takeStreamError(request.streamId, senderId);
    if (streamError) {
      throw streamError;
    }
    const state = getStream(request.streamId, senderId);
    openStreams.delete(request.streamId);
    if (state.gzip) {
      state.gzip.end();
    } else {
      state.fileStream.end();
    }
    // A late fs error is safe here: the 'error' listeners prevent an uncaught exception and
    // `finished` rejects (never hangs) when the stream is destroyed with an error.
    await finished(state.fileStream);
    return { bytes: state.bytesWritten };
  },
  'stream-abort': async (request, { senderId }) => {
    // A stream torn down by an fs error was already destroyed and its partial file removed
    takeStreamError(request.streamId, senderId);
    const state = openStreams.get(request.streamId);
    if (state && state.ownerId === senderId) {
      await discardStream(request.streamId, state);
    }
  },
  'read-file': async (request) => {
    const buffer = await fs.readFile(resolveRelativePath(request.path));
    const output = request.gunzip ? gunzipSync(buffer) : buffer;
    // Capped here rather than in the renderer so an oversized payload is not cloned across IPC in
    // full just to be thrown away. A gzip stream cannot be read from an offset, so the inflate
    // itself is unavoidable — the plain-file path uses `read-file-chunk`, which never reads it all.
    return new Uint8Array(request.maxBytes == null ? output : output.subarray(0, request.maxBytes));
  },
  'read-file-chunk': async (request) => {
    const absolutePath = resolveRelativePath(request.path);
    const { size } = await fs.stat(absolutePath);
    // Clamped rather than validated: the renderer walks to EOF by comparing against `totalBytes`, so
    // a request that runs past the end is the normal last iteration, not an error
    const length = Math.max(0, Math.min(request.length, size - request.offset));
    if (length === 0) {
      return { bytes: new Uint8Array(0), totalBytes: size };
    }
    const fileHandle = await fs.open(absolutePath, 'r');
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await fileHandle.read(buffer, 0, length, request.offset);
      return { bytes: new Uint8Array(buffer.subarray(0, bytesRead)), totalBytes: size };
    } finally {
      await fileHandle.close();
    }
  },
  'delete-dir': (request) =>
    withMutationGuard(async () => {
      const absoluteDirPath = resolveRelativePath(request.path);
      assertNoOpenStreamsUnder(absoluteDirPath);
      await fs.rm(absoluteDirPath, { recursive: true, force: true });
    }),
  'list-entry-dirs': async () => {
    const dirs: Array<{ orgFolder: string; entryKey: string }> = [];
    const baseDir = getScopedBaseDir();
    const orgFolders = await fs.readdir(baseDir, { withFileTypes: true }).catch(() => []);
    for (const orgFolder of orgFolders) {
      if (!orgFolder.isDirectory()) {
        continue;
      }
      const entryDirs = await fs.readdir(join(baseDir, orgFolder.name), { withFileTypes: true }).catch(() => []);
      for (const entryDir of entryDirs) {
        if (entryDir.isDirectory()) {
          dirs.push({ orgFolder: orgFolder.name, entryKey: entryDir.name });
        }
      }
    }
    return { dirs };
  },
};

export async function handleDataHistoryOp(
  request: DataHistoryFileOpRequest,
  context: DataHistoryOpContext,
): Promise<DataHistoryFileOpResult<DataHistoryFileOpRequest>> {
  // TypeScript cannot connect `request.op`'s narrowing to the map's per-op signature from outside
  // the map, so dispatch through one localized widening cast.
  const handler = opHandlers[request.op] as (
    request: DataHistoryFileOpRequest,
    context: DataHistoryOpContext,
  ) => Promise<DataHistoryFileOpResult<DataHistoryFileOpRequest>>;
  return await handler(request, context);
}

export function getDataHistoryFolderPath(): string {
  return getBaseDir();
}

/**
 * Move the history base directory to `<folderPath>/jetstream-data-history` and persist the
 * preference. Copy-then-delete so cross-volume moves work. Relative entry paths in the renderer's
 * rows are untouched — they resolve against the new base.
 *
 * The preference is only repointed after a fully successful copy (or when there is nothing to
 * move) — a failed copy rethrows and leaves the current folder authoritative and intact. It IS
 * repointed BEFORE the old folder is removed: the repoint is the point of no return, after which
 * every read resolves to the complete copy. Removing first would leave reads (which are not guarded
 * by the relocation flag) resolving into a folder being deleted, and a process exit mid-removal
 * would leave the preference pointing at a half-deleted folder with the complete copy unreferenced.
 */
export async function setDataHistoryFolderPath(folderPath: string): Promise<string> {
  // The path normally comes straight from the main-process folder dialog, but validate anyway
  // (defense in depth) in case a future caller passes something else.
  if (typeof folderPath !== 'string' || folderPath.trim().length === 0 || !isAbsolute(folderPath)) {
    throw new Error('The data history folder must be an absolute path');
  }
  const target = join(folderPath, RELOCATED_DIR_NAME);
  const current = getBaseDir();
  if (resolve(target) === resolve(current)) {
    return current;
  }
  if (resolve(target).startsWith(resolve(current) + sep)) {
    throw new Error('The new data history folder cannot be inside the current one');
  }
  if (openStreams.size > 0 || inFlightMutations > 0) {
    throw new Error('Cannot move the history folder while history files are being written — try again when the current data load finishes');
  }
  // The copy below can run for many seconds, so the check above is only a point-in-time check —
  // this flag makes every mutating op reject until the relocation settles. The pair is race-free:
  // IPC handlers run on the main thread, so nothing interleaves between check and set.
  relocationInProgress = true;
  try {
    const hasExistingHistory = await pathExists(current);
    if (hasExistingHistory) {
      const targetExistedBefore = await pathExists(target);
      try {
        await fs.cp(current, target, { recursive: true });
      } catch (ex) {
        logger.error('[DATA_HISTORY] Unable to copy history to the new folder, keeping the current folder', ex);
        // Clean up the partial copy, but never touch a folder that existed before we started
        if (!targetExistedBefore) {
          await fs.rm(target, { recursive: true, force: true }).catch(() => undefined);
        }
        throw ex;
      }
      // The copy is complete, so the new location is authoritative from here on
      updateUserPreferences({ dataHistoryFolder: target });
      try {
        await fs.rm(current, { recursive: true, force: true });
      } catch (ex) {
        // Leftover source files are harmless — nothing resolves there any more
        logger.warn('[DATA_HISTORY] Unable to remove the previous history folder after copying', ex);
      }
    } else {
      await fs.mkdir(target, { recursive: true });
      updateUserPreferences({ dataHistoryFolder: target });
    }
    return target;
  } finally {
    relocationInProgress = false;
  }
}

function getStream(streamId: number, senderId: number): OpenStreamState {
  const state = openStreams.get(streamId);
  // An owner mismatch reads exactly like an unknown id: stream ids are small sequential numbers
  // shared across all windows, so one window must not be able to write into, close, or abort a
  // stream another window opened.
  if (!state || state.ownerId !== senderId) {
    throw new Error(`Unknown streamId ${streamId}`);
  }
  return state;
}
