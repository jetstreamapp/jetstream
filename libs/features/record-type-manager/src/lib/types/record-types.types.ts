import { SFDC_BLANK_PICKLIST_VALUE } from '@jetstream/shared/constants';
import { Maybe, PicklistEntry } from '@jetstream/types';

export type ViewMode = 'FIELD' | 'RECORD_TYPE';

export interface SobjectWithPicklistValues {
  sobjectName: string;
  sobjectLabel: string;
  picklistValues: Record<string, PicklistFieldEntry>;
  recordTypeValues: Record<string, RecordTypeValue>;
}

export interface RecordTypeValue {
  fullName: string;
  recordType: string;
  recordTypeLabel: string;
  sobject: string;
  sobjectLabel: string;
  picklistValues: Record<string, RecordTypePicklistConfiguration>;
}

export interface PicklistFieldEntry {
  fieldName: string;
  fieldLabel: string;
  values: PicklistEntry[];
}

export interface RecordTypePicklistConfiguration {
  fieldName: string;
  fieldLabel: string;
  initialValues: Set<string>;
  currentValues: Set<string>;
  initialDefaultValue: string | typeof SFDC_BLANK_PICKLIST_VALUE;
  defaultValue: string | typeof SFDC_BLANK_PICKLIST_VALUE;
  dirtyValues: Set<string>;
}

export interface RecordTypePicklistSummary {
  sobject: string;
  sobjectLabel: string;
  field: string;
  fieldLabel: string;
  recordType: string;
  recordTypeFullName: string;
  recordTypeLabel: string;
  values: Set<string>;
  defaultValue: string | null;
  isValid: boolean;
  errorMessage?: Maybe<string>;
}
