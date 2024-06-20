import {
  ApexTrigger,
  AutomationMetadataType,
  DuplicateRule,
  FlowProcessBuilder,
  FlowRecordTriggered,
  Maybe,
  QueryResult,
  ValidationRule,
  WorkflowRule,
} from '@jetstream/types';

// re-export so local components do not need to update location
export type { ApexTrigger, AutomationMetadataType, DuplicateRule, FlowProcessBuilder, FlowRecordTriggered, ValidationRule, WorkflowRule };

export interface FetchSuccessPayload {
  type: keyof StateData;
  records:
    | DuplicateRuleRecord[]
    | ToolingApexTriggerRecord[]
    | ToolingValidationRuleRecord[]
    | ToolingWorkflowRuleRecord[]
    | FlowViewRecord[];
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
  DuplicateRule: {
    loading: boolean;
    skip: boolean;
    error?: string;
    records: DuplicateRuleRecord[];
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

export type DeploymentItemStatus =
  | 'Not Started'
  | 'Preparing'
  | 'Ready for Deploy'
  | 'Deploying'
  | 'Rolling Back'
  | 'Deployed'
  | 'Rolled Back'
  | 'Error';

export type DeploymentItemMap = Record<string, DeploymentItem>;
export interface DeploymentItem {
  status: DeploymentItemStatus;
  metadata: TableRowItem;
  deploy: AutomationControlDeploymentItem;
}

export interface DeploymentItemRow extends TableRowItem {
  status: DeploymentItemStatus;
  deploy: AutomationControlDeploymentItem;
  typeLabel: string;
}

export type MetadataCompositeResponseSuccessOrError = MetadataCompositeResponseSuccess | MetadataCompositeResponseError[];

export interface MetadataCompositeResponseSuccess {
  Id?: string;
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
  activeVersionNumber?: number | null; // only applies to flows
  value: boolean;
  requireMetadataApi: boolean;
  metadataRetrieve?: MetadataCompositeResponseSuccess | null;
  metadataDeploy?: MetadataCompositeResponseSuccess | null;
  metadataDeployRollback?: MetadataCompositeResponseSuccess | null;
  retrieveError?: MetadataCompositeResponseError[] | null;
  deployError?: MetadataCompositeResponseError[] | null;
}

export interface DeploymentItemByType {
  apexTriggers: AutomationControlDeploymentItem[];
  duplicateRules: AutomationControlDeploymentItem[];
  validationRules: AutomationControlDeploymentItem[];
  workflowRules: AutomationControlDeploymentItem[];
  flows: AutomationControlDeploymentItem[];
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

/** This is not tooling */
export interface DuplicateRuleRecord extends SystemFields {
  Id: string;
  DeveloperName: string;
  IsActive: boolean;
  MasterLabel: string;
  NamespacePrefix: string;
  SobjectSubtype: string;
  SobjectType: string;
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
  ManageableState: 'beta' | 'deleted' | 'deprecated' | 'deprecatedEditable' | 'installed' | 'installedEditable' | 'released' | 'unmanaged';
  IsTemplate: boolean;
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
  isExpanded?: boolean;
  items: TableRowItem[];
}

export interface TableRowItem {
  path: [string, string];
  key: string;
  parentKey: string;
  type: AutomationMetadataType;
  sobject: string;
  record: DuplicateRuleRecord | ToolingApexTriggerRecord | ToolingValidationRuleRecord | ToolingWorkflowRuleRecord | FlowViewRecord;
  link: string;
  /** True for Flow and PB as this is controlled from children */
  readOnly: boolean;
  isExpanded?: boolean;
  isActive: boolean;
  isActiveInitialState: boolean;
  /** only applies to activeVersionId and PB */
  activeVersionNumber?: number | null;
  activeVersionNumberInitialState?: number | null;
  label: string;
  lastModifiedBy: string;
  description: Maybe<string>;
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
  link?: string | null;
  isActive: boolean;
  isActiveInitialState: boolean;
  label: string;
  lastModifiedBy: string;
  description: string | null;
  isExpanded?: boolean;
  additionalData: TableItemAdditionalData[];
}

export interface TableItemAdditionalData {
  label: string;
  value: string | null;
}

export interface TableEditorImperativeHandle {
  resetChanges: () => void;
  // Select all does not work well for flows/process builders since there is a version that needs to be selected
  // selectAll: (value: boolean) => void;
  getDirtyRows: () => TableRowItem[];
  refreshProcessBuilders: () => void;
  refreshAfterDeploy: () => void;
}
