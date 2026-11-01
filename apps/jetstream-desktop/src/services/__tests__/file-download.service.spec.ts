import type { ApiConnection } from '@jetstream/salesforce-api';
import { existsSync, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadAndZipFilesToDisk, downloadBulkApiFileAndSaveToDisk } from '../file-download.service';

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
  setRecentDocument: vi.fn(),
  toSafeDownloadFileName: (fileName: string) => fileName,
}));

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

describe('file-download.service', () => {
  beforeEach(async () => {
    mocks.downloadDir = await fs.mkdtemp(join(tmpdir(), 'jetstream-file-download-'));
  });

  afterEach(async () => {
    await fs.rm(mocks.downloadDir, { recursive: true, force: true });
  });

  it('removes the partial file when a bulk download fails mid-stream', async () => {
    const jetstreamConn = {
      bulk: { downloadRecords: vi.fn(async () => streamThatFails()) },
    } as unknown as ApiConnection;

    const result = await downloadBulkApiFileAndSaveToDisk({
      jetstreamConn,
      fileName: 'results.csv',
      jobId: 'job-1',
      batchId: 'batch-1',
      isQuery: false,
      type: 'result',
    });

    expect(result).toEqual({ success: false, error: 'ECONNRESET' });
    expect(existsSync(join(mocks.downloadDir, 'results.csv'))).toBe(false);
  });

  it('removes the partial zip when the zip stream fails', async () => {
    const jetstreamConn = {
      binary: { downloadAndZipFiles: vi.fn(async () => ({ stream: streamThatFails(), fileName: 'files.zip', size: BigInt(100) })) },
    } as unknown as ApiConnection;

    const result = await downloadAndZipFilesToDisk(jetstreamConn, [], 'files.zip', 'job-1');

    expect(result).toEqual({ success: false, error: 'ECONNRESET' });
    expect(existsSync(join(mocks.downloadDir, 'files.zip'))).toBe(false);
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'does not delete an existing file that could not be opened for writing',
    async () => {
      const filePath = join(mocks.downloadDir, 'results.csv');
      await fs.writeFile(filePath, 'existing');
      await fs.chmod(filePath, 0o444);
      const jetstreamConn = {
        bulk: { downloadRecords: vi.fn(async () => new Response('Id\n001A\n').body) },
      } as unknown as ApiConnection;

      const result = await downloadBulkApiFileAndSaveToDisk({
        jetstreamConn,
        fileName: 'results.csv',
        jobId: 'job-1',
        batchId: 'batch-1',
        isQuery: false,
        type: 'result',
      });

      expect(result.success).toBe(false);
      expect(await fs.readFile(filePath, 'utf8')).toBe('existing');
    },
  );

  it('keeps the file when the download succeeds', async () => {
    const jetstreamConn = {
      bulk: { downloadRecords: vi.fn(async () => new Response('Id\n001A\n').body) },
    } as unknown as ApiConnection;

    const result = await downloadBulkApiFileAndSaveToDisk({
      jetstreamConn,
      fileName: 'results.csv',
      jobId: 'job-1',
      batchId: 'batch-1',
      isQuery: false,
      type: 'result',
    });

    const filePath = join(mocks.downloadDir, 'results.csv');
    expect(result).toEqual({ success: true, filePath });
    expect(await fs.readFile(filePath, 'utf8')).toBe('Id\n001A\n');
  });
});
