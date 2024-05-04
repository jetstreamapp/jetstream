/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListItem, SalesforceOrgUi } from '@jetstream/types';

export type ManualFormulaFieldType = 'string' | 'double' | 'boolean' | 'date' | 'datetime' | 'time';

export type ManualFormulaRecord = Record<
  string,
  {
    value: FieldValue | null;
    type: ManualFormulaFieldType;
  }
>;

export type FieldDefinitionMetadata = Partial<Record<FieldDefinitionType, any>>;

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
  | 'precision'
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
  | 'reparentableMasterDetail'
  | 'relationshipName';

export type SalesforceFieldType =
  | 'AutoNumber'
  | 'Formula'
  | 'Checkbox'
  | 'Currency'
  | 'Date'
  | 'DateTime'
  | 'Time'
  | 'Number'
  | 'Percent'
  | 'Phone'
  | 'Email'
  | 'MasterDetail'
  | 'Lookup'
  | 'Picklist'
  | 'MultiselectPicklist'
  | 'Url'
  | 'Text'
  | 'TextArea'
  | 'LongTextArea'
  | 'Html';

export type FieldDefinitionUiType = 'picklist' | 'text' | 'textarea' | 'textarea-with-formula' | 'radio' | 'checkbox';

export interface FieldValueState {
  value: FieldValue;
  touched: boolean;
  isValid: boolean;
  errorMessage: string | null;
}

export interface FieldDefinition {
  label: string;
  type: FieldDefinitionUiType | ((type: SalesforceFieldType) => FieldDefinitionUiType);
  values?: ListItem[] | ((org: SalesforceOrgUi, skipRequestCache?: boolean) => Promise<ListItem[]>);
  allowRefreshValues?: boolean;
  helpText?: string | ((type: SalesforceFieldType) => string | undefined);
  labelHelp?: string | ((type: SalesforceFieldType) => string | undefined);
  validate?: (value: FieldValue, fieldValues: FieldValues) => boolean;
  invalidErrorMessage?: string | ((type: SalesforceFieldType | undefined) => string);
  placeholder?: string;
  required?: boolean;
  disabled?: (fieldValues: FieldValues) => boolean;
}

export interface GlobalPicklistRecord {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
  NamespacePrefix: string | null;
}

// extremely truncated
export interface LayoutRecord {
  attributes: {
    type: string;
    url?: string;
  };
  Id: string;
  FullName: string;
  Metadata: {
    layoutSections: {
      layoutColumns: {
        layoutItems: {
          behavior: 'Readonly' | 'Edit' | 'Required';
          field: string;
          analyticsCloudComponent: null;
          canvas: null;
          component: null;
          customLink: null;
          emptySpace: null;
          height: null;
          page: null;
          reportChartComponent: null;
          scontrol: null;
          showLabel: null;
          showScrollbars: null;
          width: null;
        }[];
      }[];
    }[];
    platformActionList?: any;
    summaryLayout?: any;
    relatedLists?: {
      customButtons?: string[] | null;
      excludeButtons?: string[] | null;
      fields?: string[] | null;
      quickActions?: string[] | null;
      relatedList?: string | null;
      sortField?: string | null;
      sortOrder?: string | null;
    }[];
  };
}

export interface LayoutResult {
  id: string;
  deployed: boolean;
  error?: string;
  metadata?: LayoutRecord;
}

export interface FieldPermissionRecord {
  Success?: boolean;
  Id?: string;
  Errors?: string;
  attributes: {
    type: string;
  };
  Field: string;
  ParentId: string;
  PermissionsEdit: boolean;
  PermissionsRead: boolean;
  SobjectType: string;
}

export interface EntityParticleRecord {
  EntityDefinition: {
    QualifiedApiName: string;
  };
  DurableId: string;
  QualifiedApiName: string;
}
