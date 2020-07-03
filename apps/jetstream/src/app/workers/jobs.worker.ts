/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AsyncJobType, WorkerMessage, AsyncJobWorkerMessageResponse, AsyncJobWorkerMessagePayload } from '@jetstream/types';
import { logger } from '@jetstream/shared/client-logger';
import { Record } from 'jsforce';
import { sobjectOperation } from '@jetstream/shared/data';
import { getIdAndObjFromRecordUrl } from '@jetstream/shared/utils';

// eslint-disable-next-line no-restricted-globals
const ctx: Worker = self as any;

// Respond to message from parent thread
ctx.addEventListener('message', (event) => {
  const payload: WorkerMessage<AsyncJobType, AsyncJobWorkerMessagePayload> = event.data;
  logger.info('[WORKER]', { payload });
  handleMessage(payload.name, payload.data);
});

async function handleMessage(name: AsyncJobType, payloadData: AsyncJobWorkerMessagePayload) {
  switch (name) {
    case 'BulkDelete': {
      const { org, job } = payloadData;
      try {
        const { org, job } = payloadData;
        const record: Record | Record[] = job.meta; // TODO: add strong type
        const [id, sobject] = getIdAndObjFromRecordUrl(record.attributes.url);
        const results = await sobjectOperation(org, sobject, 'delete', { ids: id });
        const response: AsyncJobWorkerMessageResponse = {
          job,
          results,
        };
        replyToMessage(name, response);
      } catch (ex) {
        // TODO: reply with error
        const response: AsyncJobWorkerMessageResponse = { job };
        replyToMessage(name, response, ex.message);
      }
      break;
    }
    default:
      break;
  }
}

function replyToMessage(name: string, data: any, error?: any) {
  ctx.postMessage({ name, data, error });
}

export default null as any;
