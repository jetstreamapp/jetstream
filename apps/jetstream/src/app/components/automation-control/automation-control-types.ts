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
    Flow: AutomationControlMetadataType<ToolingFlowDefinitionWithVersions>;
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

export interface ToolingWorkflowRuleRecordWithMetadata {
  tooling: ToolingWorkflowRuleRecord;
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
