import { flattenQueryColumn, getErrorMessage } from '@jetstream/shared/utils';
import { QueryColumnsSfdc, QueryResult, QueryResults, QueryResultsColumns } from '@jetstream/types';
import { Query, parseQuery } from '@jetstreamapp/soql-parser-js';
import { ApiConnection } from './connection';
import { SalesforceApi } from './utils';

export class ApiQuery extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  async query<T = any>(soql: string, isTooling = false, includeDeletedRecords = false): Promise<QueryResults<T>> {
    const queryVerb = includeDeletedRecords ? 'queryAll' : 'query';
    const url = this.getRestApiUrl(`/${queryVerb}?${new URLSearchParams({ q: soql }).toString()}`, isTooling);
    const queryResults = await this.apiRequest<QueryResult<T>>({
      sessionInfo: this.sessionInfo,
      url,
    });

    let columns: QueryResultsColumns | undefined;
    let parsedQuery: Query | undefined;

    try {
      const tempColumns = await this.apiRequest<QueryColumnsSfdc>({
        method: 'GET',
        sessionInfo: this.sessionInfo,
        url: this.getRestApiUrl(`/query?${new URLSearchParams({ q: soql, columns: 'true' }).toString()}`, isTooling),
      });

      columns = {
        entityName: tempColumns.entityName,
        groupBy: tempColumns.groupBy,
        idSelected: tempColumns.idSelected,
        keyPrefix: tempColumns.keyPrefix,
        columns: tempColumns.columnMetadata?.flatMap((column) => flattenQueryColumn(column)),
      };
    } catch (ex) {
      this.logger.warn({ message: getErrorMessage(ex) }, 'Error fetching columns');
    }

    // Attempt to parse columns from query
    try {
      parsedQuery = parseQuery(soql);
    } catch (ex) {
      this.logger.warn({ message: getErrorMessage(ex) }, 'Error parsing query');
    }

    return { queryResults, columns, parsedQuery };
  }

  async queryMore<T = any>(nextRecordsUrl: string): Promise<QueryResults<T>> {
    const queryResults = await this.apiRequest<QueryResult<T>>({
      sessionInfo: this.sessionInfo,
      url: nextRecordsUrl,
    });
    return { queryResults };
  }
}
