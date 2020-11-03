import { Query } from 'soql-parser-js';
import { QueryResult } from 'jsforce';

export interface RequestResult<T> {
  data: T;
}

export interface QueryResults<T = unknown> {
  queryResults: QueryResult<T>;
  columns?: QueryResultsColumns;
  parsedQuery?: Query;
}

export interface QueryResultsColumns {
  entityName: string;
  groupBy: boolean;
  idSelected: boolean;
  keyPrefix: string;
  columns?: QueryResultsColumn[];
}

export interface QueryResultsColumn {
  columnFullPath: string;
  aggregate: boolean;
  apexType: string | null;
  booleanType: boolean;
  columnName: string;
  custom: boolean;
  displayName: string;
  foreignKeyName: string | null;
  insertable: boolean;
  numberType: boolean;
  textType: boolean;
  updatable: boolean;
  childColumnPaths?: QueryResultsColumn[];
}
