import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Exercises the native Data History file handler against the REAL filesystem (per-test temp
 * dirs) so copy/rename/stream semantics behave exactly as in production. Only the Electron and
 * preference boundaries are mocked.
 */

const mocks = vi.hoisted(() => ({
  userDataDir: '',
  preferences: {} as { dataHistoryFolder?: string },
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mocks.userDataDir),
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../persistence.service', () => ({
  getUserPreferences: vi.fn(() => mocks.preferences),
  updateUserPreferences: vi.fn((changes: { dataHistoryFolder?: string }) => Object.assign(mocks.preferences, changes)),
}));

const TEXT_ENCODER = new TextEncoder();
const GZIP_MAGIC = [0x1f, 0x8b];

async function importService() {
  return import('../data-history-file.service');
}

/** The service's default base dir: `<userData>/data-history` */
function defaultBaseDir() {
  return join(mocks.userDataDir, 'data-history');
}

vi.setConfig({ testTimeout: 30_000 });

describe('data-history-file.service', () => {
  let tempRoot: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    tempRoot = await fs.mkdtemp(join(tmpdir(), 'jetstream-data-history-test-'));
    mocks.userDataDir = join(tempRoot, 'user-data');
    mocks.preferences = {};
    await fs.mkdir(mocks.userDataDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  // ────────────────────────────────────────────────
  // write-file (atomic temp+rename)
  // ────────────────────────────────────────────────

  describe('write-file', () => {
    it('round-trips plain and gzip files and leaves no .tmp residue', async () => {
      const service = await importService();

      const plain = await service.handleDataHistoryOp({
        op: 'write-file',
        path: 'org-1/dh_a/manifest.json',
        gzip: false,
        bytes: TEXT_ENCODER.encode('{"a":1}'),
      });
      expect(plain).toEqual({ bytes: 7 });

      const content = 'Name\n' + Array.from({ length: 500 }, (_, i) => `row-${i}`).join('\n');
      const gzipped = (await service.handleDataHistoryOp({
        op: 'write-file',
        path: 'org-1/dh_a/input.csv.gz',
        gzip: true,
        bytes: TEXT_ENCODER.encode(content),
      })) as { bytes: number };
      expect(gzipped.bytes).toBeGreaterThan(0);
      expect(gzipped.bytes).toBeLessThan(content.length);

      const rawGzip = await fs.readFile(join(defaultBaseDir(), 'org-1', 'dh_a', 'input.csv.gz'));
      expect([rawGzip[0], rawGzip[1]]).toEqual(GZIP_MAGIC);
      expect(gunzipSync(rawGzip).toString('utf8')).toBe(content);

      const readBack = (await service.handleDataHistoryOp({
        op: 'read-file',
        path: 'org-1/dh_a/manifest.json',
        gunzip: false,
      })) as Uint8Array;
      expect(Buffer.from(readBack).toString('utf8')).toBe('{"a":1}');

      const entryFiles = await fs.readdir(join(defaultBaseDir(), 'org-1', 'dh_a'));
      expect(entryFiles.some((fileName) => fileName.endsWith('.tmp'))).toBe(false);
    });

    it('replaces an existing file in place', async () => {
      const service = await importService();
      await service.handleDataHistoryOp({
        op: 'write-file',
        path: 'org-1/dh_a/manifest.json',
        gzip: false,
        bytes: TEXT_ENCODER.encode('v1'),
      });
      await service.handleDataHistoryOp({
        op: 'write-file',
        path: 'org-1/dh_a/manifest.json',
        gzip: false,
        bytes: TEXT_ENCODER.encode('v2'),
      });
      const onDisk = await fs.readFile(join(defaultBaseDir(), 'org-1', 'dh_a', 'manifest.json'), 'utf8');
      expect(onDisk).toBe('v2');
    });

    it('rejects traversal paths', async () => {
      const service = await importService();
      await expect(
        service.handleDataHistoryOp({ op: 'write-file', path: '../evil.json', gzip: false, bytes: TEXT_ENCODER.encode('x') }),
      ).rejects.toThrow(/Invalid path segment/);
    });
  });

  // ────────────────────────────────────────────────
  // streaming writes
  // ────────────────────────────────────────────────

  describe('streams', () => {
    it('streams chunks into a plain file and reports bytes', async () => {
      const service = await importService();
      const { streamId } = (await service.handleDataHistoryOp({ op: 'open-stream', path: 'org-1/dh_b/results.csv', gzip: false })) as {
        streamId: number;
      };
      await service.handleDataHistoryOp({ op: 'stream-write', streamId, bytes: TEXT_ENCODER.encode('_id,_success\n') });
      await service.handleDataHistoryOp({ op: 'stream-write', streamId, bytes: TEXT_ENCODER.encode('001,true') });
      const closed = (await service.handleDataHistoryOp({ op: 'stream-close', streamId })) as { bytes: number };

      const onDisk = await fs.readFile(join(defaultBaseDir(), 'org-1', 'dh_b', 'results.csv'), 'utf8');
      expect(onDisk).toBe('_id,_success\n001,true');
      expect(closed.bytes).toBe(onDisk.length);
    });

    it('streams chunks into one valid gzip file', async () => {
      const service = await importService();
      const { streamId } = (await service.handleDataHistoryOp({ op: 'open-stream', path: 'org-1/dh_b/results.csv.gz', gzip: true })) as {
        streamId: number;
      };
      await service.handleDataHistoryOp({ op: 'stream-write', streamId, bytes: TEXT_ENCODER.encode('_id,_success\n') });
      await service.handleDataHistoryOp({ op: 'stream-write', streamId, bytes: TEXT_ENCODER.encode('001,true') });
      const closed = (await service.handleDataHistoryOp({ op: 'stream-close', streamId })) as { bytes: number };

      const rawGzip = await fs.readFile(join(defaultBaseDir(), 'org-1', 'dh_b', 'results.csv.gz'));
      expect([rawGzip[0], rawGzip[1]]).toEqual(GZIP_MAGIC);
      expect(gunzipSync(rawGzip).toString('utf8')).toBe('_id,_success\n001,true');
      expect(closed.bytes).toBe(rawGzip.byteLength);
    });

    it('stream-abort discards the partial file', async () => {
      const service = await importService();
      const { streamId } = (await service.handleDataHistoryOp({ op: 'open-stream', path: 'org-1/dh_c/results.csv', gzip: false })) as {
        streamId: number;
      };
      await service.handleDataHistoryOp({ op: 'stream-write', streamId, bytes: TEXT_ENCODER.encode('partial') });
      await service.handleDataHistoryOp({ op: 'stream-abort', streamId });
      await expect(fs.access(join(defaultBaseDir(), 'org-1', 'dh_c', 'results.csv'))).rejects.toThrow();
    });

    it('rejects stream ops from a different sender than the one that opened the stream', async () => {
      const service = await importService();
      const { streamId } = (await service.handleDataHistoryOp(
        { op: 'open-stream', path: 'org-1/dh_owner/results.csv', gzip: false },
        { senderId: 1 },
      )) as { streamId: number };

      await expect(
        service.handleDataHistoryOp({ op: 'stream-write', streamId, bytes: TEXT_ENCODER.encode('x') }, { senderId: 2 }),
      ).rejects.toThrow(/Unknown streamId/);
      await expect(service.handleDataHistoryOp({ op: 'stream-close', streamId }, { senderId: 2 })).rejects.toThrow(/Unknown streamId/);
      // An abort from the wrong sender is silently ignored — the stream keeps working for its owner
      await service.handleDataHistoryOp({ op: 'stream-abort', streamId }, { senderId: 2 });

      await service.handleDataHistoryOp({ op: 'stream-write', streamId, bytes: TEXT_ENCODER.encode('mine') }, { senderId: 1 });
      await service.handleDataHistoryOp({ op: 'stream-close', streamId }, { senderId: 1 });
      expect(await fs.readFile(join(defaultBaseDir(), 'org-1', 'dh_owner', 'results.csv'), 'utf8')).toBe('mine');
    });

    it('refuses delete-dir while a stream is open under that directory', async () => {
      const service = await importService();
      const { streamId } = (await service.handleDataHistoryOp({ op: 'open-stream', path: 'org-1/dh_del/results.csv', gzip: false })) as {
        streamId: number;
      };

      await expect(service.handleDataHistoryOp({ op: 'delete-dir', path: 'org-1/dh_del' })).rejects.toThrow(/still being written/);

      await service.handleDataHistoryOp({ op: 'stream-close', streamId });
      await expect(service.handleDataHistoryOp({ op: 'delete-dir', path: 'org-1/dh_del' })).resolves.toBeUndefined();
      await expect(fs.access(join(defaultBaseDir(), 'org-1', 'dh_del'))).rejects.toThrow();
    });

    it('an fs error surfaces on the next stream op instead of crashing the process', async () => {
      const service = await importService();
      // Pre-create a DIRECTORY at the exact file path so the WriteStream's lazy open fails
      // (EISDIR) and emits 'error' with no op in flight.
      await fs.mkdir(join(defaultBaseDir(), 'org-1', 'dh_d', 'results.csv'), { recursive: true });
      const { streamId } = (await service.handleDataHistoryOp({ op: 'open-stream', path: 'org-1/dh_d/results.csv', gzip: false })) as {
        streamId: number;
      };
      // Give the async open-failure 'error' event time to fire — an unhandled 'error' here would
      // crash the (test) process, which is exactly the regression this guards against.
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));

      await expect(service.handleDataHistoryOp({ op: 'stream-write', streamId, bytes: TEXT_ENCODER.encode('x') })).rejects.toThrow();
      // The stream was torn down, so later ops reject rather than hang
      await expect(service.handleDataHistoryOp({ op: 'stream-close', streamId })).rejects.toThrow();
      // Abort remains safe to call
      await expect(service.handleDataHistoryOp({ op: 'stream-abort', streamId })).resolves.toBeUndefined();
    });
  });

  describe('abortDataHistoryStreamsForSender', () => {
    it('tears down a reloaded renderer’s streams and unblocks folder relocation', async () => {
      // A renderer that reloads mid-capture never sends stream-close/abort. Without this teardown
      // its file handle stays open for the life of the process and setDataHistoryFolderPath rejects
      // forever, so the user could never change their history folder again.
      const service = await importService();
      const { streamId } = (await service.handleDataHistoryOp(
        { op: 'open-stream', path: 'org-1/dh_reload/results.csv', gzip: false },
        { senderId: 1 },
      )) as { streamId: number };
      await service.handleDataHistoryOp({ op: 'stream-write', streamId, bytes: TEXT_ENCODER.encode('partial') }, { senderId: 1 });

      const newParent = join(tempRoot, 'after-reload');
      await fs.mkdir(newParent, { recursive: true });
      await expect(service.setDataHistoryFolderPath(newParent)).rejects.toThrow(/while history files are being written/);

      await service.abortDataHistoryStreamsForSender(1);

      // partial file discarded, stream forgotten, and relocation works again
      await expect(fs.access(join(defaultBaseDir(), 'org-1', 'dh_reload', 'results.csv'))).rejects.toThrow();
      await expect(
        service.handleDataHistoryOp({ op: 'stream-write', streamId, bytes: TEXT_ENCODER.encode('x') }, { senderId: 1 }),
      ).rejects.toThrow(/Unknown streamId/);
      await expect(service.setDataHistoryFolderPath(newParent)).resolves.toBe(join(newParent, 'jetstream-data-history'));
    });

    it('leaves streams opened by other renderers alone', async () => {
      const service = await importService();
      const { streamId } = (await service.handleDataHistoryOp(
        { op: 'open-stream', path: 'org-1/dh_other/results.csv', gzip: false },
        { senderId: 2 },
      )) as { streamId: number };

      await service.abortDataHistoryStreamsForSender(1);

      await service.handleDataHistoryOp({ op: 'stream-write', streamId, bytes: TEXT_ENCODER.encode('still open') }, { senderId: 2 });
      await service.handleDataHistoryOp({ op: 'stream-close', streamId }, { senderId: 2 });
      expect(await fs.readFile(join(defaultBaseDir(), 'org-1', 'dh_other', 'results.csv'), 'utf8')).toBe('still open');
    });
  });

  // ────────────────────────────────────────────────
  // folder relocation
  // ────────────────────────────────────────────────

  describe('setDataHistoryFolderPath', () => {
    it('moves existing history and persists the preference', async () => {
      const service = await importService();
      await service.handleDataHistoryOp({
        op: 'write-file',
        path: 'org-1/dh_a/manifest.json',
        gzip: false,
        bytes: TEXT_ENCODER.encode('{}'),
      });

      const newParent = join(tempRoot, 'new-location');
      await fs.mkdir(newParent, { recursive: true });
      const result = await service.setDataHistoryFolderPath(newParent);

      const expectedTarget = join(newParent, 'jetstream-data-history');
      expect(result).toBe(expectedTarget);
      expect(mocks.preferences.dataHistoryFolder).toBe(expectedTarget);
      const moved = await fs.readFile(join(expectedTarget, 'org-1', 'dh_a', 'manifest.json'), 'utf8');
      expect(moved).toBe('{}');
      // Old base dir removed after a successful copy
      await expect(fs.access(defaultBaseDir())).rejects.toThrow();
    });

    it('creates a fresh folder when there is no existing history', async () => {
      const service = await importService();
      const newParent = join(tempRoot, 'fresh-location');
      await fs.mkdir(newParent, { recursive: true });

      const result = await service.setDataHistoryFolderPath(newParent);

      expect(result).toBe(join(newParent, 'jetstream-data-history'));
      expect(mocks.preferences.dataHistoryFolder).toBe(result);
      await expect(fs.access(result)).resolves.toBeUndefined();
    });

    it('does NOT update the preference when the copy fails, and leaves the source intact', async () => {
      const service = await importService();
      await service.handleDataHistoryOp({
        op: 'write-file',
        path: 'org-1/dh_a/manifest.json',
        gzip: false,
        bytes: TEXT_ENCODER.encode('{}'),
      });

      // Make the target un-creatable: the chosen "folder" is actually a file, so
      // `<file>/jetstream-data-history` cannot be written (ENOTDIR)
      const bogusParent = join(tempRoot, 'not-a-folder');
      await fs.writeFile(bogusParent, 'file, not a directory');

      await expect(service.setDataHistoryFolderPath(bogusParent)).rejects.toThrow();

      expect(mocks.preferences.dataHistoryFolder).toBeUndefined();
      const original = await fs.readFile(join(defaultBaseDir(), 'org-1', 'dh_a', 'manifest.json'), 'utf8');
      expect(original).toBe('{}');
    });

    it('never deletes a pre-existing target folder when the copy fails', async () => {
      const service = await importService();
      // Source contains a DIRECTORY named 'x'; pre-existing target contains a FILE named 'x' —
      // fs.cp cannot overwrite a file with a directory, so the copy fails midway
      await service.handleDataHistoryOp({ op: 'write-file', path: 'x/dh_a/manifest.json', gzip: false, bytes: TEXT_ENCODER.encode('{}') });
      const newParent = join(tempRoot, 'occupied-location');
      const preExistingTarget = join(newParent, 'jetstream-data-history');
      await fs.mkdir(preExistingTarget, { recursive: true });
      await fs.writeFile(join(preExistingTarget, 'x'), 'pre-existing user data');

      await expect(service.setDataHistoryFolderPath(newParent)).rejects.toThrow();

      expect(mocks.preferences.dataHistoryFolder).toBeUndefined();
      // The pre-existing target folder and its content must survive the failed attempt
      const preserved = await fs.readFile(join(preExistingTarget, 'x'), 'utf8');
      expect(preserved).toBe('pre-existing user data');
    });

    it('rejects relocation while a history file is being written, then allows it after close', async () => {
      const service = await importService();
      const { streamId } = (await service.handleDataHistoryOp({ op: 'open-stream', path: 'org-1/dh_a/results.csv', gzip: false })) as {
        streamId: number;
      };
      const newParent = join(tempRoot, 'while-writing');
      await fs.mkdir(newParent, { recursive: true });

      await expect(service.setDataHistoryFolderPath(newParent)).rejects.toThrow(/while history files are being written/);
      expect(mocks.preferences.dataHistoryFolder).toBeUndefined();

      await service.handleDataHistoryOp({ op: 'stream-close', streamId });
      await expect(service.setDataHistoryFolderPath(newParent)).resolves.toBe(join(newParent, 'jetstream-data-history'));
    });

    it('rejects a relative or empty folder path', async () => {
      const service = await importService();
      await expect(service.setDataHistoryFolderPath('relative/path')).rejects.toThrow(/absolute path/);
      await expect(service.setDataHistoryFolderPath('')).rejects.toThrow(/absolute path/);
      await expect(service.setDataHistoryFolderPath('   ')).rejects.toThrow(/absolute path/);
    });

    it('rejects new writes while the relocation copy is in progress', async () => {
      const service = await importService();
      await service.handleDataHistoryOp({
        op: 'write-file',
        path: 'org-1/dh_a/manifest.json',
        gzip: false,
        bytes: TEXT_ENCODER.encode('{}'),
      });

      // Hold the copy open so the relocation window is deterministic instead of racing a real copy
      let releaseCopy: () => void = () => undefined;
      const originalCp = fs.cp.bind(fs);
      const cpSpy = vi.spyOn(fs, 'cp').mockImplementation(async (...args) => {
        await new Promise<void>((resolvePromise) => {
          releaseCopy = resolvePromise;
        });
        return originalCp(...(args as Parameters<typeof fs.cp>));
      });

      const newParent = join(tempRoot, 'slow-copy');
      await fs.mkdir(newParent, { recursive: true });
      const relocation = service.setDataHistoryFolderPath(newParent);
      await vi.waitFor(() => expect(cpSpy).toHaveBeenCalled());

      await expect(service.handleDataHistoryOp({ op: 'open-stream', path: 'org-1/dh_b/results.csv', gzip: false })).rejects.toThrow(
        /being moved/,
      );
      await expect(
        service.handleDataHistoryOp({ op: 'write-file', path: 'org-1/dh_c/manifest.json', gzip: false, bytes: TEXT_ENCODER.encode('{}') }),
      ).rejects.toThrow(/being moved/);
      await expect(service.handleDataHistoryOp({ op: 'delete-dir', path: 'org-1/dh_a' })).rejects.toThrow(/being moved/);

      releaseCopy();
      await expect(relocation).resolves.toBe(join(newParent, 'jetstream-data-history'));
      cpSpy.mockRestore();

      // Writes work again once the relocation settles (now landing in the new folder)
      const { streamId } = (await service.handleDataHistoryOp({ op: 'open-stream', path: 'org-1/dh_b/results.csv', gzip: false })) as {
        streamId: number;
      };
      await service.handleDataHistoryOp({ op: 'stream-close', streamId });
    });

    it('is a no-op when the target resolves to the current folder', async () => {
      const service = await importService();
      mocks.preferences.dataHistoryFolder = join(tempRoot, 'existing', 'jetstream-data-history');
      const result = await service.setDataHistoryFolderPath(join(tempRoot, 'existing'));
      expect(result).toBe(mocks.preferences.dataHistoryFolder);
    });

    it('rejects a target inside the current history folder', async () => {
      const service = await importService();
      await expect(service.setDataHistoryFolderPath(defaultBaseDir())).rejects.toThrow(/cannot be inside the current one/);
    });
  });
});
