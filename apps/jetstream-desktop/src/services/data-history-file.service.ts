import { DataHistoryFileOpRequest, DataHistoryFileOpResult } from '@jetstream/desktop/types';
import { app } from 'electron';
import logger from 'electron-log';
import { createWriteStream, promises as fs, WriteStream } from 'fs';
import { dirname, isAbsolute, join, resolve, sep } from 'path';
import { finished } from 'stream/promises';
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

interface OpenStreamState {
  fileStream: WriteStream;
  gzip?: Gzip;
  bytesWritten: number;
  absolutePath: string;
  /** `webContents.id` of the renderer that opened the stream — see `abortDataHistoryStreamsForSender` */
  ownerId?: number;
  /** Set once `handleStreamError` has torn this stream down (guards duplicate 'error' events) */
  errored?: boolean;
}

let nextStreamId = 1;
const openStreams = new Map<number, OpenStreamState>();
let relocationInProgress = false;

/**
 * Mutating ops must not interleave with a folder relocation: the relocation's copy can take many
 * seconds on a large history, and a file written under the source folder mid-copy is silently lost
 * when the source is removed (POSIX keeps writing to the unlinked inode and reports success).
 */
function assertNoRelocationInProgress(): void {
  if (relocationInProgress) {
    throw new Error('The data history folder is being moved — try again when the move completes');
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
const erroredStreams = new Map<number, { error: Error; ownerId?: number }>();

function splitRelativePath(relativePath: string): string[] {
  const segments = relativePath.split('/');
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || !SAFE_SEGMENT_REGEX.test(segment)) {
      throw new Error(`Invalid path segment in: ${relativePath}`);
    }
  }
  return segments;
}

function getBaseDir(): string {
  return getUserPreferences().dataHistoryFolder || join(app.getPath('userData'), HISTORY_DIR_NAME);
}

function resolveRelativePath(relativePath: string): string {
  return join(getBaseDir(), ...splitRelativePath(relativePath));
}

function writeToStream(stream: NodeJS.WritableStream, buffer: Buffer): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    stream.write(buffer, (err) => (err ? rejectPromise(err) : resolvePromise()));
  });
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
  openStreams.delete(streamId);
  erroredStreams.set(streamId, { error, ownerId: state.ownerId });
  state.gzip?.destroy();
  state.fileStream.destroy();
  void fs.rm(state.absolutePath, { force: true }).catch(() => undefined);
}

/**
 * Collect (and clear) the parked error for a stream torn down by `handleStreamError`. Owner-checked
 * like `getStream` so another window can neither consume nor clear a stream's parked error.
 */
function takeStreamError(streamId: number, senderId?: number): Error | undefined {
  const parked = erroredStreams.get(streamId);
  if (!parked || (parked.ownerId !== undefined && parked.ownerId !== senderId)) {
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
    if (state.ownerId !== ownerId) {
      continue;
    }
    openStreams.delete(streamId);
    state.gzip?.destroy();
    state.fileStream.destroy();
    await fs.rm(state.absolutePath, { force: true }).catch(() => undefined);
  }
  for (const [streamId, parked] of Array.from(erroredStreams.entries())) {
    if (parked.ownerId === ownerId) {
      erroredStreams.delete(streamId);
    }
  }
}

