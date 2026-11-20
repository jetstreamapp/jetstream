import {
  BulkJobResultRecord,
  BulkJobWithBatches,
  DescribeSObjectResult,
  Field,
  ListItem,
  LoadDataBatchApiProgress,
  Maybe,
  PrepareDataResponseError,
} from '@jetstream/types';

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
  /**
   * Optional SOQL `LIMIT` applied to every query for this object, which lets a user work through a
   * data volume that is too large to update in one pass.
   */
  limit?: Maybe<number>;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  records: any[];
  jobInfo?: BulkJobWithBatches;
  /** Set instead of `jobInfo` when the records were saved with the Batch API - see {@link MassUpdateBatchApiResults} */
  batchApiResults?: MassUpdateBatchApiResults;
  batchIdToIndex: Record<string, number>;
  numberOfBatches?: number;
  processingErrors: PrepareDataResponseError[];
  processingStartTime?: Maybe<string>;
  processingEndTime?: Maybe<string>;
  lastChecked?: string; // {formatDate(lastChecked, 'h:mm:ss')}
  fatalErrorMessage?: Maybe<string>;
  /** Polling gave up on the job's status; the job itself is unaffected and keeps running in Salesforce */
  statusCheckFailed?: boolean;
}

/**
 * Progress and per-record results of an update that was saved with the Batch API (sObject Collections) rather than a
 * Bulk API job. Used when duplicate rules are bypassed, which the Bulk API does not support. There is no job to poll:
 * every request returns its results, so they are held here.
 */
export interface MassUpdateBatchApiResults extends LoadDataBatchApiProgress {
  /** One result per record processed so far, in submit order, so it zips to `DeployResults.records` by index */
  results: BulkJobResultRecord[];
}

/** Options chosen under "Advanced Options" for a mass update */
export interface MassUpdateDeployOptions {
  batchSize: number;
  serialMode: boolean;
  /**
   * Save records that a duplicate rule flags with an alert instead of failing them. Switches the update from the Bulk API
   * to the Batch API, since the Bulk API ignores the duplicate rule header.
   */
  bypassDuplicateRules?: boolean;
  skipHistory?: boolean;
}

export interface ValidationResults {
  isValid: boolean;
  impactedRecords?: number;
  error?: Maybe<string>;
}

export interface TransformationOptions {
  option: TransformationOption;
  alternateField?: Maybe<string>;
  /**
   * Set when `alternateField` is read through a lookup that can point at more than one object (`Who`, `What`, …).
   * The field path alone cannot be queried then, since the relationship only exposes the fields every target
   * shares, so the query selects it with `TYPEOF` instead.
   */
  alternateFieldTarget?: Maybe<PolymorphicFieldTarget>;
  staticValue: string;
  criteria: TransformationCriteria;
  whereClause: string;
}

export interface PolymorphicFieldTarget {
  /** Polymorphic relationship on the object being updated, e.g. `Who` */
  relationshipName: string;
  /** Object the field is read from, e.g. `Contact` */
  sobject: string;
}

export type TransformationOption = 'staticValue' | 'anotherField' | 'update' | 'null';
export type TransformationCriteria = 'all' | 'onlyIfBlank' | 'onlyIfNotBlank' | 'custom';
