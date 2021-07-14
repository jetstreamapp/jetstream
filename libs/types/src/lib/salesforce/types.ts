import { DescribeSObjectResult, Field, RetrieveResult as RetrieveResultSfdc } from 'jsforce';
import { HttpMethod, MapOf, RecordAttributes } from '../types';

export type BulkApiDownloadType = 'request' | 'result';

export type FieldWithExtendedType = Field & { typeLabel: string };
export type DescribeSObjectResultWithExtendedField = Omit<DescribeSObjectResult, 'fields'> & { fields: FieldWithExtendedType[] };

export type SoapNil = { $: { 'xsi:nil': 'true' } };

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
export type InsertUpdateUpsert = Insert | Update | Upsert;
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
export type RecordResultWithRecord = RecordResult & { record: any };

export interface SobjectCollectionRequest {
  allOrNone?: boolean;
  records?: SobjectCollectionRequestRecord[];
}

export type SobjectCollectionRequestRecord<T = { [field: string]: any }> = T & { attributes: { type: string } };

export type SobjectCollectionResponse = RecordResult[];

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
  httpHeaders?: MapOf<string>;
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

export interface CompositeGraphResponseBody<T = unknown> {
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
  parent: PermissionPermissionSetRecord;
}

export interface FieldPermissionRecord {
  Id: string;
  SobjectType: string;
  Field: string;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
  ParentId: string;
  parent: PermissionPermissionSetRecord;
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
  stateMessage?: string;
  createdDate: string;
  systemModstamp: string;
  totalProcessingTime: number;
  numberRecordsProcessed: number;
  numberRecordsFailed: number;
  apiActiveProcessingTime: number;
  apexProcessingTime: number;
}

