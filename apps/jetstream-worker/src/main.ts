import { ENV, logger } from '@jetstream/api-config';
import Fastify from 'fastify';
import PgBoss from 'pg-boss';
import emailJob, { EMAIL_JOB_TYPE } from './app/jobs/email.job';
import { POST_JOB_SCHEMA } from './app/schemas';
import { JobRequestEmail } from './app/types';

let boss: PgBoss;
const fastify = Fastify({
  logger: true,
});

/**
 * API REQUEST HANDLERS
 * THIS IS INTENDED BE BE DEPLOYED IN A PRIVATE SERVICE, SO NO AUTH CHECK IS PERFORMED
 */

fastify.post<{ Body: JobRequestEmail }>('/job', { schema: { body: POST_JOB_SCHEMA } }, async (request, reply) => {
  try {
    if (request.body.type === 'EMAIL') {
      const jobId = await boss.publish(EMAIL_JOB_TYPE, request.body.payload);
      reply.type('application/json').code(200);
      return { jobId: jobId, error: null, success: true };
    }

    reply.type('application/json').code(400);
    return { jobId: null, error: 'Invalid type', success: false };
  } catch (ex) {
    fastify.log.error(ex);
    reply.type('application/json').code(400);
    return { jobId: null, errors: ex.message, success: false };
  }
});

/**
 * START WORKER AND SERVER
 */
async function start() {
  await initWorker();
  await initServer();
}

/**
 * START JOB WORKER
 */
async function initWorker() {
  logger.info('[STARTING WORKER]');
  try {
    boss = new PgBoss({
      connectionString: ENV.JETSTREAM_POSTGRES_DBURI,
      application_name: 'jetstream-worker',
    });

    boss.on('error', (error) => logger.error('[ERROR] %o', error));
    // boss.on('maintenance', () => logger.info('[MAINTENANCE]'));
    boss.on('monitor-states', (states) => logger.info('[MONITOR-STATES] %o', states));
    boss.on('stopped', () => logger.info('[STOPPED]'));
    // boss.on('wip', (data) => logger.info('[WIP] %o', data));

    await boss.start();

    await boss.subscribe(EMAIL_JOB_TYPE, { teamSize: 1, teamConcurrency: 2 }, emailJob);
  } catch (ex) {
    logger.error('[STARTING WORKER][FAILED] %s', ex.message);
    logger.error('%o', ex);
    process.exit(1);
    // TODO: can we try to restart? Can we use PM to restart?
  }
}

async function initServer() {
  logger.info('[STARTING SERVER] PORT: %s', ENV.PORT);
  try {
    await fastify.listen(ENV.PORT);
  } catch (ex) {
    fastify.log.error(ex);
    logger.error('[STARTING SERVER][FAILED] %s', ex.message);
    logger.error('%o', ex);
    process.exit(1);
  }
}

start();
