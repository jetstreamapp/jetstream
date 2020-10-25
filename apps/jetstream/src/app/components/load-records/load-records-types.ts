import { BulkJobWithBatches, EntityParticleRecord, InsertUpdateUpsertDelete, RecordAttributes, SalesforceOrgUi } from '@jetstream/types';
import { FieldType } from 'jsforce';

export interface FieldWithRelatedEntities {
  label: string;
  name: string;
  type: FieldType;
  typeLabel: string;
  externalId: boolean;
  referenceTo?: string;
  relationshipName?: string;
  relatedFields?: FieldRelatedEntity[];
}

export interface FieldRelatedEntity {
  name: string;
  label: string;
  type: string;
}

export interface Step {
  idx: number;
  name: StepName;
  label: string;
  active: boolean;
  enabled: boolean;
}

export type StepName = 'sobjectAndFile' | 'fieldMapping' | 'automationDeploy' | 'loadRecords' | 'automationRollback';

type RecordAttributesWithRelatedRecords = RecordAttributes & { relatedRecords: EntityParticleRecord[] };

export type ApiModeBulk = 'BULK';
export type ApiModeBatch = 'BATCH';
export type ApiMode = ApiModeBulk | ApiModeBatch;

export type EntityParticleRecordWithRelatedExtIds = EntityParticleRecord & { attributes: RecordAttributesWithRelatedRecords };

export interface FieldMapping {
  [field: string]: FieldMappingItem;
}

export interface FieldMappingItem {
  csvField: string;
  targetField: string | null;
  mappedToLookup: boolean;
  relationshipName?: string;
  targetLookupField?: string;
  fieldMetadata: FieldWithRelatedEntities;
  relatedFieldMetadata?: FieldRelatedEntity;
  isDuplicateMappedField?: boolean;
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
