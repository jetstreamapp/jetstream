import { QueryResult } from 'jsforce';

export type AutomationMetadataType = 'ValidationRule' | 'WorkflowRule' | 'Flow' | 'ApexTrigger' | 'AssignmentRule';

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
  automationItems: {
    ValidationRule: AutomationControlMetadataType<ToolingValidationRuleRecord>;
    WorkflowRule: AutomationControlMetadataType<ToolingWorkflowRuleRecordWithMetadata>;
    Flow: AutomationControlMetadataType;
    ApexTrigger: AutomationControlMetadataType<ToolingApexTriggerRecord>;
    AssignmentRule: AutomationControlMetadataType<ToolingAssignmentRuleRecord>;
  };
}

export interface AutomationControlMetadataType<T = unknown> {
  metadataType: string;
  loading: boolean;
  hasLoaded: boolean;
  items: AutomationControlMetadataTypeItem<T>[];
}

export interface AutomationControlMetadataTypeItem<T = unknown> {
  fullName: string;
  label: string;
  description: string;
  initialValue: boolean;
  currentValue: boolean;
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
export interface ToolingValidationRuleRecord extends SystemFields {
  EntityDefinitionId: string;
  ValidationName: string;
  Active: boolean;
  Description: string;
  ErrorMessage: string;
}

export interface ToolingApexTriggerRecord extends SystemFields {
  Id: string;
  Name: string;
  ApiVersion: string;
  EntityDefinitionId: string;
  Status: 'Inactive' | 'Active' | 'Deleted';
}

export interface ToolingAssignmentRuleRecord extends SystemFields {
  EntityDefinitionId: string;
  Name: string;
  Active: boolean;
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
  AssignmentRules: QueryResult<ToolingAssignmentRuleRecord>;
  ValidationRules: QueryResult<ToolingValidationRuleRecord>;
}

export interface ToolingWorkflowRuleRecord extends SystemFields {
  Id: string;
  Name: string;
  TableEnumOrId: string;
}

export interface FlowRecord extends SystemFields {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
  Description: string;
  ActiveVersionId: string;
  LatestVersionId: string;
}

export interface ToolingWorkflowRuleRecordWithMetadata {
  tooling: ToolingWorkflowRuleRecord;
  metadata: MetadataWorkflowRuleRecord;
}

export interface FlowRecordWithMetadata {
  tooling: FlowRecord;
  metadata: MetadataWorkflowRuleRecord;
}

export interface MetadataWorkflowRuleRecord {
  actions: {
    // WorkflowActionReference
    name: 'Update_Some_Field';
    type: 'Alert' | 'FieldUpdate' | 'FlowAction' | 'OutboundMessage' | 'Task';
  };
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
  fullName: string;
  triggerType: 'onCreateOrTriggeringUpdate' | 'onAllChanges' | 'onCreateOnly';
  workflowTimeTriggers?: {
    actions: {
      // WorkflowActionReference
      name: 'Update_Some_Field';
      type: 'Alert' | 'FieldUpdate' | 'FlowAction' | 'OutboundMessage' | 'Task';
    };
    offsetFromField: string;
    timeLength: string;
    workflowTimeTriggerUnit: 'Hours' | 'Days';
  };
}

export interface MetadataFlowRecord {
  description: string;
  interviewLabel: string;
  label: string;
  processType:
    | 'Appointments'
    | 'AutoLaunchedFlow'
    | 'ContactRequestFlow'
    | 'CustomerLifecycle'
    | 'CustomEvent'
    | 'FieldServiceMobile'
    | 'FieldServiceWeb'
    | 'Flow'
    | 'InvocableProcess'
    | 'Survey'
    | 'SurveyEnrich'
    | 'Workflow';
  startElementReference: string;
  status: 'Active' | 'Draft' | 'Obsolete' | 'InvalidDraft';
  isAdditionalPermissionRequiredToRun?: boolean;
  isTemplate?: boolean;
}