/** Temp-file + rename so a crash mid-write can never leave a truncated file at the target path */
async function writeFileAtomic(absolutePath: string, data: Buffer): Promise<void> {
  const tempPath = `${absolutePath}.tmp`;
  try {
    await fs.writeFile(tempPath, data);
    await fs.rename(tempPath, absolutePath);
  } catch (ex) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw ex;
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

export async function handleDataHistoryOp(
  request: DataHistoryFileOpRequest,
  context?: { senderId?: number },
): Promise<DataHistoryFileOpResult<DataHistoryFileOpRequest>> {
  switch (request.op) {
    case 'init': {
      await fs.mkdir(getBaseDir(), { recursive: true });
      return undefined;
    }
    case 'write-file': {
      assertNoRelocationInProgress();
      const absolutePath = resolveRelativePath(request.path);
      await fs.mkdir(dirname(absolutePath), { recursive: true });
      const input = Buffer.from(request.bytes);
      const output = request.gzip ? gzipSync(input) : input;
      await writeFileAtomic(absolutePath, output);
      invalidateDirectorySizeCache();
      return { bytes: output.byteLength };
    }
    case 'open-stream': {
      assertNoRelocationInProgress();
      const absolutePath = resolveRelativePath(request.path);
      await fs.mkdir(dirname(absolutePath), { recursive: true });
      const fileStream = createWriteStream(absolutePath);
      const state: OpenStreamState = { fileStream, bytesWritten: 0, absolutePath, ownerId: context?.senderId };
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
    }
    case 'stream-write': {
      const streamError = takeStreamError(request.streamId, context?.senderId);
      if (streamError) {
        throw streamError;
      }
      const state = getStream(request.streamId, context?.senderId);
      const buffer = Buffer.from(request.bytes);
      if (state.gzip) {
        await writeToStream(state.gzip, buffer);
      } else {
        await writeToStream(state.fileStream, buffer);
        state.bytesWritten += buffer.length;
      }
      return undefined;
    }
    case 'stream-close': {
      const streamError = takeStreamError(request.streamId, context?.senderId);
      if (streamError) {
        throw streamError;
      }
      const state = getStream(request.streamId, context?.senderId);
      openStreams.delete(request.streamId);
      if (state.gzip) {
        state.gzip.end();
      } else {
        state.fileStream.end();
      }
      // A late fs error is safe here: the 'error' listeners prevent an uncaught exception and
      // `finished` rejects (never hangs) when the stream is destroyed with an error.
      await finished(state.fileStream);
      invalidateDirectorySizeCache();
      return { bytes: state.bytesWritten };
    }
    case 'stream-abort': {
      // A stream torn down by an fs error was already destroyed and its partial file removed
      takeStreamError(request.streamId, context?.senderId);
      const state = openStreams.get(request.streamId);
      if (state && (state.ownerId === undefined || state.ownerId === context?.senderId)) {
        openStreams.delete(request.streamId);
        state.gzip?.destroy();
        state.fileStream.destroy();
        await fs.rm(state.absolutePath, { force: true }).catch(() => undefined);
        invalidateDirectorySizeCache();
      }
      return undefined;
    }
    case 'read-file': {
      const buffer = await fs.readFile(resolveRelativePath(request.path));
      return new Uint8Array(request.gunzip ? gunzipSync(buffer) : buffer);
    }
    case 'delete-dir': {
      assertNoRelocationInProgress();
      const absoluteDirPath = resolveRelativePath(request.path);
      assertNoOpenStreamsUnder(absoluteDirPath);
      await fs.rm(absoluteDirPath, { recursive: true, force: true });
      invalidateDirectorySizeCache();
      return undefined;
    }
    case 'list-entry-dirs': {
      const dirs: Array<{ orgFolder: string; entryKey: string }> = [];
      const baseDir = getBaseDir();
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
    }
    case 'estimate': {
      return { usageBytes: await getCachedDirectorySize() };
    }
  }
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
 * move) — a failed copy rethrows and leaves the current folder authoritative and intact.
 */
export async function setDataHistoryFolderPath(folderPath: string): Promise<string> {
  // The path arrives from the renderer — never trust it to be a real user-picked folder. The IPC
  // layer additionally requires it to match a value the OS folder dialog returned this session.
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
  if (openStreams.size > 0) {
    throw new Error('Cannot move the history folder while history files are being written — try again when the current data load finishes');
  }
  // The copy below can run for many seconds, so the openStreams check above is only a point-in-time
  // check — this flag makes every mutating op reject until the relocation settles. The pair is
  // race-free: IPC handlers run on the main thread, so nothing interleaves between check and set.
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
      try {
        await fs.rm(current, { recursive: true, force: true });
      } catch (ex) {
        // The copy is complete so the new location is authoritative; leftover source files are harmless
        logger.warn('[DATA_HISTORY] Unable to remove the previous history folder after copying', ex);
      }
    } else {
      await fs.mkdir(target, { recursive: true });
    }
    updateUserPreferences({ dataHistoryFolder: target });
    invalidateDirectorySizeCache();
    return target;
  } finally {
    relocationInProgress = false;
  }
}

function getStream(streamId: number, senderId?: number): OpenStreamState {
  const state = openStreams.get(streamId);
  // An owner mismatch reads exactly like an unknown id: stream ids are small sequential numbers
  // shared across all windows, so one window must not be able to write into, close, or abort a
  // stream another window opened.
  if (!state || (state.ownerId !== undefined && state.ownerId !== senderId)) {
    throw new Error(`Unknown streamId ${streamId}`);
  }
  return state;
}

/**
 * `getDirectorySize` stats every file under the history root, which on a paid-tier folder can be
 * tens of thousands of files. The settings page reads storage health on mount and after every
 * storage action, so the walk is cached: invalidated by any write/delete we perform, and expired on
 * a short timer so out-of-band changes (the user deleting files themselves) are still picked up.
 */
const DIRECTORY_SIZE_CACHE_MS = 60_000;
let cachedDirectorySize: { basePath: string; bytes: number; computedAt: number } | null = null;

function invalidateDirectorySizeCache(): void {
  cachedDirectorySize = null;
}

async function getCachedDirectorySize(): Promise<number> {
  const basePath = getBaseDir();
  if (cachedDirectorySize?.basePath === basePath && Date.now() - cachedDirectorySize.computedAt < DIRECTORY_SIZE_CACHE_MS) {
    return cachedDirectorySize.bytes;
  }
  const bytes = await getDirectorySize(basePath);
  cachedDirectorySize = { basePath, bytes, computedAt: Date.now() };
  return bytes;
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await getDirectorySize(fullPath);
    } else if (entry.isFile()) {
      const stat = await fs.stat(fullPath).catch(() => null);
      total += stat?.size ?? 0;
    }
  }
  return total;
}
