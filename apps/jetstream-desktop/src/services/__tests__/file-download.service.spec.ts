import type { ApiConnection } from '@jetstream/salesforce-api';
import { BrowserWindow, dialog, WebContents } from 'electron';
import { promises as fs } from 'node:fs';
import { link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimAvailableDownloadPath, releaseDownloadPath } from '../../utils/download-path.utils';
import { downloadAndZipFilesToDisk, downloadBulkApiFileAndSaveToDisk } from '../file-download.service';
import { getUserPreferences } from '../persistence.service';

const mocks = vi.hoisted(() => ({
  downloadDir: '',
  window: { isDestroyed: () => false, setProgressBar: vi.fn() },
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => mocks.downloadDir) },
  dialog: { showSaveDialog: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn(() => mocks.window), getAllWindows: vi.fn(() => [mocks.window]) },
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../persistence.service', () => ({
  getUserPreferences: vi.fn(() => ({ fileDownload: { omitPrompt: true, downloadPath: mocks.downloadDir } })),
}));

vi.mock('../../utils/utils', () => ({
  markDownloadCompleted: vi.fn(),
  toSafeDownloadFileName: (fileName: string) => fileName,
}));

// Wrapped so a test can simulate a file system without hard link support
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return { ...original, link: vi.fn(original.link) };
});

const encoder = new TextEncoder();

/** Emits some data, then fails like an upstream connection reset */
function streamThatFails() {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('partial,data\n'));
    },
    async pull(controller) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.error(new Error('ECONNRESET'));
    },
  });
}

/** Emits the first chunk, then waits for `release()` before emitting the rest (or failing with it, if an error) */
function streamThatWaits(firstChunk: string, rest: string | Error) {
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let isFirstChunkSent = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!isFirstChunkSent) {
        isFirstChunkSent = true;
        controller.enqueue(encoder.encode(firstChunk));
        return;
      }
      await released;
      if (rest instanceof Error) {
        controller.error(rest);
        return;
      }
      controller.enqueue(encoder.encode(rest));
      controller.close();
    },
  });
  return { stream, release };
}

function createBulkConn(downloadRecords: () => Promise<ReadableStream<Uint8Array> | null>) {
  return { bulk: { downloadRecords: vi.fn(downloadRecords) } } as unknown as ApiConnection;
}

function downloadResultsCsv(jetstreamConn: ApiConnection, sender?: WebContents) {
  return downloadBulkApiFileAndSaveToDisk({
    jetstreamConn,
    fileName: 'results.csv',
    jobId: 'job-1',
    batchId: 'batch-1',
    isQuery: false,
    type: 'result',
    sender,
  });
}

function createSender() {
  return { isDestroyed: () => false, send: vi.fn() } as unknown as WebContents;
}

function getIconProgressValues() {
  return mocks.window.setProgressBar.mock.calls.map(([progress]) => progress);
}

