/* eslint-disable @typescript-eslint/no-use-before-define */
import { Connection } from 'jsforce';
import { parseQuery, Query } from 'soql-parser-js';
import { QueryColumnsSfdc, QueryColumnMetadata } from '../types/types';
import { QueryResultsColumns, QueryResultsColumn, QueryResults } from '@silverthorn/api-interfaces';

export async function queryRecords(conn: Connection, query: string, isTooling = false): Promise<QueryResults> {
  // Fetch records from SFDC
  const queryResults = await (isTooling ? conn.tooling.query(query) : conn.query(query));

  let columns: QueryResultsColumns;
  let parsedQuery: Query;

  // get column info from SFDC
  try {
    const tempColumns = (await conn.request({
      method: 'GET',
      url: `${isTooling ? '/tooling' : ''}/query/?q=${query}&columns=true`,
    })) as QueryColumnsSfdc;

    columns = {
      entityName: columns.entityName,
      groupBy: columns.groupBy,
      idSelected: columns.idSelected,
      keyPrefix: columns.keyPrefix,
      columns: tempColumns.columnMetadata.flatMap((column) => flattenQueryColumn(column)),
    };
  } catch (ex) {
    console.log('Error fetching columns');
  }

  // Attempt to parse columns from query
  try {
    parsedQuery = parseQuery(query);
  } catch (ex) {
    console.log('Error parsing query');
  }

  return { queryResults, columns, parsedQuery };
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
      output = output.concat(column.joinColumns.flatMap((joinColumn) => flattenQueryColumn(joinColumn, currColumnPath)));
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
        childColumnPaths: column.joinColumns.flatMap((joinColumn) => flattenQueryColumn(joinColumn, currColumnPath)),
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