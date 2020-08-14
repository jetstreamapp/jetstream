/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { convertFiltersToWhereClause } from '@jetstream/shared/ui-utils';
import { ExpressionType, ListItemGroup, MapOf, QueryFields, WorkerMessage } from '@jetstream/types';
import { composeQuery, Query } from 'soql-parser-js';
import { logger } from '@jetstream/shared/client-logger';

const CHILD_FIELD_SEPARATOR = `~`;

type MessageName = 'composeQuery' | 'calculateFilter';

// eslint-disable-next-line no-restricted-globals
const ctx: Worker = self as any;

// Respond to message from parent thread
ctx.addEventListener('message', (event) => {
  const payload: WorkerMessage<MessageName> = event.data;
  logger.info('[WORKER]', { payload });
  handleMessage(payload.name, payload.data);
});

function handleMessage(name: MessageName, payloadData: any) {
  switch (name) {
    case 'composeQuery': {
      const { query, whereExpression }: { query: Query; whereExpression: ExpressionType } = payloadData;
      query.where = convertFiltersToWhereClause(whereExpression);

      const soql = composeQuery(query, { format: true });
      replyToMessage(name, soql);
      break;
    }
    case 'calculateFilter': {
      const queryFieldsMap: MapOf<QueryFields> = payloadData;
      const newFilterFields: ListItemGroup[] = [];
      Object.values(queryFieldsMap)
        .filter((queryField) => !queryField.key.includes(CHILD_FIELD_SEPARATOR))
        .forEach((queryField) => {
          const [base, path] = queryField.key.split('|');
          const currGroup: ListItemGroup = {
            id: queryField.key,
            label: path ? path.substring(0, path.length - 1) : base,
            items: [],
          };
          newFilterFields.push(currGroup);
          if (!path) {
            Object.values(queryField.fields).forEach((field) => {
              const value = `${path || ''}${field.name}`;
              currGroup.items.push({
                id: value,
                label: field.label,
                secondaryLabel: `(${field.name})`,
                value: value,
                meta: field,
              });
            });
          } else {
            queryField.selectedFields.forEach((selectedFieldKey) => {
              const field = queryField.fields[selectedFieldKey];
              const value = `${path || ''}${field.name}`;
              currGroup.items.push({
                id: value,
                label: field.label,
                secondaryLabel: `(${field.name})`,
                value: value,
                meta: field,
              });
            });
          }
        });
      replyToMessage(name, newFilterFields);
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
