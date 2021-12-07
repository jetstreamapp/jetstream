import { MapOf } from '@jetstream/types';
import { QueryResult } from 'jsforce';

export type ValidationRule = 'ValidationRule';
export type WorkflowRule = 'WorkflowRule';
export type FlowProcessBuilder = 'FlowProcessBuilder';
export type FlowRecordTriggered = 'FlowRecordTriggered';
export type ApexTrigger = 'ApexTrigger';

export type Flow = 'Flow'; // TODO: deprecate?
export type FlowDefinition = 'FlowDefinition'; // TODO: deprecate?

export type AutomationMetadataType = ValidationRule | WorkflowRule | FlowProcessBuilder | FlowRecordTriggered | ApexTrigger;

export type AutomationMetadataDeployType = ValidationRule | WorkflowRule | FlowDefinition | ApexTrigger;

type AutomationControlMetadataTypeGeneric =
  | ToolingValidationRuleRecord
  | ToolingWorkflowRuleRecord
  | ToolingFlowDefinitionWithVersions
  | ToolingApexTriggerRecord
  | FlowViewRecord;

export interface FetchSuccessPayload {
  type: keyof StateData;
  records: ToolingApexTriggerRecord[] | ToolingValidationRuleRecord[] | ToolingWorkflowRuleRecord[] | FlowViewRecord[];
}

export interface FetchErrorPayload {
  type: keyof StateData;
  error: string;
}

export interface StateData {
  ApexTrigger: {
    loading: boolean;
    skip: boolean;
    error?: string;
    records: ToolingApexTriggerRecord[];
    tableRow: TableRow;
  };
  ValidationRule: {
    loading: boolean;
    skip: boolean;
    error?: string;
    records: ToolingValidationRuleRecord[];
    tableRow: TableRow;
  };
  WorkflowRule: {
    loading: boolean;
    skip: boolean;
    error?: string;
    records: ToolingWorkflowRuleRecord[];
    tableRow: TableRow;
  };
  FlowRecordTriggered: {
    loading: boolean;
    skip: boolean;
    error?: string;
    records: FlowViewRecord[];
    tableRow: TableRow;
  };
  FlowProcessBuilder: {
    loading: boolean;
    skip: boolean;
    error?: string;
    records: FlowViewRecord[];
    tableRow: TableRow;
  };
}

export interface DirtyAutomationItems {
  anyDirty: boolean;
  itemsById: MapOf<boolean>;
}

export type DeploymentItemStatus =
  | 'Not Started'
  | 'Preparing'
  | 'Ready for Deploy'
  | 'Deploying'
  | 'Rolling Back'
  | 'Deployed'
  | 'Rolled Back'
  | 'Error';

export type DeploymentItemMap = MapOf<DeploymentItem>;
export interface DeploymentItem {
  status: DeploymentItemStatus;
  metadata: TableRowItem;
  deploy: AutomationControlDeploymentItem;
}

export type MetadataCompositeResponseSuccessOrError = MetadataCompositeResponseSuccess | MetadataCompositeResponseError[];

export interface MetadataCompositeResponseSuccess {
  Id: string;
  FullName: string;
  Body?: string; // ApexTrigger
  ApiVersion?: number; // ApexTrigger
  Metadata: any;
}

export interface MetadataCompositeResponseError {
  errorCode: string;
  fields?: string[];
  message: string;
}

export interface AutomationControlDeploymentItem {
  type: AutomationMetadataType;
  id: string;
  activeVersionNumber?: number; // only applies to flows
  value: boolean;
  requireMetadataApi: boolean;
  metadataRetrieve?: MetadataCompositeResponseSuccess;
  metadataDeploy?: MetadataCompositeResponseSuccess;
  metadataDeployRollback?: MetadataCompositeResponseSuccess;
  retrieveError?: MetadataCompositeResponseError[];
  deployError?: MetadataCompositeResponseError[];
}

export interface DeploymentItemByType {
  validationRules: AutomationControlDeploymentItem[];
  workflowRules: AutomationControlDeploymentItem[];
  apexTriggers: AutomationControlDeploymentItem[];
  flows: AutomationControlDeploymentItem[];
}

