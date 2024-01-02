/* eslint-disable @typescript-eslint/no-use-before-define */
import { logger } from '@jetstream/api-config';
import { QueryResults, QueryResultsColumn, QueryResultsColumns } from '@jetstream/api-interfaces';
import type { Connection } from 'jsforce';
import { Query, parseQuery } from 'soql-parser-js';
import { QueryColumnMetadata, QueryColumnsSfdc } from '../types/types';

/**
 * TODO:
 * this code should be moved to shared query utils
 * code was already copied there
 */

export async function queryRecords(
  conn: Connection,
  query: string,
  isTooling = false,
  includeDeletedRecords = false
): Promise<QueryResults> {
  // Fetch records from SFDC
  const queryResults = await (isTooling
    ? conn.tooling.query(query, { scanAll: includeDeletedRecords })
    : conn.query(query, { scanAll: includeDeletedRecords }));

  let columns: QueryResultsColumns | undefined;
  let parsedQuery: Query | undefined;

  // get column info from SFDC
  try {
    const tempColumns = (await conn.request({
      method: 'GET',
      url: `${isTooling ? '/tooling' : ''}/query/?${new URLSearchParams({
        q: query,
        columns: 'true',
      }).toString()}`,
    })) as QueryColumnsSfdc;

    columns = {
      entityName: tempColumns.entityName,
      groupBy: tempColumns.groupBy,
      idSelected: tempColumns.idSelected,
      keyPrefix: tempColumns.keyPrefix,
      columns: tempColumns.columnMetadata?.flatMap((column) => flattenQueryColumn(column)),
    };
  } catch (ex) {
    logger.error('Error fetching columns', ex);
  }

  // Attempt to parse columns from query
  try {
    parsedQuery = parseQuery(query);
  } catch (ex) {
    logger.info('Error parsing query');
  }

  return { queryResults, columns, parsedQuery };
}

export async function queryMoreRecords(conn: Connection, nextRecordsUrl: string, isTooling = false): Promise<QueryResults> {
  const queryResults = await (isTooling ? conn.tooling.queryMore(nextRecordsUrl) : conn.queryMore(nextRecordsUrl));
  return { queryResults };
}

////////// PRIVATE ///////////////

/**
 *
 * @param column
 * @param prevColumnPath
 */

function flattenQueryColumn(column: QueryColumnMetadata, prevColumnPath?: string): QueryResultsColumn[] {
  let output: QueryResultsColumn[] = [];
  const currColumnPath = `${prevColumnPath ? `${prevColumnPath}.` : ''}${column.columnName}`;

  if (Array.isArray(column.joinColumns) && column.joinColumns.length > 0) {
    if (column.foreignKeyName) {
      // Parent Query
      output = output.concat((column.joinColumns || [])?.flatMap((joinColumn) => flattenQueryColumn(joinColumn, currColumnPath)));
    } else {
      // Child query
      output.push({
        columnFullPath: currColumnPath,
        aggregate: column.aggregate,
        apexType: column.apexType,
        booleanType: column.booleanType,
        columnName: column.columnName,
        custom: column.custom,
        displayName: column.displayName,
        foreignKeyName: column.foreignKeyName,
        insertable: column.insertable,
        numberType: column.numberType,
        textType: column.textType,
        updatable: column.updatable,
        childColumnPaths: (column.joinColumns || [])?.flatMap((joinColumn) => flattenQueryColumn(joinColumn, currColumnPath)),
      });
    }
  } else {
    output.push({
      columnFullPath: currColumnPath,
      aggregate: column.aggregate,
      apexType: column.apexType,
      booleanType: column.booleanType,
      columnName: column.columnName,
      custom: column.custom,
      displayName: column.displayName,
      foreignKeyName: column.foreignKeyName,
      insertable: column.insertable,
      numberType: column.numberType,
      textType: column.textType,
      updatable: column.updatable,
    });
  }
  return output;
}