export interface BulkJobBatchInfoUntyped extends Object {
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

// https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_picklist_values.htm#ui_api_responses_picklist_values
export interface PicklistFieldValuesResponse {
  eTag: string;
  picklistFieldValues: PicklistFieldValues;
}

export type PicklistFieldValues = MapOf<PicklistFieldValue>;

export interface PicklistFieldValue {
  eTag: string;
  url: string;
  controllerValues: MapOf<number>;
  defaultValue: any;
  values: PicklistFieldValueItem[];
}

export interface PicklistFieldValueItem {
  attributes: null;
  label: string;
  value: string;
  validFor: number[];
}

export interface ListMetadataResultRaw {
  createdById: string;
  createdByName: string;
  createdDate: string;
  fileName: string;
  fullName: string;
  id: string;
  lastModifiedById: string;
  lastModifiedByName: string;
  lastModifiedDate: string;
  manageableState?: 'beta' | 'deleted' | 'deprecated' | 'deprecatedEditable' | 'installed' | 'installedEditable' | 'released' | 'unmanaged';
  namespacePrefix?: string;
  type: string;
}

export interface ListMetadataResult {
  createdById: string;
  createdByName: string;
  createdDate: Date;
  fileName: string;
  fullName: string;
  id: string;
  lastModifiedById: string;
  lastModifiedByName: string;
  lastModifiedDate: Date;
  manageableState?: 'beta' | 'deleted' | 'deprecated' | 'deprecatedEditable' | 'installed' | 'installedEditable' | 'released' | 'unmanaged';
  namespacePrefix?: string;
  type: string;
}

export interface RetrieveResult extends Omit<RetrieveResultSfdc, 'zipFile'> {
  // fileProperties: FileProperties[];
  // id: string;
  // messages: RetrieveMessage[];
  // zipFile: string
  done: boolean;
  errorMessage?: string;
  errorStatusCode?: string;
  status: 'Pending' | 'InProgress' | 'Succeeded' | 'Failed';
  success: boolean;
  zipFile?: string;
}

export interface RetrieveResultRaw extends Omit<RetrieveResultSfdc, 'zipFile'> {
  done: 'true' | 'false';
  errorMessage?: string;
  errorStatusCode?: string;
  status: 'Pending' | 'InProgress' | 'Succeeded' | 'Failed';
  success: 'true' | 'false';
  zipFile?: string | SoapNil;
}

export type DeployOptionsTestLevel = 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';

export interface DeployOptions {
  allowMissingFiles?: boolean;
  autoUpdatePackage?: boolean;
  checkOnly?: boolean;
  ignoreWarnings?: boolean;
  performRetrieve?: boolean;
  purgeOnDelete?: boolean;
  rollbackOnError?: boolean;
  runAllTests?: boolean;
  runTests?: string[];
  singlePackage?: boolean;
  testLevel?: DeployOptionsTestLevel;
}

export interface DeployResult {
  id: string;
  canceledBy?: string;
  canceledByName?: string;
  checkOnly: boolean;
  completedDate: string;
  createdBy: string;
  createdByName: string;
  createdDate: string;
  details?: {
    componentFailures: DeployMessage[];
    componentSuccesses: DeployMessage[];
    runTestResult: RunTestsResult;
  };
  done: boolean;
  errorMessage?: string;
  errorStatusCode?: string;
  ignoreWarnings?: boolean;
  lastModifiedDate: string;
  numberComponentErrors: number;
  numberComponentsDeployed: number;
  numberComponentsTotal: number;
  numberTestErrors: number;
  numberTestsCompleted: number;
  numberTestsTotal: number;
  rollbackOnError?: boolean;
  runTestsEnabled: boolean;
  startDate: string;
  status: DeployResultStatus;
  success: boolean;
}

export type DeployResultStatus = 'Pending' | 'InProgress' | 'Succeeded' | 'SucceededPartial' | 'Failed' | 'Canceling' | 'Canceled';

export interface DeployMessage {
  changed: boolean;
  columnNumber: number;
  componentType: string;
  created: boolean;
  createdDate: string;
  deleted: boolean;
  fileName: string;
  fullName: string;
  id: string;
  lineNumber: number;
  problem: string;
  problemType: 'Warning' | 'Error';
  success: boolean;
}

// https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deployresult.htm
export interface RunTestsResult {
  apexLogId: string;
  codeCoverage: CodeCoverageResult[];
  codeCoverageWarnings: CodeCoverageWarning[];
  failures: RunTestFailure[];
  flowCoverage: FlowCoverageResult[];
  flowCoverageWarnings: FlowCoverageWarning[];
  numFailures: number;
  numTestsRun: number;
  successes: RunTestSuccess[];
  totalTime: number;
}

export interface CodeCoverageResult {
  dmlInfo: CodeLocation[];
  id: string;
  locationsNotCovered: CodeLocation[];
  methodInfo: CodeLocation[];
  name: string;
  namespace: string;
  numLocations: number;
  numLocationsNotCovered: number;
  soqlInfo: CodeLocation[];
  type: string;
}

export interface CodeCoverageWarning {
  id: string;
  message: string;
  name: string;
  namespace: string;
}

export interface RunTestFailure {
  id: string;
  message: string;
  methodName: string;
  name: string;
  packageName: string;
  namespace: string;
  seeAllData: boolean;
  stackTrace: string;
  time: number;
  type: string;
}

export interface FlowCoverageResult {
  elementsNotCovered: string;
  flowId: string;
  flowName: string;
  flowNamespace: string;
  numElements: number;
  numElementsNotCovered: number;
  processType:
    | 'AutoLaunchedFlow'
    | 'Flow'
    | 'Workflow'
    | 'CustomEvent'
    | 'InvocableProcess'
    | 'LoginFlow'
    | 'ActionPlan'
    | 'JourneyBuilderIntegration'
    | 'UserProvisioningFlow'
    | 'Survey'
    | 'SurveyEnrich'
    | 'Appointments'
    | 'FSCLending'
    | 'DigitalForm'
    | 'FieldServiceMobile'
    | 'OrchestrationFlow'
    | 'FieldServiceWeb'
    | 'TransactionSecurityFlow'
    | 'ContactRequestFlow'
    | 'ActionCadenceFlow'
    | 'ManagedContentFlow'
    | 'CheckoutFlow'
    | 'CartAsyncFlow'
    | 'SalesEntryExperienceFlow'
    | 'CustomerLifecycle'
    | 'Journey'
    | 'RecommendationStrategy'
    | 'AppProcess'
    | 'RoutingFlow';
}

export interface FlowCoverageWarning {
  flowId: string;
  flowName: string;
  flowNamespace: string;
  message: string;
}

export interface RunTestSuccess {
  id: string;
  methodName: string;
  name: string;
  namespace: string;
  seeAllData: boolean;
  time: number;
}

export interface RunTestFailure {
  id: string;
  message: string;
  methodName: string;
  name: string;
  namespace: string;
  seeAllData: boolean;
  stackTrace: string;
  time: number;
  type: string;
}

export interface CodeLocation {
  column: number;
  line: number;
  numExecutions: number;
  time: number;
}

export interface AnonymousApexSoapResponse {
  'soapenv:Envelope': {
    'soapenv:Header': {
      DebuggingInfo: {
        debugLog: string;
      };
    };
    'soapenv:Body': {
      executeAnonymousResponse: {
        result: {
          column: string | SoapNil;
          compileProblem: string | SoapNil;
          compiled: string | SoapNil;
          exceptionMessage: string | SoapNil;
          exceptionStackTrace: string | SoapNil;
          line: string | SoapNil;
          success: string | SoapNil;
        };
      };
    };
  };
}

export interface AnonymousApexResponse {
  debugLog: string;
  result: {
    column: number | null;
    compileProblem: string | null;
    compiled: boolean;
    exceptionMessage: string | null;
    exceptionStackTrace: string | null;
    line: number | null;
    success: boolean;
  };
}

/**
 * Examples:
 *
 * publicDeclarations['System'] // Get list of all base types, usually just use this
 * publicDeclarations['System']['System'].methods // get everything in the system class
 * publicDeclarations['System']['Integer'].methods // get methods from the Integer class
 *
 */
export interface ApexCompletionResponse {
  publicDeclarations: MapOf<MapOf<ApexCompletion>>;
}

export interface ApexCompletion {
  constructors: ApexCompletionMethod[];
  methods: ApexCompletionMethod[];
  properties: ApexCompletionProperty[];
}

export interface ApexCompletionMethod {
  argTypes?: string[]; // not populated on constructors
  isStatic?: boolean; // not populated on constructors
  methodDoc: null;
  name: string;
  parameters: ApexCompletionMethodParameter[];
  references: unknown[];
  returnType: string; // not populated on constructors
}

export interface ApexCompletionMethodParameter {
  name: string;
  type: string;
}

export interface ApexCompletionProperty {
  name: string;
  references: unknown[];
}
