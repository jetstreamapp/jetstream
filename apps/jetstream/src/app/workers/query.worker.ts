/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { composeQuery, Query } from 'soql-parser-js';
import { WorkerMessage } from '@jetstream/types';

type MessageName = 'composeQuery';

// eslint-disable-next-line no-restricted-globals
const ctx: Worker = self as any;

// Respond to message from parent thread
ctx.addEventListener('message', (event) => {
  const payload: WorkerMessage<MessageName> = event.data;
  handleMessage(payload.name, payload.data);
});

function handleMessage(name: MessageName, payloadData: any) {
  switch (name) {
    case 'composeQuery': {
      const data: Query = payloadData;
      const soql = composeQuery(data, { format: true });
      replyToMessage(name, soql);
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
