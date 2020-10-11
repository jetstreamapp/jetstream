import {
  BulkJob,
  BulkJobWithBatches,
  EntityParticleRecord,
  InsertUpdateUpsertDelete,
  RecordAttributes,
  SalesforceOrgUi,
} from '@jetstream/types';

type RecordAttributesWithRelatedRecords = RecordAttributes & { relatedRecords: EntityParticleRecord[] };

export type ApiModeBulk = 'BULK';
export type ApiModeBatch = 'BATCH';
export type ApiMode = ApiModeBulk | ApiModeBatch;

export type EntityParticleRecordWithRelatedExtIds = EntityParticleRecord & { attributes: RecordAttributesWithRelatedRecords };

export interface FieldMapping {
  [field: string]: FieldMappingItem;
}

export interface FieldMappingItem {
  targetField: string | null;
  mappedToLookup: boolean;
  relationshipName?: string;
  targetLookupField?: string;
  fieldMetadata: EntityParticleRecord;
}

export interface PrepareDataPayload {
  data: any[];
  fieldMapping: FieldMapping;
  sObject: string;
  insertNulls?: boolean; // defaults to false
  dateFormat: string;
  apiMode: ApiMode;
}

export interface LoadDataPayload {
  org: SalesforceOrgUi;
  data: any[];
  sObject: string;
  apiMode: ApiMode;
  type: InsertUpdateUpsertDelete;
  batchSize: number;
  serialMode?: boolean;
  externalId?: string; // required for upsert, ignored for all others.
}

export interface LoadDataBulkApi {
  data: any;
  batchNumber: number;
  completed: boolean;
  success: boolean;
}

export interface LoadDataBulkApiStatusPayload {
  jobInfo: BulkJobWithBatches;
  totalBatches: number;
  batchSummary: Omit<LoadDataBulkApi, 'data'>[];
}

export interface LoadDataBatchApiProgress {
  total: number;
  success: number;
  failure: number;
}
