/**
 * "Download All" / "View All" pairs result rows with the submitted records by position, so a batch that silently
 * drops out of the combined response shifts every later row onto the wrong record. These tests run the real route
 * over HTTP to lock in that a failing batch fails the whole response instead of producing a complete-looking 200.
 */
import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routeDefinition } from '../sf-bulk-api.controller';

vi.mock('@jetstream/api-config', () => ({
  ENV: { JETSTREAM_SERVER_URL: 'https://server.test', ENVIRONMENT: 'test', CI: false },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  getLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  errorTracker: { error: vi.fn(), warn: vi.fn(), critical: vi.fn(), info: vi.fn() },
  prisma: {},
}));

vi.mock('@jetstream/auth/server', () => ({
  AuthError: class AuthError extends Error {},
  ProviderNotAllowed: class ProviderNotAllowed extends Error {},
  StepUpAuthRequiredError: class StepUpAuthRequiredError extends Error {},
  createCSRFToken: vi.fn(),
  getCookieConfig: vi.fn(),
  getApiAddressFromReq: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@jetstream/prisma', () => ({
  isPrismaError: () => false,
  Prisma: {},
  toTypedPrismaError: vi.fn(),
}));

vi.mock('../../db/salesforce-org.db', () => ({
  findByUniqueId_UNSAFE: vi.fn(),
  updateOrg_UNSAFE: vi.fn(),
}));

const JOB_ID = '750000000000001';
const CSV_HEADER = '"Id","Success","Created","Error"\n';
const encoder = new TextEncoder();

function csvStream(chunks: string[]) {
  return new Response(chunks.join('')).body as ReadableStream<Uint8Array>;
}

/** Emits `chunks`, then fails like an upstream connection reset */
function csvStreamThatFails(chunks: string[]) {
  let chunkIndex = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (chunkIndex < chunks.length) {
        controller.enqueue(encoder.encode(chunks[chunkIndex++]));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.error(new Error('ECONNRESET'));
    },
  });
}

function createJetstreamConn(downloadRecords: (batchId: string) => Promise<ReadableStream<Uint8Array>>) {
  return {
    bulk: {
      getJob: vi.fn(async () => ({
        id: JOB_ID,
        batches: [
          { id: 'batch-1', state: 'Completed' },
          { id: 'batch-2', state: 'Completed' },
        ],
      })),
      downloadRecords: vi.fn((_jobId: string, batchId: string) => downloadRecords(batchId)),
    },
  };
}

describe('downloadAllResults', () => {
  let server: ReturnType<express.Express['listen']> | undefined;

  afterEach(async () => {
    await new Promise((resolve) => server?.close(resolve));
    server = undefined;
  });

  async function startServer(jetstreamConn: ReturnType<typeof createJetstreamConn>) {
    const app = express();
    app.get(
      '/api/bulk/:jobId/results',
      (req, res, next) => {
        res.locals.jetstreamConn = jetstreamConn;
        (req as unknown as { session: object }).session = {};
        next();
      },
      routeDefinition.downloadAllResults.controllerFn() as unknown as express.RequestHandler,
      ((err, _req, res, _next) => {
        res.status(400).json({ error: true, message: err.message });
      }) as express.ErrorRequestHandler,
    );
    server = app.listen(0);
    await new Promise((resolve) => server?.once('listening', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/bulk/${JOB_ID}/results?batchIds=batch-1,batch-2`;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('combines every batch into one JSON array', async () => {
    const url = await startServer(
      createJetstreamConn(async (batchId) =>
        batchId === 'batch-1'
          ? csvStream([CSV_HEADER, '"001A","true","true",""\n'])
          : csvStream([CSV_HEADER, '"001B","false","false","REQUIRED_FIELD_MISSING"\n']),
      ),
    );

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        { Id: '001A', Success: true, Created: true, Error: null },
        { Id: '001B', Success: false, Created: false, Error: 'REQUIRED_FIELD_MISSING' },
      ],
    });
  });

  it('fails the response instead of skipping a batch whose download is rejected', async () => {
    const url = await startServer(
      createJetstreamConn(async (batchId) => {
        if (batchId === 'batch-2') {
          throw new Error('Salesforce unavailable');
        }
        return csvStream([CSV_HEADER, '"001A","true","true",""\n', '"001B","true","true",""\n']);
      }),
    );

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    // Rows from batch 1 were already streamed, so the only honest signal left is a broken connection
    expect(response.status).toBe(200);
    await expect(response.text()).rejects.toThrow();
  });

  it('fails the response without hanging when a later batch errors mid-stream', async () => {
    const url = await startServer(
      createJetstreamConn(async (batchId) =>
        batchId === 'batch-1'
          ? csvStream([CSV_HEADER, '"001A","true","true",""\n'])
          : csvStreamThatFails([CSV_HEADER, '"001B","true","true",""\n']),
      ),
    );

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    await expect(response.text()).rejects.toThrow();
  });

  it('stops fetching batches when the client disconnects while the first batch is being requested', async () => {
    const abortController = new AbortController();
    const onFirstBatchCancel = vi.fn();
    const jetstreamConn = createJetstreamConn(async (batchId) => {
      if (batchId === 'batch-1') {
        // the client leaves while Salesforce is still responding to the first request
        abortController.abort();
        await new Promise((resolve) => setTimeout(resolve, 50));
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(`${CSV_HEADER}"001A","true","true",""\n`));
          },
          cancel: onFirstBatchCancel,
        });
      }
      return csvStream([CSV_HEADER, '"001B","true","true",""\n']);
    });
    const url = await startServer(jetstreamConn);

    await expect(fetch(url, { signal: abortController.signal })).rejects.toThrow();

    await vi.waitFor(() => expect(onFirstBatchCancel).toHaveBeenCalled());
    expect(jetstreamConn.bulk.downloadRecords).toHaveBeenCalledTimes(1);
  });

  it('returns an error status when the first batch cannot be downloaded', async () => {
    const url = await startServer(
      createJetstreamConn(async () => {
        throw new Error('Salesforce unavailable');
      }),
    );

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: true, message: 'Salesforce unavailable' });
  });
});