export interface AutomationItems {
  ValidationRule: AutomationControlMetadataType<ToolingValidationRuleRecord, null>;
  WorkflowRule: AutomationControlMetadataType<ToolingWorkflowRuleRecord, null>;
  Flow: AutomationControlMetadataType<ToolingFlowDefinitionWithVersions, FlowViewRecord>;
  ApexTrigger: AutomationControlMetadataType<ToolingApexTriggerRecord, null>;
}

export interface AutomationItemsChildren {
  key: string;
  sobjectName: string;
  sobjectLabel: string;
  automationItems: {
    ValidationRule: AutomationControlMetadataTypeItem<ToolingValidationRuleRecord, null>[];
    WorkflowRule: AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecord, null>[];
    Flow: AutomationControlMetadataTypeItem<ToolingFlowDefinitionWithVersions, FlowViewRecord>[];
    ApexTrigger: AutomationControlMetadataTypeItem<ToolingApexTriggerRecord, null>[];
  };
}

export interface AutomationControlParentSobject {
  key: string;
  entityDefinitionId: string;
  entityDefinitionRecord: ToolingEntityDefinitionRecord;
  sobjectName: string;
  sobjectLabel: string;
  loading: boolean;
  hasLoaded: boolean;
  inProgress: boolean;
  error: boolean;
  automationItems: AutomationItems;
}

export interface AutomationControlMetadataType<T = AutomationControlMetadataTypeGeneric, K = void | FlowViewRecord> {
  metadataType: string;
  loading: boolean;
  hasLoaded: boolean;
  errorMessage?: string;
  expanded: boolean;
  items: AutomationControlMetadataTypeItem<T, K>[];
}

export interface AutomationControlMetadataTypeItem<T = AutomationControlMetadataTypeGeneric, K = void | FlowViewRecord> {
  key: string;
  fullName: string;
  label: string;
  description: string;
  initialValue: boolean;
  currentValue: boolean;
  initialActiveVersion?: number; // only applies to item with versions (Flow)
  currentActiveVersion?: number; // only applies to item with versions (Flow)
  expanded?: boolean; // only applies to items with children
  children?: AutomationControlMetadataTypeItem<K>[]; // flows is the only type with children
  LastModifiedDate: string;
  LastModifiedByName: string;
  metadata: T;
}

// TODO: move to salesforce types
interface RecordAttributes {
  type: string;
  url: string;
}
interface SystemFields {
  attributes: RecordAttributes;
  Id: string;
  CreatedDate: string;
  CreatedBy: { attributes: RecordAttributes; Id: string; Name: string; Username: string };
  LastModifiedDate: string;
  LastModifiedBy: { attributes: RecordAttributes; Id: string; Name: string; Username: string };
}

export interface ToolingMetadataComponentDependencyRecord {
  Id: string;
  RefMetadataComponentId: string;
  RefMetadataComponentType: string;
  RefMetadataComponentName: string;
  MetadataComponentId: string;
  MetadataComponentType: string;
  MetadataComponentName: string;
  MetadataComponentNamespace: string;
}

export interface ToolingValidationRuleRecord extends SystemFields {
  EntityDefinitionId: string;
  EntityDefinition: { QualifiedApiName: string };
  ValidationName: string;
  Active: boolean;
  Description: string;
  ErrorMessage: string;
  FullName: string;
  Metadata: MetadataValidationRuleRecord;
}

export interface ToolingApexTriggerRecord extends SystemFields {
  Id: string;
  Name: string;
  ApiVersion: string;
  EntityDefinitionId: string;
  EntityDefinition: { QualifiedApiName: string };
  Status: 'Inactive' | 'Active' | 'Deleted';
}

