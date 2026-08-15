import {
  CompositeGraphRequest,
  CompositeGraphResponse,
  CompositeRequestBody,
  CompositeResponseItem,
  DescribeSObjectResult,
  Field,
  InsertUpdateUpsert,
  Maybe,
} from '@jetstream/types';

export interface LoadMultiObjectDataError {
  property: Exclude<keyof LoadMultiObjectData, 'errors'> | null;
  worksheet: string;
  location: string | null;
  /** SHEET errors apply to the worksheet as a whole (e.g. B1/B2/B3 configuration or an empty sheet) and have no single cell to point at */
  locationType: 'CELL' | 'ROW' | 'COLUMN' | 'SHEET';
  message: string;
  /** 0-based indexes into dataset.data for errors that apply to specific rows (e.g. missing or invalid Reference Ids) */
  rowIndexes?: number[];
  /** Header name for errors tied to a specific column */
  header?: string;
  /** Warnings do not block the load. Absent = 'error'. */
  severity?: 'error' | 'warning';
  /** Identifies problems that are re-derived when the worksheet configuration changes, so they can be replaced */
  code?: 'SKIPPED_COLUMN';
}

export interface LoadMultiObjectData {
  worksheet: string;
  sobject: string;
  operation: InsertUpdateUpsert;
  externalId?: string;
  data: any[];
  dataById: Record<string, any>;
  /** The heading used for the reference Id. it should be "reference id", but could be anything */
  referenceColumnHeader: string;
  headers: string[];
  /** Headers where these fields on every row is considered a related field */
  referenceHeaders: Set<string>;
  metadata: DescribeSObjectResult;
  fieldsByName: Record<string, Field>;
  fieldsByRelationshipName?: Record<string, Field>;
  errors: LoadMultiObjectDataError[];
}

export interface ParseWorkbookResult {
  datasets: LoadMultiObjectData[];
  /** Errors/warnings that apply to the workbook rather than one dataset (e.g. skipped sheets, no data worksheets at all) */
  workbookErrors: LoadMultiObjectDataError[];
}

export interface LoadMultiObjectRecord {
  sobject: string;
  operation: InsertUpdateUpsert;
  externalId?: Maybe<string>;
  externalIdValue?: Maybe<string>;
  recordIdForUpdate?: Maybe<string>;
  referenceId: string;
  record: any;
  worksheet: string;
  recordIdx: number;
  dependsOn: string[];
}

export interface RecordWithResponse {
  referenceId: string;
  sobject: string;
  operation: InsertUpdateUpsert;
  externalId?: Maybe<string>;
  worksheet: string;
  /** 0-based index of the record within its worksheet's data rows */
  rowIndex: number;
  /** Reference Id of the top-level record of the group this record belongs to */
  graphId: string;
  request: CompositeRequestBody;
  response: CompositeResponseItem | null;
}

export interface LoadMultiObjectRequestGraphResults {
  graphId: string;
  isSuccess: boolean | null;
  compositeRequest: CompositeRequestBody[];
  compositeResponse: CompositeResponseItem[] | null;
}

export interface LoadMultiObjectRequestWithResult {
  key: string;
  loading: boolean;
  started: Date | null;
  finished: Date | null;
  errorMessage?: string;
  /** Up to 500 records total */
  data: CompositeGraphRequest[];
  results: CompositeGraphResponse[] | null;
  // Same data as above, just grouped together by graph id
  dataWithResultsByGraphId: Record<string, LoadMultiObjectRequestGraphResults>;
  // Same data as above, just grouped together by record reference id
  recordWithResponseByRefId: Record<string, RecordWithResponse>;
}

export interface LoadMultiObjectGroupInfo {
  /** Reference Id of the top-level record of the group */
  graphId: string;
  /** Number of records in the group */
  size: number;
}

export interface BuildDataGraphResult {
  requests: LoadMultiObjectRequestWithResult[];
  errors: LoadMultiObjectDataError[];
  /** Group membership for every record, keyed by Reference Id. Populated whenever groups could be computed, even if a group exceeds the size limit. */
  groupsByRefId: Record<string, LoadMultiObjectGroupInfo>;
}

export interface LoadMultiObjectRun {
  runId: number;
  type: 'initial' | 'retry';
  requests: LoadMultiObjectRequestWithResult[];
  startedAt: Date | null;
  finishedAt: Date | null;
  cancelled: boolean;
}

export interface LoadMultiObjectProgress {
  /** 1-based request number currently processing (0 = not started) */
  current: number;
  total: number;
  recordsProcessed: number;
  recordsTotal: number;
}
