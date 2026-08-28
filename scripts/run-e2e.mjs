/**
 * Self-contained local E2E runner for the web app suite (apps/jetstream-e2e).
 *
 * Builds api + jetstream + landing with the server/client URLs baked for a dedicated port
 * (default 3322) so a run never collides with `pnpm start:api` (3333) or the Vite dev server
 * (4200), starts the built server, waits for it to respond, runs Playwright headless, and tears
 * the server down. No .env changes are required — CLI-provided env vars take precedence over
 * .env in Vite, Next, Nx and dotenv alike.
 *
 * Usage:
 *   pnpm e2e:local                          # full suite
 *   pnpm e2e:local query-results.spec.ts    # single spec (login setup still runs first)
 *   pnpm e2e:local query                    # folder filter — everything under src/tests/query
 *   pnpm e2e:local --grep "load records"    # any other Playwright args pass straight through
 *   pnpm e2e:local --skip-build --headed    # reuse the existing dist build, headed browser
 *   pnpm e2e:local --port 3324              # alternate port (or E2E_PORT env var)
 *   pnpm e2e:local --build-only             # prewarm the build without running tests
 *   pnpm e2e:local --db postgres://...      # dedicated database (or E2E_POSTGRES_DBURI env var)
 *
 * Requires a running local postgres. By default the run shares the dev database from .env
 * (isolation is at the port level, not the data level). Pass --db <uri> — or set
 * E2E_POSTGRES_DBURI in your gitignored .env — to use a dedicated database instead: the script
 * creates it if missing, applies migrations and runs the (idempotent) seed, and the server
 * provisions the example login user itself on boot.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(REPO_ROOT);

// Load .env so E2E_PORT / E2E_POSTGRES_DBURI defined there are honored as defaults.
// Real shell env vars still win — dotenv never overrides existing values.
dotenv.config({ path: join(REPO_ROOT, '.env'), quiet: true });

const SERVER_READY_TIMEOUT_MS = 90_000;
const SERVER_LOG_PATH = join(REPO_ROOT, 'dist', 'e2e-server.log');

function printHelp() {
  console.log(`Local E2E runner — builds, serves on an isolated port, runs Playwright headless.

Usage: pnpm e2e:local [options] [playwright args...]

Options handled by this script (everything else is passed to \`playwright test\`):
  --port <number>   Port for the app server (default: E2E_PORT env var or 3322)
  --db <uri>        Postgres URI for a dedicated e2e database (default: E2E_POSTGRES_DBURI env
                    var, else the dev database from .env). Created/migrated/seeded automatically.
  --skip-build      Skip prisma generate + nx build and use the existing dist output
  --build-only      Build for the target port and exit without starting the server or tests

Examples (spec filters are regexes matched against file paths — a folder name works too):
  pnpm e2e:local
  pnpm e2e:local query-results.spec.ts --headed
  pnpm e2e:local query
  pnpm e2e:local --skip-build --grep "load records"
`);
}

function parseArgs(argv) {
  const options = {
    port: Number(process.env.E2E_PORT) || 3322,
    dbUri: process.env.E2E_POSTGRES_DBURI || null,
    skipBuild: false,
    buildOnly: false,
    playwrightArgs: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--port') {
      options.port = Number(argv[++i]);
      if (!Number.isInteger(options.port) || options.port <= 0) {
        console.error('--port requires a valid port number');
        process.exit(1);
      }
    } else if (arg === '--db') {
      options.dbUri = argv[++i];
      if (!options.dbUri || !options.dbUri.startsWith('postgres')) {
        console.error('--db requires a postgres connection URI');
        process.exit(1);
      }
    } else if (arg === '--skip-build') {
      options.skipBuild = true;
    } else if (arg === '--build-only') {
      options.buildOnly = true;
    } else {
      options.playwrightArgs.push(arg);
    }
  }
  return options;
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const finish = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(1_000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function assertPortFree(port) {
  if (await isPortInUse(port)) {
    console.error(
      `\n[e2e] Port ${port} is already in use — refusing to run against an unknown server.\n` +
        `Stop whatever is listening there, or pick another port with --port <number> (a different port requires a rebuild).\n`,
    );
    process.exit(1);
  }
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env, cwd: REPO_ROOT });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))));
  });
}

/**
 * CREATE DATABASE is additive and safe — everything else (migrate/seed) goes through the
 * prisma CLI. Failures here are non-fatal: migrate deploy will surface the real error.
 */
