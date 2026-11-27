export type OrgAlignmentSelectionMode = 'common' | 'all' | 'custom';

export interface OrgAlignmentRunSummaryCounts {
  onlyInSource: number;
  onlyInTarget: number;
  different: number;
  same: number;
  uncomparable: number;
  managedSkipped: number;
}

/**
 * Saved Org Alignment comparison definition stored locally per user in IndexedDB.
 * Captures the org pair and comparison options so users can re-run drift reports on demand.
 */
export interface OrgAlignmentSavedComparison {
  key: string;
  name: string;
  description?: string;
  sourceOrgId: string;
  sourceOrgLabel: string;
  targetOrgId: string;
  targetOrgLabel: string;
  selectionMode: OrgAlignmentSelectionMode;
  selectedMetadataTypes: string[];
  includeManaged: boolean;
  normalizePermissionXml: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date | null;
  lastRunSummary?: OrgAlignmentRunSummaryCounts | null;
}
