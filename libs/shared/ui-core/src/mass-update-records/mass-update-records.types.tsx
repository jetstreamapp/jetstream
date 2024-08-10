import { BulkJobWithBatches, DescribeSObjectResult, Field, ListItem, Maybe, PrepareDataResponseError } from '@jetstream/types';

export interface MetadataRow {
  /** Confirmed all input is valid, but does not indicate that the row has been validated */
  isValid: boolean;
  sobject: string;
  loadError?: Maybe<string>;
  loading: boolean;
  metadata?: DescribeSObjectResult;
  fields: ListItem[];
  valueFields: ListItem[];
  configuration: MetadataRowConfiguration[];
  validationResults?: Maybe<ValidationResults>;
  deployResults: DeployResults;
}

export interface MetadataRowConfiguration {
  selectedField?: Maybe<string>;
  selectedFieldMetadata?: Maybe<Field>;
  transformationOptions: TransformationOptions;
}

export interface DeployResults {
  status: 'Not Started' | 'In Progress - Preparing' | 'In Progress - Uploading' | 'In Progress' | 'Finished' | 'Error';
  done: boolean;
  records: any[];
  jobInfo?: BulkJobWithBatches;
  batchIdToIndex: Record<string, number>;
  numberOfBatches?: number;
  processingErrors: PrepareDataResponseError[];
  processingStartTime?: Maybe<string>;
  processingEndTime?: Maybe<string>;
  lastChecked?: string; // {formatDate(lastChecked, 'h:mm:ss')}
}

export interface ValidationResults {
  isValid: boolean;
  impactedRecords?: number;
  error?: Maybe<string>;
}

export interface TransformationOptions {
  option: TransformationOption;
  alternateField?: Maybe<string>;
  staticValue: string;
  criteria: TransformationCriteria;
  whereClause: string;
}

export type TransformationOption = 'staticValue' | 'anotherField' | 'null';
export type TransformationCriteria = 'all' | 'onlyIfBlank' | 'onlyIfNotBlank' | 'custom';
