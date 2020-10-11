import { HttpMethod, MapOf, RecordAttributes } from '../types';

export type SalesforceOrgEdition =
  | 'Team Edition'
  | 'Professional Edition'
  | 'Enterprise Edition'
  | 'Developer Edition'
  | 'Personal Edition'
  | 'Unlimited Edition'
  | 'Contact Manager Edition'
  | 'Base Edition';

export type SalesforceOrgLocaleKey =
  | 'en_US'
  | 'de'
  | 'es'
  | 'fr'
  | 'it'
  | 'ja'
  | 'sv'
  | 'ko'
  | 'zh_TW'
  | 'zh_CN'
  | 'pt_BR'
  | 'nl_NL'
  | 'da'
  | 'th'
  | 'fi'
  | 'ru'
  | 'es_MX'
  | 'no';

export interface SObjectOrganization {
  Name?: string;
  Country?: string;
  OrganizationType?: SalesforceOrgEdition;
  InstanceName?: string;
  IsSandbox?: boolean;
  LanguageLocaleKey?: SalesforceOrgLocaleKey;
  NamespacePrefix?: string;
  TrialExpirationDate?: string;
}

export interface FieldDefinition {
  Id: string;
  QualifiedApiName: string;
  Label: string;
  MasterLabel: string;
  DataType: string;
  ValueTypeId: string;
  ReferenceTo: {
    referenceTo: string[] | null;
  };
  ExtraTypeInfo: string | null;
  PublisherId: string | null;
  RelationshipName: string | null;
  LastModifiedBy: {
    Name: string;
  } | null;
  LastModifiedDate: string | null;
  IsCompound: boolean;
  IsHighScaleNumber: boolean;
  IsHtmlFormatted: boolean;
  IsNameField: boolean;
  IsNillable: boolean;
  IsCalculated: boolean;
  IsApiFilterable: boolean;
  IsApiGroupable: boolean;
  IsApiSortable: boolean;
  IsPolymorphicForeignKey: boolean;
}

export type Insert = 'INSERT';
export type Update = 'UPDATE';
export type Upsert = 'UPSERT';
export type Delete = 'DELETE';
export type InsertUpdateUpsertDelete = Insert | Update | Upsert | Delete;

export interface ErrorResult {
  errors: {
    fields: string[];
    message: string;
    statusCode: string;
  }[];
  success: false;
}

export interface SuccessResult {
  id: string;
  success: true;
}
// NOTE: this type is returned for composite API if an array of data is passed to SFDC
// if one record, then the source in the jsforce type library is used
export type RecordResult = SuccessResult | ErrorResult;

export interface CompositeRequest {
  allOrNone?: boolean;
  compositeRequest?: CompositeRequestBody[];
}
export interface CompositeRequestBody {
  method: HttpMethod;
  url: string;
  httpHeaders?: MapOf<string>;
  body?: any;
  referenceId: string;
}

export interface CompositeResponse<T = unknown> {
  compositeResponse: {
    body: T;
    httpHeaders: any;
    httpStatusCode: number;
    referenceId: string;
  }[];
}

/**
 * SALESFORCE RECORDS
 */

export interface EntityParticleRecord {
  attributes: RecordAttributes;
  Id: string;
  Name: string;
  Label: string;
  IsIdLookup: boolean;
  DataType: string;
  ValueTypeId: string;
  ReferenceTo: {
    referenceTo: null | string[];
  };
  EntityDefinitionId: string;
  IsCreatable: boolean;
  IsUpdatable: boolean;
  QualifiedApiName: string;
  RelationshipName: string | null;
}

export type BulkJobWithBatches = BulkJob & { batches: BulkJobBatchInfo[] };

export interface BulkJob {
  concurrencyMode: 'Parallel' | 'Serial';
  contentType: string;
  createdById: string;
  createdDate: string;
  id: string;
  object: string;
  operation: InsertUpdateUpsertDelete;
  state: 'Open' | 'Closed' | 'Aborted' | 'Failed';
  systemModstamp: string;
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

export interface BulkJobUntyped extends Object {
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
  createdDate: string;
  systemModstamp: string;
  totalProcessingTime: number;
  numberRecordsProcessed: number;
  numberRecordsFailed: number;
  apiActiveProcessingTime: number;
  apexProcessingTime: number;
}

export interface BulkJobBatchInfoUntyped extends Object {
  $: any;
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
