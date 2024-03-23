import { SoapNil } from './misc.types';

// metadata
export interface AsyncResult {
  done: boolean;
  id: string;
  state: string;
  statusCode?: string | undefined;
  message?: string | undefined;
}

export interface DeployOptions {
  allowMissingFiles?: boolean | undefined;
  autoUpdatePackage?: boolean | undefined;
  checkOnly?: boolean | undefined;
  ignoreWarnings?: boolean | undefined;
  performRetrieve?: boolean | undefined;
  purgeOnDelete?: boolean | undefined;
  rollbackOnError?: boolean | undefined;
  runAllTests?: boolean | undefined;
  runTests?: string[] | undefined;
  singlePackage?: boolean | undefined;
}

export interface MetadataObject {
  childXmlNames?: string[] | undefined;
  directoryName?: string | undefined;
  inFolder?: boolean | undefined;
  metaFile?: boolean | undefined;
  suffix?: string | undefined;
  xmlName: string;
}

export interface DescribeMetadataResult {
  metadataObjects: MetadataObject[];
  organizationNamespace: string | null;
  partialSaveAllowed: boolean;
  testRequired: boolean;
}

export interface FileProperties {
  type: string;
  createdById: string;
  createdByName: string;
  createdDate: string;
  fileName: string;
  fullName: string;
  id: string;
  lastModifiedById: string;
  lastModifiedByName: string;
  lastModifiedDate: string;
  manageableState?: string | undefined;
  namespacePrefix?: string | undefined;
}

export interface ListMetadataQuery {
  type: string;
  folder?: string | undefined;
}

export interface MetadataInfo extends Record<string, any> {
  fullName: string;
}

export interface RetrieveMessage {
  fileName: string;
  problem: string;
}

export interface Package {
  apiAccessLevel?: 'Unrestricted' | 'Restricted' | undefined;
  description?: string | undefined;
  fullName?: string | undefined;
  namespacePrefix?: string | undefined;
  objectPermissions?: ProfileObjectPermissions[] | undefined;
  postInstallClass?: string | undefined;
  setupWeblink?: string | undefined;
  types: PackageTypeMembers[];
  uninstallClass?: string | undefined;
  version: string;
}

export interface PackageTypeMembers {
  members: string[];
  name: string;
}

export interface ProfileObjectPermissions {
  allowCreate?: boolean | undefined;
  allowDelete?: boolean | undefined;
  allowEdit?: boolean | undefined;
  allowRead?: boolean | undefined;
  modifyAllRecords?: boolean | undefined;
  object: string;
  viewAllRecords?: boolean | undefined;
}

export interface RetrieveRequest {
  apiVersion?: string | undefined;
  packageNames?: string[] | undefined;
  singlePackage?: boolean | undefined;
  specificFiles?: string[] | undefined;
  unpackaged?: Package | undefined;
}

export interface MetadataSaveResult {
  success: boolean;
  fullName: string;
  errors?: MetadataSaveError | MetadataSaveError[] | undefined;
}

export interface MetadataSaveError {
  fields: string | string[];
  message: string;
  statusCode: string;
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
  createdById: string | null;
  createdByName: string | null;
  createdDate: Date | null;
  fileName: string;
  fullName: string;
  id: string;
  lastModifiedById: string | null;
  lastModifiedByName: string | null;
  lastModifiedDate: Date | null;
  manageableState?: 'beta' | 'deleted' | 'deprecated' | 'deprecatedEditable' | 'installed' | 'installedEditable' | 'released' | 'unmanaged';
  namespacePrefix?: string | null;
  type: string;
}

export interface RetrieveResult {
  done: boolean;
  errorMessage?: string;
  errorStatusCode?: string;
  fileProperties: FileProperties[];
  id: string;
  messages: RetrieveMessage[];
  status: 'Pending' | 'InProgress' | 'Succeeded' | 'Failed' | 'Canceling' | 'Canceled';
  success: boolean;
  zipFile?: string | null;
}

// FIXME: validate if we need this - if server correctly coerces types, we should not need this
export interface RetrieveResultRaw extends Pick<RetrieveResult, 'fileProperties' | 'id' | 'messages'> {
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
    retrieveResult?: RetrieveDetailResult;
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

export interface RetrieveDetailResult {
  done: 'true' | 'false';
  fileProperties: ListMetadataResult[];
  id: string;
  status: 'Pending' | 'InProgress' | 'Succeeded' | 'Failed';
  errorMessage?: string;
  errorStatusCode?: string;
  messages?: { fileName: string; problem: string }[];
  zipFile: string;
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
