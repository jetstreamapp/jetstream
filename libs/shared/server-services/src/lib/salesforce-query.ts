/* eslint-disable @typescript-eslint/no-use-before-define */
import { QueryResults, QueryResultsColumns } from '@jetstream/api-interfaces';
import { flattenQueryColumn } from '@jetstream/shared/utils';
import { QueryColumnsSfdc } from '@jetstream/types';
import type { Connection } from 'jsforce';
import { Query, parseQuery } from 'soql-parser-js';

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

  let columns: QueryResultsColumns | undefined = undefined;
  let parsedQuery: Query | undefined = undefined;

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
      columns: tempColumns.columnMetadata.flatMap((column) => flattenQueryColumn(column)),
    };
  } catch (ex) {
    console.error('Error fetching columns', ex);
  }

  // Attempt to parse columns from query
  try {
    parsedQuery = parseQuery(query);
  } catch (ex) {
    console.info('Error parsing query');
  }

  return { queryResults, columns, parsedQuery };
}

export async function queryMoreRecords(conn: Connection, nextRecordsUrl: string, isTooling = false): Promise<QueryResults> {
  const queryResults = await (isTooling ? conn.tooling.queryMore(nextRecordsUrl) : conn.queryMore(nextRecordsUrl));
  return { queryResults };
}
