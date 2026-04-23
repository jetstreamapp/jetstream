import '@jetstream/api-config'; // this gets imported first to ensure as some items require early initialization
import { ENV, logger, pgPool, prisma } from '@jetstream/api-config';
import { hashPassword, pruneExpiredRecords } from '@jetstream/auth/server';
import '@jetstream/auth/types';
import { AsyncIntervalTimer } from '@jetstream/shared/node-utils';
import cluster, { Worker } from 'node:cluster';

// Worker respawn backoff — guards against tight fork loops when a worker crashes on
// startup (bad env, DB unreachable). After too many consecutive rapid failures the
// primary exits and the platform supervisor (Render) replaces the container.
const WORKER_BACKOFF_MIN_MS = 1_000;
const WORKER_BACKOFF_MAX_MS = 30_000;
const WORKER_FAILURE_RESET_MS = 60_000;
const WORKER_MAX_CONSECUTIVE_FAILURES = 10;

let recentWorkerFailureCount = 0;
let lastWorkerFailureTime = 0;
let isPrimaryShuttingDown = false;
const pendingRespawnTimers = new Set<NodeJS.Timeout>();

/**
 * Respawn a worker after it dies, with exponential backoff on rapid consecutive failures.
 * Wired via `cluster.on('exit', handleWorkerExit)` in the primary branch.
 * First failure respawns immediately; subsequent rapid failures (within
 * WORKER_FAILURE_RESET_MS) back off exponentially up to WORKER_BACKOFF_MAX_MS; after
 * WORKER_MAX_CONSECUTIVE_FAILURES the primary exits for the supervisor to take over.
 */
export function handleWorkerExit(worker: Worker, code: number | null, signal: string | null): void {
  if (isPrimaryShuttingDown) {
    return;
  }

  // Clean exits (future code: intentional rotation, memory-threshold restart, etc.)
  // respawn immediately and don't feed the spin-loop counter.
  const isCleanExit = code === 0 && signal === null;
  if (isCleanExit) {
    logger.info({ code, signal, pid: worker.process.pid }, `worker ${worker.process.pid} exited cleanly, respawning`);
    cluster.fork();
    return;
  }

  const now = Date.now();
  if (now - lastWorkerFailureTime > WORKER_FAILURE_RESET_MS) {
    recentWorkerFailureCount = 0;
  }
  recentWorkerFailureCount += 1;
  lastWorkerFailureTime = now;

  logger.info({ code, signal, pid: worker.process.pid, recentWorkerFailureCount }, `worker ${worker.process.pid} died, respawning`);

  if (recentWorkerFailureCount >= WORKER_MAX_CONSECUTIVE_FAILURES) {
    logger.error(
      { recentWorkerFailureCount },
      'Too many consecutive worker failures — exiting primary so the platform supervisor can replace the container',
    );
    process.exit(1);
  }

  const backoffMs =
    recentWorkerFailureCount <= 1 ? 0 : Math.min(WORKER_BACKOFF_MIN_MS * 2 ** (recentWorkerFailureCount - 2), WORKER_BACKOFF_MAX_MS);

  if (backoffMs > 0) {
    logger.info({ backoffMs, recentWorkerFailureCount }, 'Delaying worker respawn');
    // Track the pending timer so shutdownPrimaryGracefully can cancel it if SIGTERM
    // arrives during the backoff window. Also re-check the flag inside the callback
    // as a belt-and-suspenders guard: if the shutdown path didn't cancel in time
    // (e.g. the timer was in the tail of Node's queue), we still bail before forking
    // an orphan worker that would outlive the primary's graceful shutdown.
    const timer = setTimeout(() => {
      pendingRespawnTimers.delete(timer);
      if (isPrimaryShuttingDown) {
        return;
      }
      cluster.fork();
    }, backoffMs);
    pendingRespawnTimers.add(timer);
  } else {
    cluster.fork();
  }
}

/**
 * Forward SIGTERM from the primary to all workers and wait for them to exit cleanly.
 * Each worker has its own SIGTERM handler (see main.ts worker branch) that drains in-flight
 * requests and closes the pg pool. The primary exits once all workers have exited, or after
 * `timeoutMs` if any worker hangs.
 */
