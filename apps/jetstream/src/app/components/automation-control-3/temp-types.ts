import { QueryResult, Record } from 'jsforce';

export interface AutomationControlRow<T = unknown> {
  key: string;
  name: string;
  description?: string;
  errorMessage?: string;
  value?: string;
  status?: boolean;
  progress?: string; // TODO: figure out type
  subRows?: AutomationControlRow[];
  _loadingData?: boolean;
  _isDirty: boolean;
  _meta: T;
}

export type AutomationControlRowSobject = AutomationControlRow<{ sobject: string }>;
// TODO: strongy type metadataType
export type AutomationControlRowMetadata = AutomationControlRow<{ sobject: string; metadataType: string }>;
export type AutomationControlRowMetadataItem = AutomationControlRow<{ sobject: string; metadataType: string; record?: any }>;

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
