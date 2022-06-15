/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { initForElectron } from '@jetstream/shared/data';
import { ExpressionType, MapOf, QueryFields, WorkerMessage } from '@jetstream/types';
import { Query } from 'soql-parser-js';
import { axiosElectronAdapter, initMessageHandler } from '../components/core/electron-axios-adapter';
import { calculateFilterAndOrderByListGroupFields, composeSoqlQuery } from '../components/query/utils/query-utils';

type MessageName = 'isElectron' | 'composeQuery' | 'calculateFilter';

// eslint-disable-next-line no-restricted-globals
const ctx: Worker = self as any;

// Respond to message from parent thread
ctx.addEventListener('message', (event) => {
  const payload: WorkerMessage<MessageName> = event.data;
  logger.info('[WORKER]', { payload });
  handleMessage(payload.name, payload.data, event.ports?.[0]);
});

function handleMessage(name: MessageName, payloadData: any, port?: MessagePort) {
  switch (name) {
    case 'isElectron': {
      initForElectron(axiosElectronAdapter);
      initMessageHandler(port);
      break;
    }
    case 'composeQuery': {
      const { query, whereExpression }: { query: Query; whereExpression: ExpressionType } = payloadData;
      replyToMessage(name, composeSoqlQuery(query, whereExpression));
      break;
    }
    case 'calculateFilter': {
      const queryFieldsMap: MapOf<QueryFields> = payloadData;
      replyToMessage(name, calculateFilterAndOrderByListGroupFields(queryFieldsMap));
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
