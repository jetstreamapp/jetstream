import { BulkJobWithBatches } from '../salesforce/bulk.types';
import { EntityParticleRecord, InsertUpdateUpsertDelete, RecordAttributes } from '../salesforce/record.types';
import { FieldType, FieldWithExtendedType } from '../salesforce/sobject.types';
import { Maybe, SalesforceOrgUi } from '../types';
import { DownloadType, PrepareDataResponseError } from './load-records-results-types';

export type LocalOrGoogle = 'local' | 'google';

export interface FieldWithRelatedEntities {
  label: string;
  name: string;
  type: FieldType;
  soapType: string;
  typeLabel: string;
  externalId: boolean;
  referenceTo?: string[];
  relationshipName?: string;
  relatedFields?: Record<string, FieldRelatedEntity[]>;
  field: FieldWithExtendedType;
}

export interface FieldRelatedEntity {
  name: string;
  label: string;
  type: string;
  isExternalId: boolean;
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
export type NonExtIdLookupOption = 'FIRST' | 'ERROR_IF_MULTIPLE';

export interface FieldMapping {
  [field: string]: FieldMappingItem;
}

export interface SavedFieldMapping {
  [field: string]: Omit<FieldMappingItem, 'fieldMetadata'>;
}

export type FieldMappingItem = FieldMappingItemCsv | FieldMappingItemStatic;

export interface FieldMappingItemBase {
  type: 'CSV' | 'STATIC';
  csvField: string;
  staticValue?: string | boolean | null;
  targetField: string | null;
  mappedToLookup: boolean;
  selectedReferenceTo?: string;
  relationshipName?: string;
  targetLookupField?: string;
  fieldMetadata: Maybe<FieldWithRelatedEntities>;
  relatedFieldMetadata?: FieldRelatedEntity;
  isDuplicateMappedField?: boolean;
  fieldErrorMsg?: string;
  lookupOptionUseFirstMatch: NonExtIdLookupOption;
  lookupOptionNullIfNoMatch: boolean;
  isBinaryBodyField: boolean;
}

export interface FieldMappingItemCsv extends FieldMappingItemBase {
  type: 'CSV';
  staticValue?: never;
}

export interface FieldMappingItemStatic extends FieldMappingItemBase {
  type: 'STATIC';
  staticValue: string | boolean | null;
  mappedToLookup: false;
  selectedReferenceTo?: never;
  relationshipName?: never;
  targetLookupField?: never;
  lookupOptionNullIfNoMatch: false;
  isBinaryBodyField: false;
}

export interface PrepareDataPayload {
  org: SalesforceOrgUi;
  data: any[];
  fieldMapping: FieldMapping;
  sObject: string;
  insertNulls?: boolean; // defaults to false
  dateFormat: string;
  apiMode: ApiMode;
}

export interface PrepareDataResponse {
  data: any[];
  errors: PrepareDataResponseError[];
  queryErrors: string[];
}

// export interface PrepareDataResponseError {
//   row: number;
//   record: any;
//   errors: string[];
// }

export interface LoadDataPayload {
  org: SalesforceOrgUi;
  data: any[];
  zipData?: Maybe<ArrayBuffer>;
  sObject: string;
  apiMode: ApiMode;
  type: InsertUpdateUpsertDelete;
  batchSize: number;
  serialMode?: Maybe<boolean>;
  externalId?: Maybe<string>; // required for upsert, ignored for all others.
  assignmentRuleId?: Maybe<string>; // only allowed for lead / case
  binaryBodyField?: Maybe<string>;
}

export interface LoadDataBulkApi {
  id?: string;
  data: any;
  batchNumber: number;
  completed: boolean;
  success: boolean;
  errorMessage?: string;
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

// export type DownloadType = 'results' | 'failures';
// export type DownloadAction = 'view' | 'download';

export interface DownloadModalData {
  open: boolean;
  data: any[];
  header: string[];
  fileNameParts: string[];
}

export interface ViewModalData extends Omit<DownloadModalData, 'fileNameParts'> {
  type: DownloadType;
}

export type MapOfCustomMetadataRecord = Record<string, CustomMetadataRecord>;

export interface CustomMetadataRecord {
  metadata: string;
  fullName: string;
  record: any;
}
