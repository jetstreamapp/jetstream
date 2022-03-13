import { BulkJobWithBatches, ListItem, MapOf } from '@jetstream/types';
import type { DescribeSObjectResult } from 'jsforce';
import { PrepareDataResponseError } from '../shared/load-records-results/load-records-results-types';

export interface MetadataRow {
  /** Confirmed all input is valid, but does not indicate that the row has been validated */
  isValid: boolean;
  sobject: string;
  loadError?: string;
  loading: boolean;
  metadata?: DescribeSObjectResult;
  fields: ListItem[];
  allFields: ListItem[];
  selectedField?: string;
  transformationOptions: TransformationOptions;
  validationResults?: ValidationResults;
  deployResults: DeployResults;
}

export interface DeployResults {
  status: 'Not Started' | 'In Progress - Preparing' | 'In Progress - Uploading' | 'In Progress' | 'Finished' | 'Error';
  done: boolean;
  records: any[];
  jobInfo?: BulkJobWithBatches;
  batchIdToIndex: MapOf<number>;
  numberOfBatches?: number;
  processingErrors: PrepareDataResponseError[];
  processingStartTime?: string;
  processingEndTime?: string;
  lastChecked?: string; // {formatDate(lastChecked, 'h:mm:ss')}
}

export interface ValidationResults {
  isValid: boolean;
  impactedRecords?: number;
  error?: string;
}

export interface TransformationOptions {
  option: TransformationOption;
  alternateField?: string;
  staticValue: string;
  criteria: TransformationCriteria;
  whereClause: string;
}

export type TransformationOption = 'staticValue' | 'anotherField' | 'null';
export type TransformationCriteria = 'all' | 'onlyIfBlank' | 'onlyIfNotBlank' | 'custom';
