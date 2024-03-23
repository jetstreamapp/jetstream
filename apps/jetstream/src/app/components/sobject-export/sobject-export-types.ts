import { DescribeSObjectResult, Field, Maybe } from '@jetstream/types';

export type SobjectExportFieldName =
  | keyof Field
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
  getterFn?: (value: any) => string;
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
