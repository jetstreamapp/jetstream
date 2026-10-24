import { HTTP } from '@jetstream/shared/constants';
import { raw } from 'body-parser';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { gzipBodyPassthrough } from '../gzip-body-passthrough.middleware';

const CSV = 'Name\nAcme\nGlobex\n';

/** Mirrors main.ts: passthrough first, then the global parser that rejects every Content-Encoding */
function createServer(limitBytes = 1024) {
  const app = express();
  app.post('/api/bulk/:jobId', gzipBodyPassthrough({ limitBytes }));
  app.use(raw({ limit: '30mb', type: ['text/csv'], inflate: false }));
  app.post('/api/bulk/:jobId', (req, res) => {
    res.json({
      isBuffer: Buffer.isBuffer(req.body),
      bodyBase64: Buffer.isBuffer(req.body) ? req.body.toString('base64') : null,
    });
  });
  app.use((err: { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? 500).json({ type: err.type });
  });
  return new Promise<{ url: string; close: () => void }>((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}

function post(url: string, body: BodyInit, headers: Record<string, string>) {
  return fetch(`${url}/api/bulk/750000000000001`, { method: 'POST', body, headers });
}

describe('gzipBodyPassthrough', () => {
  let server: Awaited<ReturnType<typeof createServer>>;

  afterEach(() => {
    server?.close();
  });

  test('passes gzipped csv through as the original compressed bytes', async () => {
    server = await createServer();
    const compressed = gzipSync(CSV);
    const response = await post(server.url, compressed, {
      [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.CSV,
      [HTTP.HEADERS.CONTENT_ENCODING]: 'gzip',
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.isBuffer).toBe(true);
    expect(Buffer.from(result.bodyBase64, 'base64').equals(compressed)).toBe(true);
  });

  test('leaves uncompressed csv to the regular parser', async () => {
    server = await createServer();
    const response = await post(server.url, CSV, { [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.CSV });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(Buffer.from(result.bodyBase64, 'base64').toString('utf8')).toBe(CSV);
  });

  test('rejects a body that is not gzip', async () => {
    server = await createServer();
    const response = await post(server.url, CSV, {
      [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.CSV,
      [HTTP.HEADERS.CONTENT_ENCODING]: 'gzip',
    });
    expect(response.status).toBe(400);
    expect((await response.json()).type).toBe('encoding.invalid');
  });

  test('rejects a compressed body over the limit', async () => {
    server = await createServer(16);
    const response = await post(server.url, gzipSync('x'.repeat(10_000) + CSV), {
      [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.CSV,
      [HTTP.HEADERS.CONTENT_ENCODING]: 'gzip',
    });
    expect(response.status).toBe(413);
  });

  test('leaves other encodings to the global parser, which rejects them', async () => {
    server = await createServer();
    const response = await post(server.url, CSV, {
      [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.CSV,
      [HTTP.HEADERS.CONTENT_ENCODING]: 'br',
    });
    expect(response.status).toBe(415);
  });
});