export interface ToolingEntityDefinitionRecord {
  attributes: RecordAttributes;
  Id: string;
  QualifiedApiName: string;
  MasterLabel: string;
  Label: string;
  PluralLabel: string;
  Description: string;
  DetailUrl: string;
  DeveloperName: string;
  DurableId: string;
  EditDefinitionUrl: string;
  EditUrl: string;
  KeyPrefix: string;
  LastModifiedDate: string;
  NamespacePrefix: string;
  NewUrl: string;
  PublisherId: string | '<local>' | 'System';
  LastModifiedById: string;
  ApexTriggers: QueryResult<ToolingApexTriggerRecord>;
  ValidationRules: QueryResult<ToolingValidationRuleRecord>;
}

export interface ToolingWorkflowRuleRecord extends SystemFields {
  Id: string;
  Name: string;
  TableEnumOrId: string;
  FullName: string;
  Metadata: MetadataWorkflowRuleRecord;
}

export interface ToolingFlowAggregateRecord {
  attributes: { type: 'AggregateResult' };
  MostRecentId: string;
  DefinitionId: string;
}

export interface FlowViewRecord extends Omit<SystemFields, 'CreatedDate' | 'CreatedBy' | 'LastModifiedBy'> {
  ActiveVersionId: string;
  Label: string;
  ApiName: string;
  Description: string;
  DurableId: string;
  IsActive: boolean;
  LatestVersionId: string;
  LastModifiedBy: string;
  ProcessType: 'AutoLaunchedFlow' | 'Workflow' | 'InvocableProcess';
  // ID of the object or platform event that triggers this flow. This field is available in API version 53.0 and later.
  TriggerObjectOrEventId?: string;
  TriggerObjectOrEvent?: { QualifiedApiName: string };
  // The label of the object or platform event that triggers this flow. This field is available in API version 53.0 and later.
  TriggerObjectOrEventLabel?: string;
  // Available only when processType is AutoLaunchedFlow. This field is available in API version 47.0 and later.
  TriggerType?: 'PlatformEvent' | 'RecordAfterSave' | 'RecordBeforeSave' | 'Scheduled';
  Versions: QueryResult<ToolingFlowVersionRecord>;
}

export interface ToolingFlowVersionRecord {
  Id: string;
  ApiVersion: string;
  ApiVersionRuntime: string;
  DurableId: string;
  LastModifiedDate: string;
  ProcessType: string;
  RunInMode: string;
  Description: string;
  Label: string;
  VersionNumber: number;
  Status: 'Active' | 'Draft' | 'Obsolete' | 'InvalidDraft';
}

/** TODO: anything below might be old */

export interface ToolingFlowRecordWithDefinition extends FlowViewRecord {
  Definition: ToolingFlowDefinition;
}

export interface ToolingFlowDefinition extends SystemFields {
  Id: string;
  Description: string;
  DeveloperName: string;
  MasterLabel: string;
  ActiveVersionId: string;
  ActiveVersion?: { VersionNumber: number };
  LatestVersionId: string;
  LatestVersion?: { VersionNumber: number };
  ManageableState: string;
  NamespacePrefix: string;
}

export interface ToolingFlowDefinitionWithVersions extends ToolingFlowDefinition {
  Versions: FlowViewRecord[];
}

export interface MetadataValidationRuleRecord {
  description: string;
  errorConditionFormula: string;
  errorDisplayField: string;
  errorMessage: string;
  shouldEvaluateOnClient: null;
  urls: null;
  active: boolean;
}

export interface MetadataWorkflowRuleRecord {
  actions: {
    // WorkflowActionReference
    name: string;
    type: 'Alert' | 'FieldUpdate' | 'FlowAction' | 'OutboundMessage' | 'Task';
  }[];
  description?: string;
  active: boolean; // TODO: convert to bool
  formula: string;
  booleanFilter?: string;
  criteriaItems?: {
    field: string;
    operation:
      | 'equals'
      | 'notEqual'
      | 'lessThan'
      | 'greaterThan'
      | 'lessOrEqual'
      | 'greaterOrEqual'
      | 'contains'
      | 'notContain'
      | 'startsWith'
      | 'includes'
      | 'excludes'
      | 'within';
    value: string;
    valueField: string;
  }[];
  triggerType: 'onCreateOrTriggeringUpdate' | 'onAllChanges' | 'onCreateOnly';
  workflowTimeTriggers?: {
    actions: {
      // WorkflowActionReference
      name: 'Update_Some_Field';
      type: 'Alert' | 'FieldUpdate' | 'FlowAction' | 'OutboundMessage' | 'Task';
    }[];
    offsetFromField: string;
    timeLength: string;
    workflowTimeTriggerUnit: 'Hours' | 'Days';
  }[];
}