describe('file-download.service', () => {
  beforeEach(async () => {
    mocks.downloadDir = await fs.mkdtemp(join(tmpdir(), 'jetstream-file-download-'));
  });

  afterEach(async () => {
    vi.clearAllMocks();
    vi.mocked(link).mockReset();
    await fs.rm(mocks.downloadDir, { recursive: true, force: true });
  });

  it('saves a completed download under the requested name and leaves no temporary file', async () => {
    const result = await downloadResultsCsv(createBulkConn(async () => new Response('Id\n001A\n').body));

    const filePath = join(mocks.downloadDir, 'results.csv');
    expect(result).toEqual({ success: true, filePath });
    expect(await fs.readFile(filePath, 'utf8')).toBe('Id\n001A\n');
    expect(await fs.readdir(mocks.downloadDir)).toEqual(['results.csv']);
  });

  it('removes the temporary file and never creates the real one when a bulk download fails mid-stream', async () => {
    const result = await downloadResultsCsv(createBulkConn(async () => streamThatFails()));

    expect(result).toEqual({ success: false, error: 'ECONNRESET' });
    expect(await fs.readdir(mocks.downloadDir)).toEqual([]);
  });

  it('removes the temporary zip when the zip stream fails', async () => {
    const jetstreamConn = {
      binary: { downloadAndZipFiles: vi.fn(async () => ({ stream: streamThatFails(), fileName: 'files.zip', size: BigInt(100) })) },
    } as unknown as ApiConnection;

    const result = await downloadAndZipFilesToDisk(jetstreamConn, [], 'files.zip', 'job-1');

    expect(result).toEqual({ success: false, error: 'ECONNRESET' });
    expect(await fs.readdir(mocks.downloadDir)).toEqual([]);
  });

  it('only writes to a temporary file while the download is in progress', async () => {
    const { stream, release } = streamThatWaits('Id\n', '001A\n');
    const download = downloadResultsCsv(createBulkConn(async () => stream));

    await vi.waitFor(async () => {
      const files = await fs.readdir(mocks.downloadDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^results\.csv\.[0-9a-f]{8}\.partial$/);
    });
    release();

    expect(await download).toEqual({ success: true, filePath: join(mocks.downloadDir, 'results.csv') });
    expect(await fs.readdir(mocks.downloadDir)).toEqual(['results.csv']);
  });

  it('adds a number to the name instead of replacing an existing file when the save prompt is skipped', async () => {
    await fs.writeFile(join(mocks.downloadDir, 'results.csv'), 'existing');
    await fs.writeFile(join(mocks.downloadDir, 'results (1).csv'), 'existing 1');

    const result = await downloadResultsCsv(createBulkConn(async () => new Response('Id\n001A\n').body));

    const filePath = join(mocks.downloadDir, 'results (2).csv');
    expect(result).toEqual({ success: true, filePath });
    expect(await fs.readFile(filePath, 'utf8')).toBe('Id\n001A\n');
    expect(await fs.readFile(join(mocks.downloadDir, 'results.csv'), 'utf8')).toBe('existing');
    expect(await fs.readFile(join(mocks.downloadDir, 'results (1).csv'), 'utf8')).toBe('existing 1');
  });

  it('skips a name claimed by a browser download that has not finished yet', async () => {
    const claimedPath = claimAvailableDownloadPath(join(mocks.downloadDir, 'results.csv'));
    try {
      const result = await downloadResultsCsv(createBulkConn(async () => new Response('Id\n001A\n').body));

      expect(claimedPath).toBe(join(mocks.downloadDir, 'results.csv'));
      expect(result).toEqual({ success: true, filePath: join(mocks.downloadDir, 'results (1).csv') });
    } finally {
      releaseDownloadPath(claimedPath as string);
    }
  });

  it('keeps a name it is moving a download into away from a browser download that starts at the same time', async () => {
    const actualFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    let browserClaimedPath: string | null = null;
    vi.mocked(link).mockImplementation(async (sourcePath, targetPath) => {
      // a Chromium `will-download` fires while the native save is still creating its file
      browserClaimedPath = claimAvailableDownloadPath(join(mocks.downloadDir, 'results.csv'));
      return actualFs.link(sourcePath, targetPath);
    });

    try {
      const result = await downloadResultsCsv(createBulkConn(async () => new Response('Id\n001A\n').body));

      expect(result).toEqual({ success: true, filePath: join(mocks.downloadDir, 'results.csv') });
      expect(browserClaimedPath).toBe(join(mocks.downloadDir, 'results (1).csv'));
    } finally {
      if (browserClaimedPath) {
        releaseDownloadPath(browserClaimedPath);
      }
    }
  });

  it('gives concurrent downloads of the same file their own names, and a failure does not touch the other file', async () => {
    const first = streamThatWaits('Id\n', '001A\n');
    const second = streamThatWaits('Id\n', '001B\n');
    const failing = streamThatWaits('Id\n', new Error('ECONNRESET'));
    const streams = [first.stream, second.stream, failing.stream];
    const jetstreamConn = createBulkConn(async () => streams.shift() ?? null);

    const firstDownload = downloadResultsCsv(jetstreamConn);
    const secondDownload = downloadResultsCsv(jetstreamConn);
    const failingDownload = downloadResultsCsv(jetstreamConn);
    await vi.waitFor(async () => expect(await fs.readdir(mocks.downloadDir)).toHaveLength(3));
    // released one at a time so the order the names are claimed in is deterministic
    first.release();
    await firstDownload;
    second.release();
    await secondDownload;
    failing.release();

    const results = await Promise.all([firstDownload, secondDownload, failingDownload]);

    expect(results[0]).toEqual({ success: true, filePath: join(mocks.downloadDir, 'results.csv') });
    expect(results[1]).toEqual({ success: true, filePath: join(mocks.downloadDir, 'results (1).csv') });
    expect(results[2].success).toBe(false);
    expect(await fs.readFile(join(mocks.downloadDir, 'results.csv'), 'utf8')).toBe('Id\n001A\n');
    expect(await fs.readFile(join(mocks.downloadDir, 'results (1).csv'), 'utf8')).toBe('Id\n001B\n');
    expect((await fs.readdir(mocks.downloadDir)).sort()).toEqual(['results (1).csv', 'results.csv']);
  });

  it('replaces an existing file the user chose in the save dialog', async () => {
    vi.mocked(getUserPreferences).mockReturnValueOnce({ fileDownload: { omitPrompt: false } } as ReturnType<typeof getUserPreferences>);
    const filePath = join(mocks.downloadDir, 'chosen.csv');
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath });
    await fs.writeFile(filePath, 'existing');

    const result = await downloadResultsCsv(createBulkConn(async () => new Response('Id\n001A\n').body));

    expect(result).toEqual({ success: true, filePath });
    expect(await fs.readFile(filePath, 'utf8')).toBe('Id\n001A\n');
    expect(await fs.readdir(mocks.downloadDir)).toEqual(['chosen.csv']);
  });

  it('falls back to copying when the file system does not support hard links', async () => {
    vi.mocked(link).mockRejectedValue(Object.assign(new Error('operation not supported'), { code: 'ENOTSUP' }));
    await fs.writeFile(join(mocks.downloadDir, 'results.csv'), 'existing');

    const result = await downloadResultsCsv(createBulkConn(async () => new Response('Id\n001A\n').body));

    const filePath = join(mocks.downloadDir, 'results (1).csv');
    expect(result).toEqual({ success: true, filePath });
    expect(await fs.readFile(filePath, 'utf8')).toBe('Id\n001A\n');
    expect(await fs.readFile(join(mocks.downloadDir, 'results.csv'), 'utf8')).toBe('existing');
    expect((await fs.readdir(mocks.downloadDir)).sort()).toEqual(['results (1).csv', 'results.csv']);
  });

  it('never deletes an existing file when the copy fallback fails', async () => {
    await fs.writeFile(join(mocks.downloadDir, 'results.csv'), 'existing');
    // the temporary file disappears (e.g. removed by another process) on a file system without hard links
    vi.mocked(link).mockImplementation(async (sourcePath) => {
      await fs.rm(sourcePath, { force: true });
      throw Object.assign(new Error('operation not supported'), { code: 'ENOTSUP' });
    });

    const result = await downloadResultsCsv(createBulkConn(async () => new Response('Id\n001A\n').body));

    expect(result.success).toBe(false);
    expect(await fs.readFile(join(mocks.downloadDir, 'results.csv'), 'utf8')).toBe('existing');
    expect(await fs.readdir(mocks.downloadDir)).toEqual(['results.csv']);
  });

  it('saves a file whose name is close to the file system name length limit', async () => {
    const fileName = `${'a'.repeat(250)}.csv`;
    const jetstreamConn = createBulkConn(async () => new Response('Id\n001A\n').body);

    const result = await downloadBulkApiFileAndSaveToDisk({
      jetstreamConn,
      fileName,
      jobId: 'job-1',
      batchId: 'batch-1',
      isQuery: false,
      type: 'result',
    });

    const filePath = join(mocks.downloadDir, fileName);
    expect(result).toEqual({ success: true, filePath });
    expect(await fs.readFile(filePath, 'utf8')).toBe('Id\n001A\n');
    expect(await fs.readdir(mocks.downloadDir)).toEqual([fileName]);
  });

  it('adds a number to a name close to the file system name length limit without making it too long', async () => {
    const fileName = `${'a'.repeat(250)}.csv`;
    await fs.writeFile(join(mocks.downloadDir, fileName), 'existing');
    const jetstreamConn = createBulkConn(async () => new Response('Id\n001A\n').body);

    const result = await downloadBulkApiFileAndSaveToDisk({
      jetstreamConn,
      fileName,
      jobId: 'job-1',
      batchId: 'batch-1',
      isQuery: false,
      type: 'result',
    });

    const numberedFileName = `${'a'.repeat(247)} (1).csv`;
    expect(result).toEqual({ success: true, filePath: join(mocks.downloadDir, numberedFileName) });
    expect(await fs.readFile(join(mocks.downloadDir, numberedFileName), 'utf8')).toBe('Id\n001A\n');
    expect(await fs.readFile(join(mocks.downloadDir, fileName), 'utf8')).toBe('existing');
  });

  describe('app icon progress', () => {
    it('shows zip progress against the zip size and clears it when the zip is saved', async () => {
      const content = 'zip-bytes';
      const jetstreamConn = {
        binary: {
          downloadAndZipFiles: vi.fn(async () => ({
            stream: new Response(content).body,
            fileName: 'files.zip',
            size: BigInt(content.length),
          })),
        },
      } as unknown as ApiConnection;
      const sender = createSender();

      const result = await downloadAndZipFilesToDisk(jetstreamConn, [], 'files.zip', 'job-1', sender);

      expect(result.success).toBe(true);
      expect(BrowserWindow.fromWebContents).toHaveBeenCalledWith(sender);
      const progressValues = getIconProgressValues();
      expect(progressValues).toContain(1);
      expect(progressValues.at(-1)).toBe(-1);
    });

    it('clears the progress when the zip stream fails', async () => {
      const jetstreamConn = {
        binary: { downloadAndZipFiles: vi.fn(async () => ({ stream: streamThatFails(), fileName: 'files.zip', size: BigInt(100) })) },
      } as unknown as ApiConnection;

      const result = await downloadAndZipFilesToDisk(jetstreamConn, [], 'files.zip', 'job-1', createSender());

      expect(result.success).toBe(false);
      expect(getIconProgressValues().at(-1)).toBe(-1);
    });

    it('shows a bulk download while it streams and clears it once saved', async () => {
      const { stream, release } = streamThatWaits('Id\n', '001A\n');
      const download = downloadResultsCsv(
        createBulkConn(async () => stream),
        createSender(),
      );

      await vi.waitFor(() => expect(mocks.window.setProgressBar).toHaveBeenCalled());
      expect(getIconProgressValues()).not.toContain(-1);
      release();

      expect((await download).success).toBe(true);
      expect(getIconProgressValues().at(-1)).toBe(-1);
    });

    it('clears the progress when a bulk download fails mid-stream', async () => {
      const result = await downloadResultsCsv(
        createBulkConn(async () => streamThatFails()),
        createSender(),
      );

      expect(result.success).toBe(false);
      expect(getIconProgressValues().at(-1)).toBe(-1);
    });

    it('does not show progress when the save dialog is canceled', async () => {
      vi.mocked(getUserPreferences).mockReturnValueOnce({ fileDownload: { omitPrompt: false } } as ReturnType<typeof getUserPreferences>);
      vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' });

      const result = await downloadResultsCsv(
        createBulkConn(async () => new Response('Id\n').body),
        createSender(),
      );

      expect(result).toEqual({ success: false, error: 'Download canceled by user' });
      expect(mocks.window.setProgressBar).not.toHaveBeenCalled();
    });
  });
});
