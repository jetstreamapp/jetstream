import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { basename, join } from 'node:path';
import { PluginOption } from 'vite';

/**
 * The host Vite binds the dev server to. The availability probe below must bind the exact same
 * host string, otherwise the probe and the real bind can disagree: vite.config.mts sets
 * `dns.setDefaultResultOrder('verbatim')`, so `localhost` may resolve to `::1` while a probe
 * against `127.0.0.1` reports the port free.
 */
export const DEV_SERVER_HOST = 'localhost';

/**
 * Ports offered to the dev server, in order.
 *
 * 4200 comes first so that a single dev server behaves exactly as it always has — `.env` points
 * NX_PUBLIC_CLIENT_URL at http://localhost:4200/app, which the API uses as the post-login redirect
 * target, so the first server started should own that port.
 *
 * Additional worktrees running at the same time land on 4210+. 4201-4209 are deliberately skipped:
 * jetstream-desktop-client uses 4201 and jetstream-canvas uses 4202.
 */
const CANDIDATE_PORTS = [4200, ...Array.from({ length: 90 }, (_, index) => 4210 + index)];

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen({ port, host: DEV_SERVER_HOST });
  });
}

/**
 * Finds a free dev server port so that several worktrees can run `pnpm start` at the same time
 * against one shared API. Set JETSTREAM_DEV_PORT to bypass the search and pin a specific port.
 *
 * There is a small window between releasing the probed port and Vite binding it. `strictPort` is
 * enabled in vite.config.mts so that losing that race fails loudly rather than silently drifting
 * onto the desktop client's or canvas's port.
 */
export async function resolveDevServerPort(): Promise<number> {
  const { JETSTREAM_DEV_PORT } = process.env;
  if (JETSTREAM_DEV_PORT) {
    const explicitPort = Number(JETSTREAM_DEV_PORT);
    if (!Number.isInteger(explicitPort) || explicitPort < 1 || explicitPort > 65535) {
      throw new Error(`JETSTREAM_DEV_PORT must be a port number between 1 and 65535, got "${JETSTREAM_DEV_PORT}".`);
    }
    return explicitPort;
  }

  for (const port of CANDIDATE_PORTS) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(
    `No free dev server port found in ${CANDIDATE_PORTS[0]}-${CANDIDATE_PORTS[CANDIDATE_PORTS.length - 1]}. ` +
      `Stop an unused dev server or set JETSTREAM_DEV_PORT to choose one explicitly.`,
  );
}

const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function getCurrentBranch(workspaceRoot: string): string | null {
  try {
    return execFileSync('git', ['branch', '--show-current'], { cwd: workspaceRoot, encoding: 'utf8', timeout: 2000 }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Prints which worktree this dev server belongs to and which API it proxies to. Vite's own URL
 * banner only reports the port, which is ambiguous once several worktrees are running at once.
 */
export const devServerBannerPlugin: (apiServerUrl: string) => PluginOption = (apiServerUrl) => {
  return {
    name: 'jetstream-dev-server-banner',
    apply: 'serve',
    configureServer(server) {
      const workspaceRoot = join(import.meta.dirname, '../..');
      const branch = getCurrentBranch(workspaceRoot);
      const worktree = basename(workspaceRoot);

      const printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        printUrls();
        server.config.logger.info(`  ${GREEN}➜${RESET}  ${DIM}Worktree${RESET}: ${worktree}${branch ? ` ${DIM}(${branch})${RESET}` : ''}`);
        server.config.logger.info(`  ${GREEN}➜${RESET}  ${DIM}API${RESET}:      ${apiServerUrl} ${DIM}(proxied)${RESET}`);
      };
    },
  };
};
