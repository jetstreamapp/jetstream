import { QueryResult } from 'jsforce';
import { MapOf } from '@jetstream/types';

export type ValidationRule = 'ValidationRule';
export type WorkflowRule = 'WorkflowRule';
export type Flow = 'Flow';
export type FlowDefinition = 'FlowDefinition';
export type ApexTrigger = 'ApexTrigger';

export type AutomationMetadataType = ValidationRule | WorkflowRule | Flow | ApexTrigger;
export type AutomationMetadataDeployType = ValidationRule | WorkflowRule | FlowDefinition | ApexTrigger;

type AutomationControlMetadataTypeGeneric =
  | ToolingValidationRuleRecord
  | ToolingWorkflowRuleRecord
  | ToolingFlowDefinitionWithVersions
  | ToolingApexTriggerRecord
  | ToolingFlowRecord;

export interface DirtyAutomationItems {
  anyDirty: boolean;
  itemsById: MapOf<boolean>;
}

export type DeploymentItemStatus = 'Not Started' | 'Preparing' | 'Ready for Deploy' | 'Deploying' | 'Success' | 'Error';

export type DeploymentItemMap = MapOf<{
  status: DeploymentItemStatus;
  metadata: AutomationControlMetadataTypeItem;
  deploy: AutomationControlDeploymentItem;
}>;

export interface AutomationControlDeploymentItem {
  type: AutomationMetadataDeployType;
  id: string;
  activeVersion?: number; // only applies to process builders
  value: boolean;
  metadataRetrieve?: { Id: string; FullName: string; Metadata: any };
  metadataDeploy?: { FullName: string; Metadata: any };
  retrieveError?: any;
  deployError?: any;
}

export interface DeploymentItemByType {
  validationRules: AutomationControlDeploymentItem[];
  workflowRules: AutomationControlDeploymentItem[];
  apexTriggers: AutomationControlDeploymentItem[];
  processBuilders: AutomationControlDeploymentItem[];
}

export interface AutomationItems {
  ValidationRule: AutomationControlMetadataType<ToolingValidationRuleRecord, null>;
  WorkflowRule: AutomationControlMetadataType<ToolingWorkflowRuleRecord, null>;
  Flow: AutomationControlMetadataType<ToolingFlowDefinitionWithVersions, ToolingFlowRecord>;
  ApexTrigger: AutomationControlMetadataType<ToolingApexTriggerRecord, null>;
}

export interface AutomationItemsChildren {
  key: string;
  sobjectName: string;
  sobjectLabel: string;
  automationItems: {
    ValidationRule: AutomationControlMetadataTypeItem<ToolingValidationRuleRecord, null>[];
    WorkflowRule: AutomationControlMetadataTypeItem<ToolingWorkflowRuleRecord, null>[];
    Flow: AutomationControlMetadataTypeItem<ToolingFlowDefinitionWithVersions, ToolingFlowRecord>[];
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

export interface AutomationControlMetadataType<T = AutomationControlMetadataTypeGeneric, K = void | ToolingFlowRecord> {
  metadataType: string;
  loading: boolean;
  hasLoaded: boolean;
  errorMessage?: string;
  expanded: boolean;
  items: AutomationControlMetadataTypeItem<T, K>[];
}

export interface AutomationControlMetadataTypeItem<T = AutomationControlMetadataTypeGeneric, K = void | ToolingFlowRecord> {
  key: string;
  fullName: string;
  label: string;
  description: string;
  initialValue: boolean;
  currentValue: boolean;
  initialActiveVersion?: number; // only applies to item with versions (Flow)
  currentActiveVersion?: number; // only applies to item with versions (Flow)
  expanded?: boolean; // only applies to items with children
  children?: AutomationControlMetadataTypeItem<K>[]; // Process Builder is the only type with children
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
  CreatedBy: { attributes: RecordAttributes; Name: string };
  LastModifiedDate: string;
  LastModifiedBy: { attributes: RecordAttributes; Name: string };
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
  Status: 'Inactive' | 'Active' | 'Deleted';
}

export interface ToolingEntityDefinitionRecord {
  attributes: {};
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

export interface ToolingFlowRecord extends SystemFields {
  Description: string;
  MasterLabel: string;
  DefinitionId: string;
  ManageableState: string;
  ProcessType: 'Workflow' | 'InvocableProcess';
  Status: 'Active' | 'Draft' | 'Obsolete' | 'InvalidDraft';
  VersionNumber: number;
}

export interface ToolingFlowRecordWithDefinition extends ToolingFlowRecord {
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
  Versions: ToolingFlowRecord[];
}

// export interface ToolingWorkflowRuleRecordWithMetadata {
//   tooling: ToolingWorkflowRuleRecord;
//   metadata: MetadataWorkflowRuleRecord;
// }

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
  start?: any;
  startElementReference: string;
  status: string;
  steps: any[];
  subflows: any[];
  textTemplates: any[];
  urls?: any;
  variables: any[];
  waits: any[];
}
