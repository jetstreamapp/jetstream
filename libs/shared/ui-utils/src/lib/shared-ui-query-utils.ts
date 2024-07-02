import { logger } from '@jetstream/shared/client-logger';
import { FetchDebugLogOptions } from '@jetstream/types';
import { composeQuery, ConditionWithValueQuery, getField, Query, WhereClauseWithoutOperator } from '@jetstreamapp/soql-parser-js';
import isNumber from 'lodash/isNumber';

export function getApexLogsQuery({ userId, limit, asOfId }: FetchDebugLogOptions = {}) {
  limit = isNumber(limit) ? Math.abs(limit) : 100;
  const query: Query = {
    fields: [
      getField('Id'),
      getField('LogUser.Id'),
      getField('LogUser.Name'),
      getField('LogUser.Username'),
      getField('Application'),
      getField('Operation'),
      getField('Status'),
      getField('Location'),
      getField('LogLength'),
      getField('Request'),
      getField('RequestIdentifier'),
      getField('DurationMilliseconds'),
      getField('StartTime'),
      getField('LastModifiedDate'),
      getField('SystemModstamp'),
    ],
    sObject: 'ApexLog',
    orderBy: [{ field: 'LastModifiedDate', order: 'DESC' }],
    limit,
  };

  if (userId) {
    query.where = {
      left: {
        field: 'LogUserId',
        operator: '=',
        value: userId,
        literalType: 'STRING',
      },
    };
  }

  if (asOfId) {
    const leftClause: ConditionWithValueQuery = {
      field: 'Id',
      operator: '>',
      value: asOfId,
      literalType: 'STRING',
    };
    if (query.where) {
      query.where = { ...(query.where as WhereClauseWithoutOperator), operator: 'AND', right: { left: leftClause } };
    } else {
      query.where = { left: leftClause };
    }
  }

  const soql = composeQuery(query);
  logger.info('getApexLogsQuery()', { soql });
  return soql;
}

export function getApexLogsToDeleteQuery(userId?: string) {
  const query: Query = { fields: [getField('Id')], sObject: 'ApexLog', orderBy: [{ field: 'LastModifiedDate', order: 'DESC' }] };

  if (userId) {
    query.where = {
      left: {
        field: 'LogUserId',
        operator: '=',
        value: userId,
        literalType: 'STRING',
      },
    };
  }

  const soql = composeQuery(query);
  logger.info('getApexLogsToDeleteQuery()', { soql });
  return soql;
}

export function getTraceFlagQuery(userId: string) {
  const query: Query = {
    fields: [
      getField('Id'),
      getField('LogType'),
      getField('TracedEntityId'),
      getField('StartDate'),
      getField('ExpirationDate'),
      getField('DebugLevelId'),
    ],
    sObject: 'TraceFlag',
    orderBy: [{ field: 'ExpirationDate', order: 'DESC' }],
    limit: 1,
    where: {
      left: {
        field: 'TracedEntityId',
        operator: '=',
        value: userId,
        literalType: 'STRING',
      },
    },
  };

  const soql = composeQuery(query);
  logger.info('getTraceFlagQuery()', { soql });
  return soql;
}

export function getDebugLevelQuery() {
  const query: Query = {
    fields: [
      getField('Id'),
      getField('DeveloperName'),
      getField('ApexCode'),
      getField('ApexProfiling'),
      getField('Callout'),
      getField('Database'),
      getField('System'),
      getField('Validation'),
      getField('Visualforce'),
      getField('Wave'),
      getField('Workflow'),
    ],
    sObject: 'DebugLevel',
    orderBy: [{ field: 'DeveloperName', order: 'DESC' }],
  };

  const soql = composeQuery(query);
  logger.info('getDebugLevelQuery()', { soql });
  return soql;
}
