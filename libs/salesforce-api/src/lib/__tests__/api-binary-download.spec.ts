import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiBinaryDownload, BinaryFileDownload } from '../api-binary-download';
import { ApiConnection } from '../connection';
import { StreamingZip } from '../zip-utils';

const encoder = new TextEncoder();
const FILE_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

function createLogger() {
  return { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createApiBinaryDownload(apiRequest: (options: { url: string }) => Promise<ReadableStream<Uint8Array>>) {
  return new ApiBinaryDownload({
    apiRequest: vi.fn(apiRequest),
    sessionInfo: {
      accessToken: 'test-token',
      instanceUrl: 'https://test.salesforce.com',
      apiVersion: '65.0',
      userId: 'test-user-id',
      organizationId: 'test-org-id',
    },
    logger: createLogger(),
  } as unknown as ApiConnection);
}

function fileStream(content: string) {
  return new Response(content).body as ReadableStream<Uint8Array>;
}

const FILES: BinaryFileDownload[] = [
  { url: '/file-1', fileName: 'file-1', fileExtension: 'txt', size: 5 },
  { url: '/file-2', fileName: 'file-2', fileExtension: 'txt', size: 5 },
];

/** Reads the whole stream, failing the test (instead of hanging) if it never settles */
function readWithin(stream: ReadableStream<Uint8Array>, timeoutMs = 2000) {
  return Promise.race([
    new Response(stream).arrayBuffer(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('zip stream never settled')), timeoutMs)),
  ]);
}

describe('ApiBinaryDownload.downloadAndZipFiles', () => {
  const unhandledRejectionListener = vi.fn();

  beforeEach(() => {
    unhandledRejectionListener.mockReset();
    process.on('unhandledRejection', unhandledRejectionListener);
  });

  afterEach(() => {
    process.off('unhandledRejection', unhandledRejectionListener);
  });

  it('streams every file into the zip', async () => {
    const binaryDownload = createApiBinaryDownload(async ({ url }) => fileStream(url === '/file-1' ? 'hello' : 'world'));

    const { stream, size } = await binaryDownload.downloadAndZipFiles(FILES, 'files.zip');
    const zipBytes = await readWithin(stream);

    expect(BigInt(zipBytes.byteLength)).toBe(size);
  });

  it('errors the zip stream when a later file fails to download', async () => {
    const binaryDownload = createApiBinaryDownload(async ({ url }) => {
      if (url === '/file-2') {
        throw new Error('Salesforce unavailable');
      }
      return fileStream('hello');
    });

    const { stream } = await binaryDownload.downloadAndZipFiles(FILES, 'files.zip');

    await expect(readWithin(stream)).rejects.toThrow('Salesforce unavailable');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandledRejectionListener).not.toHaveBeenCalled();
  });

  it('errors the zip stream when a file body fails mid-stream', async () => {
    const binaryDownload = createApiBinaryDownload(async ({ url }) => {
      if (url === '/file-2') {
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('wor'));
            controller.error(new Error('ECONNRESET'));
          },
        });
      }
      return fileStream('hello');
    });

    const { stream } = await binaryDownload.downloadAndZipFiles(FILES, 'files.zip');

    await expect(readWithin(stream)).rejects.toThrow('ECONNRESET');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandledRejectionListener).not.toHaveBeenCalled();
  });

  it('clears the per-file timeout once each file is downloaded', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const binaryDownload = createApiBinaryDownload(async () => fileStream('hello'));

    try {
      const { stream } = await binaryDownload.downloadAndZipFiles(FILES, 'files.zip');
      await readWithin(stream);

      const fileTimeoutIds = setTimeoutSpy.mock.calls
        .map(([, delay], callIndex) => ({ delay, timeoutId: setTimeoutSpy.mock.results[callIndex].value }))
        .filter(({ delay }) => delay === FILE_DOWNLOAD_TIMEOUT_MS)
        .map(({ timeoutId }) => timeoutId);
      expect(fileTimeoutIds).toHaveLength(FILES.length);
      fileTimeoutIds.forEach((timeoutId) => expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId));
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    }
  });
});

describe('StreamingZip.error', () => {
  it('errors the output stream and fires the abort callbacks', async () => {
    const zip = new StreamingZip();
    const onAbort = vi.fn();
    zip.onAbort(onAbort);

    zip.error(new Error('download failed'));

    await expect(zip.outputStream.getReader().read()).rejects.toThrow('download failed');
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(zip.isAborted()).toBe(true);
  });

  it('is a no-op once the consumer has cancelled the stream', async () => {
    const zip = new StreamingZip();
    const onAbort = vi.fn();
    zip.onAbort(onAbort);

    await zip.outputStream.cancel();
    expect(() => zip.error(new Error('download failed'))).not.toThrow();

    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the stream was already closed', async () => {
    const zip = new StreamingZip();
    const reader = zip.outputStream.getReader();
    await zip.finish();

    expect(() => zip.error(new Error('late failure'))).not.toThrow();
    await expect(reader.read()).resolves.toEqual(expect.objectContaining({ done: false }));
  });
});
