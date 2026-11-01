import type { ApiConnection } from '@jetstream/salesforce-api';
import { dialog } from 'electron';
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
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => mocks.downloadDir) },
  dialog: { showSaveDialog: vi.fn() },
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

function downloadResultsCsv(jetstreamConn: ApiConnection) {
  return downloadBulkApiFileAndSaveToDisk({
    jetstreamConn,
    fileName: 'results.csv',
    jobId: 'job-1',
    batchId: 'batch-1',
    isQuery: false,
    type: 'result',
  });
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
});
