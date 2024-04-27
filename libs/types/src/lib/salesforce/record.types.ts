export type SalesforceId = string;

export type OperationReturnType<O extends SobjectOperation, R = any> = O extends 'retrieve'
  ? (SalesforceRecord<R> | ErrorResult)[] // Failures return RecordResult, successes return SalesforceRecord
  : RecordResult[];

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type SobjectOperation = 'retrieve' | 'create' | 'update' | 'upsert' | 'delete';

export interface RecordAttributes {
  type: string;
  url: string;
}

export type SalesforceRecord<T = any> = {
  Id?: SalesforceId | undefined;
  attributes?: RecordAttributes | undefined;
} & T;

export type Insert = 'INSERT';
export type Update = 'UPDATE';
export type Upsert = 'UPSERT';
export type Delete = 'DELETE';
export type Query = 'QUERY';
export type QueryAll = 'QUERY_ALL';
export type InsertUpdateUpsert = Insert | Update | Upsert;
export type InsertUpdateUpsertDelete = Insert | Update | Upsert | Delete;
export type InsertUpdateUpsertDeleteQuery = Insert | Update | Upsert | Delete | Query | QueryAll;

export interface ErrorResult {
  errors: {
    fields: string[];
    message: string;
    statusCode: string;
  }[];
  /** Will be available for updates */
  id?: string;
  success: false;
}

export interface SuccessResult {
  id: string;
  success: true;
}

export interface PlatformEventResult {
  errors: {
    fields: string[];
    message: string;
    statusCode: string;
  }[];
  id?: string;
  success: boolean;
}

export type RecordResult = SuccessResult | ErrorResult;
export type RecordResultWithRecord = RecordResult & { record: any };

export interface SobjectCollectionRequest {
  allOrNone?: boolean;
  records?: SobjectCollectionRequestRecord[];
}

export type SobjectCollectionRequestRecord<T = { [field: string]: any }> = T & { attributes: { type: string } };

export type SobjectCollectionResponse = RecordResult[];

export type PlatformEventCollectionResponse = PlatformEventResult[];

export interface CompositeGraphRequestBody {
  graphs: CompositeGraphRequest[];
}

export interface CompositeGraphRequest {
  graphId: string;
  compositeRequest?: CompositeRequestBody[];
}

export interface CompositeRequest {
  allOrNone?: boolean;
  collateSubrequests?: boolean;
  compositeRequest?: CompositeRequestBody[];
}

export interface CompositeRequestBody {
  method: HttpMethod;
  url: string;
  httpHeaders?: Record<string, string>;
  body?: any;
  referenceId: string;
}

export interface CompositeResponse<T = unknown> {
  compositeResponse: CompositeResponseItem<T>[];
}

export interface CompositeResponseItem<T = CompositeGraphResponseBodyData> {
  body: T;
  httpHeaders: any;
  httpStatusCode: number;
  referenceId: string;
}

export interface CompositeGraphResponseBody<T = CompositeGraphResponseBodyData> {
  graphs: CompositeGraphResponse<T>[];
}

export interface CompositeGraphResponse<T = CompositeGraphResponseBodyData> {
  graphId: string;
  graphResponse: CompositeResponse<T>;
  isSuccessful: boolean;
}

