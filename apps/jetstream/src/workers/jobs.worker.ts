/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import type { AsyncJobType, AsyncJobWorkerMessagePayload, WorkerMessage } from '@jetstream/types';
import { JobWorker } from '@jetstream/ui-core';

declare const self: DedicatedWorkerGlobalScope;
logger.log('[JOBS WORKER] INITIALIZED');

const jobWorker = new JobWorker(replyToMessage);

self.addEventListener('error', (event) => {
  console.log('WORKER ERROR', event);
});

// Respond to message from parent thread
self.addEventListener('message', (event) => {
  const payload: WorkerMessage<AsyncJobType, AsyncJobWorkerMessagePayload> = event.data;
  logger.info({ payload });
  jobWorker.handleMessage(payload.name, payload.data, event.ports?.[0]);
});

function replyToMessage(name: string, data: any, error?: any, transferrable?: any) {
  transferrable = transferrable ? [transferrable] : undefined;
  self.postMessage({ name, data, error }, transferrable);
}
