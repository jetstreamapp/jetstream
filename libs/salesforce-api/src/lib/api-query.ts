import { flattenQueryColumn, getErrorMessage } from '@jetstream/shared/utils';
import { CompositeResponse, Maybe, QueryColumnsSfdc, QueryResult, QueryResults, QueryResultsColumns } from '@jetstream/types';
import { Query, parseQuery } from '@jetstreamapp/soql-parser-js';
import { ApiConnection } from './connection';
import { SalesforceApi } from './utils';

export class ApiQuery extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      this.logger.debug({ message: getErrorMessage(ex) }, 'Error fetching columns');
    }

    // Attempt to parse columns from query
    try {
      parsedQuery = parseQuery(soql);
    } catch (ex) {
      this.logger.debug({ message: getErrorMessage(ex) }, 'Error parsing query');
    }

    return { queryResults, columns, parsedQuery };
  }

  /**
   * Identical to query(), but tunnels the requests through the Composite API. The SOQL is still
   * embedded in each subrequest's url, but those travel inside the POST body rather than the HTTP
   * request line, avoiding URL length limits for very long queries, which fail with HTTP 431/414 errors.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async queryComposite<T = any>(soql: string, isTooling = false, includeDeletedRecords = false): Promise<QueryResults<T>> {
    const queryVerb = includeDeletedRecords ? 'queryAll' : 'query';
    const QUERY_REF_ID = 'queryResults';
    const COLUMNS_REF_ID = 'queryColumns';

    // allOrNone defaults to false, so a failed columns subrequest does not impact the query subrequest
    const { compositeResponse } = await this.apiRequest<CompositeResponse>({
      method: 'POST',
      sessionInfo: this.sessionInfo,
      url: this.getRestApiUrl('/composite', isTooling),
      body: {
        compositeRequest: [
          {
            method: 'GET',
            url: this.getRestApiUrl(`/${queryVerb}?${new URLSearchParams({ q: soql }).toString()}`, isTooling),
            referenceId: QUERY_REF_ID,
          },
          {
            method: 'GET',
            url: this.getRestApiUrl(`/query?${new URLSearchParams({ q: soql, columns: 'true' }).toString()}`, isTooling),
            referenceId: COLUMNS_REF_ID,
          },
        ],
      },
    });

    const queryResultsResponse = compositeResponse.find(({ referenceId }) => referenceId === QUERY_REF_ID);
    if (!queryResultsResponse || queryResultsResponse.httpStatusCode < 200 || queryResultsResponse.httpStatusCode > 299) {
      const errors = queryResultsResponse?.body as Maybe<{ message?: string; errorCode?: string }[]>;
      this.logger.warn(
        { httpStatusCode: queryResultsResponse?.httpStatusCode, errorCode: errors?.[0]?.errorCode },
        'Composite query subrequest failed',
      );
      throw new Error(errors?.[0]?.message || errors?.[0]?.errorCode || 'An unknown error has occurred');
    }
    const queryResults = queryResultsResponse.body as QueryResult<T>;

    let columns: QueryResultsColumns | undefined;
    let parsedQuery: Query | undefined;

    try {
      const columnsResponse = compositeResponse.find(({ referenceId }) => referenceId === COLUMNS_REF_ID);
      if (!columnsResponse || columnsResponse.httpStatusCode < 200 || columnsResponse.httpStatusCode > 299) {
        throw new Error(`Columns subrequest failed with status ${columnsResponse?.httpStatusCode}`);
      }
      const tempColumns = columnsResponse.body as QueryColumnsSfdc;

      columns = {
        entityName: tempColumns.entityName,
        groupBy: tempColumns.groupBy,
        idSelected: tempColumns.idSelected,
        keyPrefix: tempColumns.keyPrefix,
        columns: tempColumns.columnMetadata?.flatMap((column) => flattenQueryColumn(column)),
      };
    } catch (ex) {
      this.logger.debug({ message: getErrorMessage(ex) }, 'Error fetching columns');
    }

    // Attempt to parse columns from query
    try {
      parsedQuery = parseQuery(soql);
    } catch (ex) {
      this.logger.debug({ message: getErrorMessage(ex) }, 'Error parsing query');
    }

    return { queryResults, columns, parsedQuery };
  }

  async queryMore<T = unknown>(nextRecordsUrl: string): Promise<QueryResults<T>> {
    const queryResults = await this.apiRequest<QueryResult<T>>({
      sessionInfo: this.sessionInfo,
      url: nextRecordsUrl,
    });
    return { queryResults };
  }
}
