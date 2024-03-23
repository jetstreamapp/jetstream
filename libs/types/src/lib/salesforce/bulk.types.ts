import { Maybe } from '../types';
import { InsertUpdateUpsertDelete } from './record.types';

export type BulkApiDownloadType = 'request' | 'result';

export type BulkJobWithBatches = BulkJob & { batches: BulkJobBatchInfo[] };

export interface BulkJob {
  concurrencyMode: 'Parallel' | 'Serial';
  contentType: string;
  createdById: Maybe<string>;
  createdDate: Maybe<string>;
  id: Maybe<string>;
  object: string;
  operation: InsertUpdateUpsertDelete;
  state: 'Open' | 'Closed' | 'Aborted' | 'Failed';
  systemModstamp: Maybe<string>;
  apexProcessingTime: number;
  apiActiveProcessingTime: number;
  apiVersion: number;
  numberBatchesCompleted: number;
  numberBatchesFailed: number;
  numberBatchesInProgress: number;
  numberBatchesQueued: number;
  numberBatchesTotal: number;
  numberRecordsFailed: number;
  numberRecordsProcessed: number;
  numberRetries: number;
  totalProcessingTime: number;
}

export interface BulkJobUntyped extends Record<string, any> {
  $: any;
  concurrencyMode: 'Parallel' | 'Serial';
  contentType: string;
  createdById: string;
  createdDate: string;
  id: string;
  object: string;
  operation: InsertUpdateUpsertDelete;
  state: 'Open' | 'Closed' | 'Aborted' | 'Failed';
  systemModstamp: string;
  apexProcessingTime: string | number;
  apiActiveProcessingTime: string | number;
  apiVersion: string | number;
  numberBatchesCompleted: string | number;
  numberBatchesFailed: string | number;
  numberBatchesInProgress: string | number;
  numberBatchesQueued: string | number;
  numberBatchesTotal: string | number;
  numberRecordsFailed: string | number;
  numberRecordsProcessed: string | number;
  numberRetries: string | number;
  totalProcessingTime: string | number;
}

export interface BulkJobBatchInfo {
  id: string;
  jobId: string;
  state: 'Queued' | 'InProgress' | 'Completed' | 'Failed' | 'NotProcessed';
  stateMessage?: string;
  createdDate?: string;
  systemModstamp?: string;
  totalProcessingTime: number;
  numberRecordsProcessed: number;
  numberRecordsFailed: number;
  apiActiveProcessingTime: number;
  apexProcessingTime: number;
}

export interface BulkJobBatchInfoUntyped extends Record<string, any> {
  $?: any;
  '@xmlns'?: string;
  id: string;
  jobId: string;
  state: 'Queued' | 'InProgress' | 'Completed' | 'Failed' | 'NotProcessed';
  createdDate: string;
  systemModstamp: string;
  totalProcessingTime: string | number;
  numberRecordsProcessed: string | number;
  numberRecordsFailed: string | number;
  apiActiveProcessingTime: string | number;
  apexProcessingTime: string | number;
}

export interface BulkJobResultRecord {
  Id: string | null;
  Success: boolean;
  Created: boolean;
  Error: string | null;
}

export interface BulkQuery20Response {
  id: string;
  operation: 'query' | 'queryAll';
  object: string;
  createdById: string;
  createdDate: string;
  systemModstamp: string;
  state: 'UploadComplete' | 'InProgress' | 'Aborted' | 'JobComplete' | 'Failed';
  concurrencyMode: 'parallel';
  contentType: 'CSV';
  apiVersion: number;
  lineEnding: 'LF' | 'CRLF';
  columnDelimiter: 'BACKQUOTE' | 'CARET' | 'COMMA' | 'PIPE' | 'SEMICOLON' | 'TAB';
}

export interface BulkQuery20Job extends BulkQuery20Response {
  jobType: string;
  numberRecordsProcessed: number;
  retries: number;
  totalProcessingTime: number;
  isPkChunkingSupported: boolean;
}

export interface BulkQuery20JobResults {
  done: boolean;
  records: BulkQuery20Response[];
}
