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