async function ensureDatabaseExists(dbUri) {
  const databaseName = decodeURIComponent(new URL(dbUri).pathname.replace(/^\//, ''));
  if (!databaseName) {
    return;
  }
  const adminUrl = new URL(dbUri);
  adminUrl.pathname = '/postgres';
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (rowCount === 0) {
      console.log(`[e2e] Creating database "${databaseName}"`);
      await client.query(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
    }
  } catch (error) {
    console.warn(
      `[e2e] Could not verify/create database "${databaseName}" (${error.message}) — continuing, migrate will surface any real problem`,
    );
  } finally {
    await client.end().catch(() => {});
  }
}

function printServerLogTail() {
  try {
    const lines = readFileSync(SERVER_LOG_PATH, 'utf8').trimEnd().split('\n');
    console.error(`\n--- last ${Math.min(lines.length, 40)} lines of ${SERVER_LOG_PATH} ---`);
    console.error(lines.slice(-40).join('\n'));
  } catch {
    // No log written — nothing to show.
  }
}

/**
 * Polls /healthz (which runs SELECT 1 against the DB) rather than the root URL — the root is
 * served from static landing files and would report "ready" even with an unreachable database.
 */
async function waitForServer(serverUrl, serverProcess) {
  const healthUrl = `${serverUrl}/healthz`;
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  let lastFailure = 'no response';
  let serverExited = false;
  serverProcess.once('exit', () => {
    serverExited = true;
  });
  while (Date.now() < deadline) {
    if (serverExited) {
      throw new Error('Server process exited before becoming ready');
    }
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5_000) });
      if (response.status === 200) {
        return;
      }
      lastFailure = `HTTP ${response.status}: ${(await response.text().catch(() => '')).slice(0, 200)}`;
    } catch (error) {
      // Not listening yet (or the request timed out) — keep polling, but remember why so the
      // timeout report says ECONNREFUSED/timeout instead of a generic "no response".
      lastFailure = error.cause?.message || error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server was not healthy at ${healthUrl} within ${SERVER_READY_TIMEOUT_MS / 1000}s (last failure: ${lastFailure})`);
}

/**
 * The API server is a cluster (primary + workers), so signal the whole process group —
 * signalling only the primary can leave workers (or a hung primary) holding the port.
 * The server is spawned detached to guarantee it has its own group to signal.
 */
function killServerGroup(serverProcess, signal) {
  try {
    process.kill(-serverProcess.pid, signal);
  } catch {
    // Group already gone — fall back to the direct pid in case it exists outside a group.
    try {
      serverProcess.kill(signal);
    } catch {
      // Already dead.
    }
  }
}

async function stopServer(serverProcess) {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return;
  }
  const exited = new Promise((resolve) => serverProcess.once('exit', resolve));
  killServerGroup(serverProcess, 'SIGTERM');
  const forceKillTimer = setTimeout(() => killServerGroup(serverProcess, 'SIGKILL'), 5_000);
  // SIGKILL only fails on a process stuck in uninterruptible kernel sleep — bound the wait so
  // teardown can never hang the runner; the process 'exit' hook remains the last-resort kill.
  const deadline = new Promise((resolve) => setTimeout(resolve, 10_000).unref());
  await Promise.race([exited, deadline]);
  clearTimeout(forceKillTimer);
}

async function main() {
  const { port, dbUri, skipBuild, buildOnly, playwrightArgs } = parseArgs(process.argv.slice(2));
  const serverUrl = `http://localhost:${port}`;

  // These override anything in .env for every child process (builds, server, prisma CLI and
  // Playwright), which is what lets this script work with zero .env changes.
  const env = {
    ...process.env,
    PORT: String(port),
    NX_PUBLIC_SERVER_URL: serverUrl,
    NX_PUBLIC_CLIENT_URL: `${serverUrl}/app`,
    ...(dbUri ? { JETSTREAM_POSTGRES_DBURI: dbUri } : {}),
  };

  // Never let the HTML reporter block a non-interactive run by serving the report and waiting.
  if (!process.stdout.isTTY && !env.PLAYWRIGHT_HTML_OPEN) {
    env.PLAYWRIGHT_HTML_OPEN = 'never';
  }

  // Fail fast before the (potentially long) build/migrate work. --build-only never binds the
  // port, so a busy port is fine there. Checked again right before the server starts, since the
  // port can become occupied mid-build.
  if (!buildOnly) {
    await assertPortFree(port);
  }

  if (!skipBuild) {
    console.log(`\n[e2e] Building api, jetstream and landing for ${serverUrl} (nx cache applies)\n`);
    await run('pnpm', ['db:generate'], env);
    await run(
      'pnpm',
      [
        'nx',
        'run-many',
        '--output-style=static',
        '--target=build',
        '--parallel=4',
        '--projects=api,jetstream,landing',
        '--configuration=production',
      ],
      env,
    );
  }

  if (buildOnly) {
    console.log('\n[e2e] Build complete (--build-only)\n');
    return;
  }

  // With a dedicated database, make it fully self-service: create if missing, migrate, seed.
  // The example login user is provisioned by the server itself on boot, and the seed only
  // inserts reference data with skipDuplicates, so re-running is safe.
  if (dbUri) {
    const redactedUri = dbUri.replace(/\/\/[^@/]*@/, '//***@');
    console.log(`[e2e] Using dedicated database ${redactedUri}`);
    await ensureDatabaseExists(dbUri);
    await run('pnpm', ['db:migrate'], env);
    await run('pnpm', ['db:seed'], env);
  }

  await assertPortFree(port);

  mkdirSync(dirname(SERVER_LOG_PATH), { recursive: true });
  const serverLog = createWriteStream(SERVER_LOG_PATH);
  console.log(`[e2e] Starting server at ${serverUrl} (logs: ${SERVER_LOG_PATH})`);
  // detached gives the server its own process group so teardown can signal primary + workers
  // together (see killServerGroup).
  const serverProcess = spawn('node', ['dist/apps/api/main.js'], {
    env,
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  // Both pipes share one destination, so neither may auto-end it — the first stream to close
  // would end the log while the other still has writes pending. End it once the child is done.
  serverProcess.stdout.pipe(serverLog, { end: false });
  serverProcess.stderr.pipe(serverLog, { end: false });
  serverProcess.once('close', () => serverLog.end());
  // A failed spawn emits 'error' (never 'exit'); without a listener that crashes the runner as an
  // unhandled error event with no cleanup or explanation.
  serverProcess.once('error', (error) => {
    console.error(`\n[e2e] Server process error: ${error.message}`);
    process.exit(1);
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log('\n[e2e] Interrupted — stopping server');
    await stopServer(serverProcess);
    process.exit(130);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  // Last-resort safety net for unexpected exits (crash after boot, etc.).
  process.on('exit', () => {
    if (serverProcess.exitCode === null) {
      killServerGroup(serverProcess, 'SIGKILL');
    }
  });

  try {
    await waitForServer(serverUrl, serverProcess);
  } catch (error) {
    console.error(`\n[e2e] ${error.message}`);
    printServerLogTail();
    console.error(
      '\n[e2e] Common causes: postgres is not running, migrations have not been applied (pnpm db:migrate), ' +
        'or the DB is missing seeded users (pnpm db:seed).\n',
    );
    await stopServer(serverProcess);
    process.exit(1);
  }

  console.log(`[e2e] Server ready — running Playwright (headless unless --headed/--ui passed)\n`);
  let exitCode = 0;
  try {
    await run('pnpm', ['exec', 'playwright', 'test', '--config', 'apps/jetstream-e2e/playwright.config.ts', ...playwrightArgs], env);
  } catch {
    exitCode = 1;
    console.error(
      '\n[e2e] Playwright failed. Traces/screenshots/error-context: dist/.playwright/apps/jetstream-e2e/test-output — ' +
        'view the report with: pnpm exec playwright show-report apps/jetstream-e2e/playwright-report\n',
    );
  } finally {
    await stopServer(serverProcess);
  }
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(`\n[e2e] ${error.message}`);
  process.exit(1);
});