export interface FlowMetadata {
  actionCalls: any[];
  apexPluginCalls: any[];
  assignments: any[];
  choices: any[];
  constants: any[];
  decisions: any[];
  description: string;
  dynamicChoiceSets: any[];
  formulas: any[];
  interviewLabel: string;
  isAdditionalPermissionRequiredToRun?: any;
  isTemplate?: any;
  label: string;
  loops: any[];
  processMetadataValues: {
    name: string;
    value: {
      booleanValue?: any;
      dateTimeValue?: any;
      dateValue?: any;
      elementReference: string;
      numberValue?: any;
      stringValue: string;
    };
  }[];
  processType: string;
  recordCreates: any[];
  recordDeletes: any[];
  recordLookups: any[];
  recordUpdates: any[];
  runInMode?: any;
  screens: any[];
  start?: {
    connector: {
      processMetadataValues: [];
      targetReference: string;
    };
    description: any;
    doesRequireRecordChangedToMeetCriteria: any;
    elementSubtype: any;
    filterLogic: any;
    filters: [];
    label: any;
    locationX: number;
    locationY: number;
    name: any;
    /** Record triggered flows have an object populated */
    object: string | null;
    objectContainer: any;
    processMetadataValues: any[];
    recordTriggerType: string;
    schedule: any;
    scheduledPaths: [];
    triggerType: string;
  };
  startElementReference: string;
  status: string;
  steps: any[];
  subflows: any[];
  textTemplates: any[];
  urls?: any;
  variables: any[];
  waits: any[];
}

export interface TableContext {
  updateIsActiveFlag: (row: TableRowOrItemOrChild, value: boolean) => void;
}

export type TableRowOrItemOrChild = TableRow | TableRowItem | TableRowItemChild;
export type TableRowItemOrChild = TableRowItem | TableRowItemChild;

export type TableRowItemSnapshot = Pick<TableRowItem, 'key' | 'type' | 'sobject' | 'isActive' | 'activeVersionNumber'>;

export interface TableRow {
  path: [string];
  key: string;
  type: AutomationMetadataType;
  label: string;
  loading: boolean;
  hasError: boolean;
  errorMessage?: string;
  items: TableRowItem[];
}

export interface TableRowItem {
  path: [string, string];
  key: string;
  parentKey: string;
  type: AutomationMetadataType;
  sobject: string;
  record: ToolingApexTriggerRecord | ToolingValidationRuleRecord | ToolingWorkflowRuleRecord | FlowViewRecord;
  link: string;
  /** True for Flow and PB as this is controlled from children */
  readOnly: boolean;
  isActive: boolean;
  isActiveInitialState: boolean;
  /** only applies to activeVersionId and PB */
  activeVersionNumber?: number;
  activeVersionNumberInitialState?: number;
  label: string;
  lastModifiedBy: string;
  description: string | null;
  additionalData: TableItemAdditionalData[];
  children?: TableRowItemChild[];
}

export interface TableRowItemChild {
  path: [string, string, string];
  key: string;
  parentKey: string;
  type: AutomationMetadataType;
  sobject: string;
  record: ToolingFlowVersionRecord;
  link?: string;
  isActive: boolean;
  isActiveInitialState: boolean;
  label: string;
  lastModifiedBy: string;
  description: string | null;
  additionalData: TableItemAdditionalData[];
}

export interface TableItemAdditionalData {
  label: string;
  value: string;
}

export interface TableEditorImperativeHandle {
  resetChanges: () => void;
  // Select all does not work well for flows/process builders since there is a version that needs to be selected
  // selectAll: (value: boolean) => void;
  getDirtyRows: () => TableRowItem[];
  refreshProcessBuilders: () => void;
  refreshAfterDeploy: () => void;
}
