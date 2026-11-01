import express from 'express';
import type { AddressInfo } from 'node:net';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import platformEventRoutes from '../platform-event.routes';

const mocks = vi.hoisted(() => ({
  proxyRequests: [] as Array<import('node:stream').PassThrough & { destroy: ReturnType<typeof vi.fn> }>,
  logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: {
    JETSTREAM_CLIENT_URL: 'http://localhost:4200',
    JETSTREAM_SERVER_URL: 'http://localhost:3333',
    SFDC_API_VERSION: '64.0',
  },
  getLogger: () => mocks.logger,
}));

vi.mock('../route.middleware', () => ({
  checkAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  getOrgFromHeaderOrQuery: vi.fn(async () => ({
    jetstreamConn: { sessionInfo: { instanceUrl: 'https://example.my.salesforce.com', accessToken: 'token' } },
  })),
}));

// A CometD long-poll: Salesforce accepts the request and holds it open without responding
vi.mock('https', () => ({
  default: {
    request: vi.fn(() => {
      const proxyRequest = new PassThrough();
      vi.spyOn(proxyRequest, 'destroy');
      mocks.proxyRequests.push(proxyRequest as (typeof mocks.proxyRequests)[number]);
      return proxyRequest;
    }),
  },
}));

describe('platform-event proxy', () => {
  let server: ReturnType<express.Express['listen']> | undefined;

  afterEach(async () => {
    server?.closeAllConnections();
    await new Promise((resolve) => server?.close(resolve));
    server = undefined;
    mocks.proxyRequests.length = 0;
    vi.clearAllMocks();
  });

  it('destroys the upstream long-poll when the client disconnects before Salesforce responds', async () => {
    const app = express();
    app.use('/platform-event', platformEventRoutes);
    server = app.listen(0);
    await new Promise((resolve) => server?.once('listening', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/platform-event/connect`;

    const abortController = new AbortController();
    const response = fetch(url, { method: 'POST', body: '[]', signal: abortController.signal });
    await vi.waitFor(() => expect(mocks.proxyRequests).toHaveLength(1));
    abortController.abort();

    await expect(response).rejects.toThrow();
    await vi.waitFor(() => expect(mocks.proxyRequests[0].destroy).toHaveBeenCalled());
    expect(mocks.logger.error).not.toHaveBeenCalled();
  });
});