// This may not cover all use-cases, but covered the tested cases pretty well
// some fields may be undefined depending on the type of error
export interface CompositeGraphResponseBodyData {
  id?: string;
  success?: boolean;
  created?: boolean;
  message?: string;
  errorCode?: string;
  fields?: string[];
  errors?: unknown[];
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

export interface EntityParticlePermissionsRecord {
  QualifiedApiName: string;
  Label: string;
  DataType: string;
  DurableId: string;
  EntityDefinition: { QualifiedApiName: string };
  FieldDefinitionId: string;
  NamespacePrefix: string;
  IsCompound: boolean;
  IsCreatable: boolean;
  IsPermissionable: boolean;
}

export interface PermissionSetRecord {
  attributes: RecordAttributes;
  Id: string;
  Name: string;
  Label: string;
  Type: 'Profile' | 'Regular' | 'Group';
  IsCustom: boolean;
  IsOwnedByProfile: boolean;
  NamespacePrefix: string | null;
  ProfileId: string | null;
  Profile?: PermissionSetProfileRecord;
}

export interface PermissionSetProfileRecord {
  attributes: RecordAttributes;
  Id: string;
  Name: string;
  UserType: string;
}

export interface PermissionSetNoProfileRecord extends PermissionSetRecord {
  Type: 'Regular';
  IsOwnedByProfile: false;
  ProfileId: null;
  Profile: undefined;
}

export interface PermissionSetWithProfileRecord extends PermissionSetRecord {
  Type: 'Profile';
  IsOwnedByProfile: true;
  ProfileId: string;
  Profile: PermissionSetProfileRecord;
}

export interface PermissionPermissionSetRecord {
  Id: string;
  Name: string;
  IsOwnedByProfile: boolean;
  ProfileId?: string;
}

export interface ObjectPermissionRecord {
  Id: string;
  SobjectType: string;
  PermissionsRead: boolean;
  PermissionsCreate: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsModifyAllRecords: boolean;
  PermissionsViewAllRecords: boolean;
  ParentId: string;
  Parent: PermissionPermissionSetRecord;
}

export type ObjectPermissionRecordInsert = Omit<ObjectPermissionRecord, 'Id' | 'Parent'> & { attributes?: { type: 'ObjectPermissions' } };

export interface FieldPermissionRecord {
  Id: string;
  SobjectType: string;
  Field: string;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
  ParentId: string;
  Parent: PermissionPermissionSetRecord;
}

export type TabPermissionRecordInsert = {
  attributes?: { type: 'PermissionSetTabSetting' };
  ParentId: string;
  Name: string;
  Visibility: 'DefaultOn' | 'DefaultOff';
};

export interface TabVisibilityPermissionRecord {
  Id: string;
  Name: string;
  Visibility: 'DefaultOff' | 'DefaultOn';
  ParentId: string;
  Parent: PermissionPermissionSetRecord;
}

export interface TabDefinitionRecord {
  Id: string;
  Name: string;
  Label: string;
  SobjectName: string;
}

export type TabVisibilityPermissionRecordInsert = Omit<TabVisibilityPermissionRecord, 'Id' | 'Parent'> & {
  attributes?: { type: 'ObjectPermissions' };
};

// https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_picklist_values.htm#ui_api_responses_picklist_values
export interface PicklistFieldValuesResponse {
  eTag: string;
  picklistFieldValues: PicklistFieldValues;
}

export type PicklistFieldValues = Record<string, PicklistFieldValue>;

export interface PicklistFieldValue {
  eTag: string;
  url: string;
  controllerValues: Record<string, number>;
  defaultValue: any;
  values: PicklistFieldValueItem[];
}

export interface PicklistFieldValueItem {
  attributes: null;
  label: string;
  value: string;
  validFor: number[] | null;
}

export interface GlobalValueSetRequest {
  FullName: string;
  Metadata: GlobalValueSet;
}

export interface GlobalValueSet {
  customValue: GlobalValueSetCustomValue[];
  description: string;
  masterLabel: string;
  sorted: boolean;
}

export interface GlobalValueSetCustomValue {
  color?: string;
  default: boolean;
  description?: string;
  isActive?: boolean;
  label?: string /** defaults to ValueName */;
  valueName: string;
}

export interface RecordWithAuditFields {
  attributes: RecordAttributes;
  Id: string;
  Name: string;
  CreatedById: string;
  CreatedBy: {
    Name: string;
  } | null;
  CreatedDate: string;
  LastModifiedById: string;
  LastModifiedBy: {
    Name: string;
  } | null;
  LastModifiedDate: string;
}

// Returned from readMetadata API
export interface ProfileMetadataRecord {
  fullName: string;
  applicationVisibilities?: ApplicationVisibility[];
  classAccesses?: ClassAccess[];
  custom?: string;
  customMetadataTypeAccesses?: CustomMetadataTypeAccess[];
  customPermissions?: CustomPermission[];
  customSettingAccesses?: CustomSettingAccess[];
  fieldPermissions?: FieldPermission[];
  flowAccesses?: FlowAccesses;
  layoutAssignments?: LayoutAssignment[];
  loginIpRanges?: LoginIpRanges;
  objectPermissions?: ObjectPermission[];
  pageAccesses?: PageAccess[];
  recordTypeVisibilities?: RecordTypeVisibility[];
  tabVisibilities?: TabVisibility[];
  userLicense?: string;
  userPermissions?: UserPermission[];
}

// Returned from readMetadata API
export interface PermissionSetMetadataRecord {
  fullName: string;
  hasActivationRequired: boolean;
  label: string;
  applicationVisibilities?: ApplicationVisibility[];
  classAccesses?: ClassAccess[];
  custom?: string;
  customMetadataTypeAccesses?: CustomMetadataTypeAccess[];
  customPermissions?: CustomPermission[];
  customSettingAccesses?: CustomSettingAccess[];
  fieldPermissions?: FieldPermission[];
  flowAccesses?: FlowAccesses;
  layoutAssignments?: LayoutAssignment[];
  loginIpRanges?: LoginIpRanges;
  objectPermissions?: ObjectPermission[];
  pageAccesses?: PageAccess[];
  recordTypeVisibilities?: RecordTypeVisibility[];
  tabVisibilities?: TabVisibility[];
  userLicense?: string;
  userPermissions?: UserPermission[];
}

export interface ApplicationVisibility {
  application: string;
  default: string;
  visible: string;
}

export interface ClassAccess {
  apexClass: string;
  enabled: string;
}

export interface CustomMetadataTypeAccess {
  enabled: string;
  name: string;
}

export interface CustomPermission {
  enabled: string;
  name: string;
}

export interface CustomSettingAccess {
  enabled: string;
  name: string;
}

export interface FieldPermission {
  editable: string;
  field: string;
  readable: string;
}

export interface FlowAccesses {
  enabled: string;
  flow: string;
}

export interface LayoutAssignment {
  layout: string;
  recordType?: string;
}

export interface LoginIpRanges {
  endAddress: string;
  startAddress: string;
}

export interface ObjectPermission {
  allowCreate: string;
  allowDelete: string;
  allowEdit: string;
  allowRead: string;
  modifyAllRecords: string;
  object: string;
  viewAllRecords: string;
}

export interface PageAccess {
  apexPage: string;
  enabled: string;
}

export interface RecordTypeVisibility {
  default: string;
  recordType: string;
  visible: string;
}

export interface TabVisibility {
  tab: string;
  visibility: string;
}

export interface UserPermission {
  enabled: string;
  name: string;
}
