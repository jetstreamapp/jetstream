export interface QueryResult<T> {
  done: boolean;
  nextRecordsUrl?: string | undefined;
  totalSize: number;
  records: T[];
}

export interface QueryColumnsSfdc {
  columnMetadata: QueryColumnMetadata[];
  entityName: string;
  groupBy: boolean;
  idSelected: boolean;
  keyPrefix: string;
}

export interface QueryColumnMetadata {
  aggregate: boolean;
  apexType: string;
  booleanType: boolean;
  columnName: string;
  custom: boolean;
  displayName: string;
  foreignKeyName?: any;
  insertable: boolean;
  joinColumns: QueryColumnMetadata[];
  numberType: boolean;
  textType: boolean;
  updatable: boolean;
}
