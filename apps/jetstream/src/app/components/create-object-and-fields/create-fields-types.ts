import { ListItem, SalesforceOrgUi } from '@jetstream/types';

export type FieldDefinitions = Record<FieldDefinitionType, FieldDefinition>;
interface FieldValueExtension {
  _key: number;
  _allValid: boolean;
  _picklistGlobalValueSet: boolean;
}
export type FieldValues = Record<FieldDefinitionType, FieldValueState> & FieldValueExtension;
export type FieldValueDependencies = Record<SalesforceFieldType, FieldDefinitionType[]>;

export type FieldValue = string | boolean | number;
export type FieldDefinitionType =
  | 'type'
  | 'label'
  | 'fullName'
  | 'inlineHelpText'
  | 'description'
  | 'defaultValue'
  | 'referenceTo'
  | 'deleteConstraint'
  | 'length'
  | 'scale'
  | 'required'
  | 'unique'
  | 'externalId'
  | 'valueSet'
  | 'globalValueSet'
  | 'firstAsDefault'
  | 'restricted'
  | 'visibleLines'
  | 'startingNumber'
  | 'displayFormat'
  | 'populateExistingRows'
  | 'formula'
  | 'formulaTreatBlanksAs'
  | 'writeRequiresMasterRead'
  | 'secondaryType'
  | 'writeRequiresMasterRead'
  | 'reparentableMasterDetail';

export type SalesforceFieldType =
  | 'autoNumber'
  | 'formula'
  | 'checkbox'
  | 'currency'
  | 'date'
  | 'dateTime'
  | 'time'
  | 'number'
  | 'percent'
  | 'phone'
  | 'email'
  | 'masterDetail'
  | 'lookup'
  | 'picklist'
  | 'multiselectPicklist'
  | 'url'
  | 'text'
  | 'textArea'
  | 'longTextArea';

export type FieldDefinitionUiType = 'picklist' | 'text' | 'textarea' | 'radio' | 'checkbox';

export interface FieldValueState {
  value: FieldValue;
  touched: boolean;
  isValid: boolean;
  errorMessage: string | null;
}

export interface FieldDefinition {
  label: string;
  type: FieldDefinitionUiType;
  values?: ListItem[] | ((org: SalesforceOrgUi) => Promise<ListItem[]>);
  helpText?: string;
  labelHelp?: string;
  // TODO: add a "failed validation error message"
  validate?: (value: FieldValue) => boolean;
  placeholder?: string;
  required?: boolean;
  disabled?: (fieldValues: FieldValues) => boolean;
}

export interface GlobalPicklistRecord {
  Id: string;
  DeveloperName: string;
  ManageableState: string;
  MasterLabel: string;
}