export function shutdownPrimaryGracefully(timeoutMs = 30_000): void {
  if (isPrimaryShuttingDown) {
    return;
  }
  isPrimaryShuttingDown = true;

  // Cancel any pending worker respawn scheduled by handleWorkerExit — otherwise a
  // timer armed up to WORKER_BACKOFF_MAX_MS ago could fire after this function has
  // already snapshotted cluster.workers, spawning an orphan worker that is never
  // sent SIGTERM and outlives the primary's process.exit().
  for (const timer of pendingRespawnTimers) {
    clearTimeout(timer);
  }
  pendingRespawnTimers.clear();

  logger.info('Primary received SIGTERM, forwarding to workers');

  const workers = Object.values(cluster.workers || {}).filter((worker): worker is Worker => worker !== undefined);

  // Branch explicitly so there's no fall-through path after `process.exit(0)`. A plain
  // early-out with `return` is cleaner to read, but TypeScript sees `process.exit` as
  // `never` and would treat the trailing return as unreachable — deleting it (or a
  // future refactor that stubs `process.exit` for tests) would silently re-introduce
  // the footgun where we kick off a 30s setTimeout after a "shutdown."
  if (workers.length === 0) {
    logger.info('No workers to shut down, exiting primary');
    process.exit(0);
  } else {
    let exitedCount = 0;
    const onWorkerExit = () => {
      exitedCount += 1;
      logger.info({ exitedCount, total: workers.length }, 'worker exited during shutdown');
      if (exitedCount >= workers.length) {
        logger.info('All workers exited cleanly, shutting down primary');
        process.exit(0);
      }
    };

    for (const worker of workers) {
      worker.once('exit', onWorkerExit);
      worker.kill('SIGTERM');
    }

    setTimeout(() => {
      logger.error({ exitedCount, total: workers.length }, 'Workers did not exit in time, forcing primary shutdown');
      process.exit(1);
    }, timeoutMs);
  }
}

export async function primaryClusterInitSideEffects() {
  if (!cluster.isPrimary) {
    return;
  }

  console.log(`
     ██╗███████╗████████╗███████╗████████╗██████╗ ███████╗ █████╗ ███╗   ███╗
     ██║██╔════╝╚══██╔══╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔══██╗████╗ ████║
     ██║█████╗     ██║   ███████╗   ██║   ██████╔╝█████╗  ███████║██╔████╔██║
██   ██║██╔══╝     ██║   ╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║
╚█████╔╝███████╗   ██║   ███████║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║
 ╚════╝ ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝

NODE_ENV=${ENV.NODE_ENV}
ENVIRONMENT=${ENV.ENVIRONMENT}
VERSION=${ENV.VERSION ?? '<unspecified>'}
LOG_LEVEL=${ENV.LOG_LEVEL}
JETSTREAM_SERVER_URL=${ENV.JETSTREAM_SERVER_URL}
JETSTREAM_CLIENT_URL=${ENV.JETSTREAM_CLIENT_URL}
`);

  // Crash if we can't connect to the database
  try {
    await prisma.$connect();
    await pgPool.query('SELECT 1');
    logger.info('Primary process: Database connection successful');
  } catch (error) {
    logger.error({ err: error }, 'Primary process: Database connection failed - application will not start');
    process.exit(1);
  }

  await initExampleUserIfRequired();

  // Prune expired records every hour, wait for 30 seconds after startup to allow for other services to start
  setTimeout(() => {
    new AsyncIntervalTimer(pruneExpiredRecords, { name: 'pruneExpiredRecords', intervalMs: /** 1 hour */ 60 * 60 * 1000, runOnInit: true });
  }, 1000 * 30); // Delay 30 seconds to allow for other services to start
}

async function initExampleUserIfRequired() {
  try {
    if (ENV.EXAMPLE_USER && ENV.EXAMPLE_USER_PASSWORD && (ENV.ENVIRONMENT !== 'production' || ENV.CI)) {
      const passwordHash = await hashPassword(ENV.EXAMPLE_USER_PASSWORD);
      const user = ENV.EXAMPLE_USER;
      logger.info('Upserting example user. id: %s', user.id);
      await prisma.user.upsert({
        create: {
          id: user.id,
          userId: user.userId,
          email: user.email,
          emailVerified: user.emailVerified,
          name: user.name,
          password: passwordHash,
          passwordUpdatedAt: new Date(),
          lastLoggedIn: new Date(),
          preferences: { create: { skipFrontdoorLogin: false } },
          authFactors: { create: { type: '2fa-email', enabled: false } },
          entitlements: { create: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false } },
        },
        update: {
          entitlements: {
            upsert: {
              create: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false },
              update: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false },
            },
          },
        },
        where: { id: user.id },
      });
    }
  } catch (ex) {
    logger.error({ err: ex }, '[EXAMPLE_USER][ERROR] Fatal error, could not upsert example user');
    process.exit(1);
  }
}
