import { DataHistoryFileOpRequest } from '@jetstream/desktop/types';
import { app } from 'electron';
import logger from 'electron-log';
import { createWriteStream, promises as fs, WriteStream } from 'fs';
import { dirname, join, resolve, sep } from 'path';
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
}

let nextStreamId = 1;
const openStreams = new Map<number, OpenStreamState>();

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

export async function handleDataHistoryOp(request: DataHistoryFileOpRequest): Promise<unknown> {
  switch (request.op) {
    case 'init': {
      await fs.mkdir(getBaseDir(), { recursive: true });
      return undefined;
    }
    case 'write-file': {
      const absolutePath = resolveRelativePath(requirePath(request));
      await fs.mkdir(dirname(absolutePath), { recursive: true });
      const input = Buffer.from(requireBytes(request));
      const output = request.gzip ? gzipSync(input) : input;
      await fs.writeFile(absolutePath, output);
      return { bytes: output.byteLength };
    }
    case 'open-stream': {
      const absolutePath = resolveRelativePath(requirePath(request));
      await fs.mkdir(dirname(absolutePath), { recursive: true });
      const fileStream = createWriteStream(absolutePath);
      const state: OpenStreamState = { fileStream, bytesWritten: 0, absolutePath };
      if (request.gzip) {
        const gzip = createGzip();
        gzip.on('data', (chunk: Buffer) => {
          state.bytesWritten += chunk.length;
        });
        gzip.pipe(fileStream);
        state.gzip = gzip;
      }
      const streamId = nextStreamId++;
      openStreams.set(streamId, state);
      return { streamId };
    }
    case 'stream-write': {
      const state = getStream(request);
      const buffer = Buffer.from(requireBytes(request));
      if (state.gzip) {
        await writeToStream(state.gzip, buffer);
      } else {
        await writeToStream(state.fileStream, buffer);
        state.bytesWritten += buffer.length;
      }
      return undefined;
    }
    case 'stream-close': {
      const state = getStream(request);
      openStreams.delete(request.streamId as number);
      if (state.gzip) {
        state.gzip.end();
      } else {
        state.fileStream.end();
      }
      await finished(state.fileStream);
      return { bytes: state.bytesWritten };
    }
    case 'stream-abort': {
      const state = openStreams.get(request.streamId as number);
      if (state) {
        openStreams.delete(request.streamId as number);
        state.gzip?.destroy();
        state.fileStream.destroy();
        await fs.rm(state.absolutePath, { force: true }).catch(() => undefined);
      }
      return undefined;
    }
    case 'read-file': {
      const buffer = await fs.readFile(resolveRelativePath(requirePath(request)));
      return new Uint8Array(request.gunzip ? gunzipSync(buffer) : buffer);
    }
    case 'delete-dir': {
      await fs.rm(resolveRelativePath(requirePath(request)), { recursive: true, force: true });
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
      return { usageBytes: await getDirectorySize(getBaseDir()) };
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
 */
export async function setDataHistoryFolderPath(folderPath: string): Promise<string> {
  const target = join(folderPath, RELOCATED_DIR_NAME);
  const current = getBaseDir();
  if (resolve(target) === resolve(current)) {
    return current;
  }
  if (resolve(target).startsWith(resolve(current) + sep)) {
    throw new Error('The new data history folder cannot be inside the current one');
  }
  try {
    await fs.access(current);
    await fs.cp(current, target, { recursive: true });
    await fs.rm(current, { recursive: true, force: true });
  } catch (ex) {
    logger.warn('[DATA_HISTORY] No existing history to move, creating new folder', ex);
    await fs.mkdir(target, { recursive: true });
  }
  updateUserPreferences({ dataHistoryFolder: target });
  return target;
}

function requirePath(request: DataHistoryFileOpRequest): string {
  if (!request.path) {
    throw new Error(`Missing path for op ${request.op}`);
  }
  return request.path;
}

function requireBytes(request: DataHistoryFileOpRequest): Uint8Array {
  if (!request.bytes) {
    throw new Error(`Missing bytes for op ${request.op}`);
  }
  return request.bytes;
}

function getStream(request: DataHistoryFileOpRequest): OpenStreamState {
  const state = openStreams.get(request.streamId as number);
  if (!state) {
    throw new Error(`Unknown streamId ${request.streamId}`);
  }
  return state;
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
