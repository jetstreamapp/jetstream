import z from 'zod';

export const FileNameFormatSchema = z.enum(['name', 'id', 'nameAndId']);
export type FileNameFormat = z.infer<typeof FileNameFormatSchema>;

export const BinaryDownloadCompatibleObjectsSchema = z.enum([
  'attachment',
  'CombinedAttachment',
  'contentversion',
  'document',
  'staticresource',
]);
export type BinaryDownloadCompatibleObjects = z.infer<typeof BinaryDownloadCompatibleObjectsSchema>;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  foreignKeyName?: any;
  insertable: boolean;
  joinColumns: QueryColumnMetadata[];
  numberType: boolean;
  textType: boolean;
  updatable: boolean;
}
