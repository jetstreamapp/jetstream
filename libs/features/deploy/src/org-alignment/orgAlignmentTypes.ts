import { ListMetadataResult, OrgAlignmentRunSummaryCounts, OrgAlignmentSelectionMode, SalesforceOrgUi } from '@jetstream/types';
import { FilePropertiesWithContent } from '../view-or-compare-metadata/viewOrCompareMetadataTypes';

export type OrgAlignmentDiffStatus = 'onlyInSource' | 'onlyInTarget' | 'different' | 'same' | 'uncomparable';

export type OrgAlignmentTypeExecutionStatus =
  | 'pending'
  | 'listing'
  | 'retrieving'
  | 'comparing'
  | 'complete'
  | 'error'
  | 'canceled'
  | 'uncomparable';

export type OrgAlignmentDeployDirection = 'A_TO_B' | 'B_TO_A';

/** What the user chose to compare and how, kept together because a saved comparison restores all of it */
export interface OrgAlignmentComparisonOptions {
  selectionMode: OrgAlignmentSelectionMode;
  /** Only used when `selectionMode` is custom */
  customMetadataTypes: string[];
  includeManaged: boolean;
  normalizePermissionXml: boolean;
}

export interface OrgAlignmentFilePair {
  fileName: string;
  source?: FilePropertiesWithContent;
  target?: FilePropertiesWithContent;
  matches: boolean;
}

export interface OrgAlignmentComponentItem {
  /** Stable unique identifier within a run: `${type}:${fullName}` */
  key: string;
  type: string;
  typeLabel: string;
  fullName: string;
  status: OrgAlignmentDiffStatus;
  /** Human-readable explanation when status === 'uncomparable' */
  uncomparableReason?: string;
  isManaged: boolean;
  sourceItem?: ListMetadataResult;
  targetItem?: ListMetadataResult;
  /** File pairs populated during candidate retrieval or lazy on-demand diff load */
  files: OrgAlignmentFilePair[];
  /** Whether source/target file contents have been retrieved for diff viewing */
  filesLoaded: boolean;
}

export interface OrgAlignmentTypeResult {
  type: string;
  typeLabel: string;
  inFolder: boolean;
  executionStatus: OrgAlignmentTypeExecutionStatus;
  uncomparableReason?: string;
  errorMessage?: string;
  progressMessage?: string;
  /** Raw listMetadata items from Org A (kept for dependency inventory checks) */
  sourceListItems: ListMetadataResult[];
  /** Raw listMetadata items from Org B (kept for dependency inventory checks) */
  targetListItems: ListMetadataResult[];
  /** Components after set-diff and content comparison */
  components: OrgAlignmentComponentItem[];
  counts: OrgAlignmentRunSummaryCounts;
}

export interface OrgAlignmentProgress {
  running: boolean;
  currentType: string | null;
  completedTypes: number;
  totalTypes: number;
  phase: 'idle' | 'describing' | 'processing' | 'complete' | 'canceled';
  detailMessage: string;
}

export type DependencyFindingSeverity = 'missing' | 'differs' | 'external';

export interface OrgAlignmentDependencyFinding {
  key: string;
  /** The selected component that depends on the referenced component */
  sourceComponentKey: string;
  sourceComponentType: string;
  sourceComponentName: string;
  /** The referenced component that may be needed in the destination org */
  referencedType: string;
  referencedName: string;
  referencedNamespace?: string | null;
  severity: DependencyFindingSeverity;
  source: 'tooling-api' | 'structural';
  message: string;
  /** If the missing dependency exists in the comparison results on the deploy source org, its key so user can add it in one click */
  addableComponentKey?: string;
}

export interface OrgAlignmentExportContext {
  sourceOrg: SalesforceOrgUi;
  targetOrg: SalesforceOrgUi;
  generatedAt: Date;
  normalizePermissionXml: boolean;
  includeManaged: boolean;
  typeResults: OrgAlignmentTypeResult[];
}
