import { ChildRelationship, DescribeSObjectResult, Field, Maybe } from '@jetstream/types';

export type SobjectExportFieldName =
  | keyof Field
  | 'childRelationshipName'
  | 'dataTranslationEnabled'
  | 'autoNumber'
  | 'aiPredictionField'
  | 'formulaTreatNullNumberAsZero'
  | 'restrictedDelete'
  | 'typeLabel';

export interface SobjectExportField {
  name: SobjectExportFieldName;
  label: string;
  description?: string;
  tertiaryLabel?: string;
  getterFn?: (value: any) => string;
  childRelationshipGetterFn?: (field: Field, sobjectsWithChildRelationships: Record<string, Record<string, ChildRelationship>>) => string;
}

export interface SavedExportOptions {
  options: ExportOptions;
  fields: string[];
}

export type ExportWorksheetLayout = 'combined' | 'split';
export type ExportHeaderOption = 'label' | 'name';

export interface ExportOptions {
  worksheetLayout: ExportWorksheetLayout;
  headerOption: ExportHeaderOption;
  includesStandardFields: boolean;
  includeObjectAttributes: boolean;
  saveAsDefaultSelection: boolean;
}

export interface SobjectFetchResult {
  sobject: string;
  error?: Maybe<string>;
  metadata: Maybe<DescribeSObjectResult>;
}
