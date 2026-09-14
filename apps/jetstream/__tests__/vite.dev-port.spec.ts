// @vitest-environment node
import { createServer, Server } from 'node:net';
import { DEV_SERVER_HOST, resolveDevServerPort, RETAINED_PORT_ENV } from '../vite.dev-port.mts';

/** Holds a port open, the way the running dev server does while Vite resolves the restarted config. */
function occupyPort(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ port, host: DEV_SERVER_HOST }, () => resolve(server));
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('resolveDevServerPort', () => {
  const openServers: Server[] = [];

  beforeEach(() => {
    // Nx loads .env into process.env, so a developer's pinned port must not leak into these tests
    vi.stubEnv('JETSTREAM_DEV_PORT', '');
    vi.stubEnv(RETAINED_PORT_ENV, '');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(openServers.splice(0).map(closeServer));
  });

  it('uses JETSTREAM_DEV_PORT when it is set', async () => {
    vi.stubEnv('JETSTREAM_DEV_PORT', '4567');

    await expect(resolveDevServerPort()).resolves.toBe(4567);
  });

  it('rejects a JETSTREAM_DEV_PORT that is not a port number', async () => {
    vi.stubEnv('JETSTREAM_DEV_PORT', 'not-a-port');

    await expect(resolveDevServerPort()).rejects.toThrow('JETSTREAM_DEV_PORT must be a port number');
  });

  it('skips a port that is already in use when searching', async () => {
    const firstPort = await resolveDevServerPort();
    openServers.push(await occupyPort(firstPort));
    vi.stubEnv(RETAINED_PORT_ENV, '');

    const secondPort = await resolveDevServerPort();

    expect(secondPort).not.toBe(firstPort);
  });

  it('keeps the port chosen at startup across a server restart while that port is still bound', async () => {
    const startupPort = await resolveDevServerPort();
    // Vite resolves the restarted server's config before closing the old server, so the port
    // chosen at startup is still bound by our own server when the config runs again.
    openServers.push(await occupyPort(startupPort));

    await expect(resolveDevServerPort()).resolves.toBe(startupPort);
  });
});
