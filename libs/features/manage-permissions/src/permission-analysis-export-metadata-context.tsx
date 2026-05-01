import { createContext, useContext, type ReactNode } from 'react';
import type { FieldExportDetail } from './permission-export-result-view';

export interface PermissionAnalysisExportMetadataContextValue {
  fieldExportDetails: Record<string, FieldExportDetail>;
  tabLabelBySettingName: ReadonlyMap<string, string>;
}

const EMPTY_TAB_LABELS: ReadonlyMap<string, string> = new Map();

const defaultPermissionAnalysisExportMetadata: PermissionAnalysisExportMetadataContextValue = {
  fieldExportDetails: {},
  tabLabelBySettingName: EMPTY_TAB_LABELS,
};

const PermissionAnalysisExportMetadataContext = createContext<PermissionAnalysisExportMetadataContextValue>(
  defaultPermissionAnalysisExportMetadata,
);

export function usePermissionAnalysisExportMetadata(): PermissionAnalysisExportMetadataContextValue {
  return useContext(PermissionAnalysisExportMetadataContext);
}

export interface PermissionAnalysisExportMetadataProviderProps {
  value: PermissionAnalysisExportMetadataContextValue;
  children: ReactNode;
}

export function PermissionAnalysisExportMetadataProvider({ value, children }: PermissionAnalysisExportMetadataProviderProps) {
  return <PermissionAnalysisExportMetadataContext.Provider value={value}>{children}</PermissionAnalysisExportMetadataContext.Provider>;
}
