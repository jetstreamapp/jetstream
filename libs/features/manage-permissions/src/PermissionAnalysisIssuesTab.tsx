import { css } from '@emotion/react';
import type { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Card,
  ColumnWithFilter,
  DataTable,
  DataTree,
  Icon,
  Popover,
  RowWithKey,
  ScopedNotification,
  setColumnFromType,
} from '@jetstream/ui';
import { FunctionComponent, useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { RenderCellProps } from 'react-data-grid';
import type { SetURLSearchParams } from 'react-router-dom';
import { PermissionAnalysisFindingsModal } from './PermissionAnalysisFindingsModal';
import {
  ISSUES_GRID_COLUMN_KEYS,
  ISSUES_GRID_COLUMN_LABELS,
  type IssueScopeFilterContext,
  type IssuesGridColumnKey,
  type IssuesGroupBy,
  isErrorSeverity,
  isWarningSeverity,
  usePermissionAnalysisIssuesFilters,
} from './permission-analysis-issues-filters';
import {
  aggregatePermissionAnalysisFindings,
  formatObjectLabelForModalSummary,
  type PermissionAnalysisFinding,
  type PermissionExportRow,
  type PermissionFindingCodeRollup,
  type PermissionFindingObjectRollup,
  type SobjectExportDetail,
  getFindingCodeDisplayParts,
  getFindingContainerId,
} from './permission-export-result-view';

export type { IssuesGroupBy } from './permission-analysis-issues-filters';

export interface PermissionAnalysisIssuesTabProps {
  findings: PermissionAnalysisFinding[];
  permissionSetAssignments: PermissionExportRow[];
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  issueScopeFilterContext?: IssueScopeFilterContext;
  /** Describe labels for object API names; when absent, rollup titles fall back to API names. */
  sobjectExportDetails?: Record<string, SobjectExportDetail>;
}

function normalizeSeverity(value: string | undefined): string {
  return (value ?? '').toLowerCase();
}

function groupIssueFindingsByColumnKey(
  rows: readonly PermissionAnalysisFinding[],
  columnKey: string,
): Record<string, PermissionAnalysisFinding[]> {
  const groups: Record<string, PermissionAnalysisFinding[]> = {};
  for (const row of rows) {
    let key: string;
    switch (columnKey) {
      case 'severity': {
        const normalized = normalizeSeverity(row.severity as string | undefined);
        key = normalized.length > 0 ? normalized : '(none)';
        break;
      }
      case 'objectApiName': {
        const raw = String(row.objectApiName ?? '').trim();
        key = raw.length > 0 ? raw : '(no object)';
        break;
      }
      case 'code': {
        const raw = String(row.code ?? '').trim();
        key = raw.length > 0 ? raw : '(no code)';
        break;
      }
      case 'containerId': {
        const id = getFindingContainerId(row);
        key = id && id.length > 0 ? id : '(none)';
        break;
      }
      default: {
        const raw = row[columnKey as keyof PermissionAnalysisFinding];
        key = raw != null && String(raw).trim().length > 0 ? String(raw) : '(none)';
      }
    }
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(row);
  }
  return groups;
}

const issuesTabFilterLegendCss = css`
  display: block;
  width: 100%;
  float: none;
  padding: 0;
  margin-bottom: 0.375rem;
`;

const issuesTabFilterHelpCss = css`
  display: block;
  width: 100%;
  margin-bottom: 0.5rem;
`;

const issuesTabVerticalRootCss = css`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const issuesWorkspaceCss = css`
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: row;
  align-items: stretch;
`;

const issuesAggregatedRailCss = css`
  flex-shrink: 0;
  width: 2.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0.25rem;
  border-right: 1px solid var(--slds-g-color-border-base-1, #c9c9c9);
  background: var(--slds-g-color-neutral-base-95, #f3f3f3);
`;

const issuesAggregatedRailToggleCss = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--slds-g-color-neutral-base-30, #444);
  padding: 0.375rem 0.125rem;
  border-radius: 0.25rem;
  width: 100%;

  .slds-icon {
    width: 1.25rem;
    height: 1.25rem;
    fill: currentColor;
  }

  &:hover,
  &:focus {
    background: var(--slds-g-color-neutral-base-90, #e5e5e5);
    outline: none;
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--slds-g-color-brand-base-50, #0176d3);
  }
`;

const issuesAggregatedRailLabelCss = css`
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
  line-height: 1.2;
`;

const issuesAggregatedRailCountCss = css`
  margin-top: 0.5rem;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--slds-g-color-neutral-base-30, #444);
  writing-mode: vertical-rl;
  transform: rotate(180deg);
`;

const issuesMainPaneCss = css`
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
`;

const issuesAggregatedBackdropCss = css`
  position: absolute;
  inset: 0;
  z-index: 350;
  border: none;
  padding: 0;
  margin: 0;
  background: rgba(8, 7, 7, 0.28);
  cursor: pointer;
`;

const issuesAggregatedFlyoutCss = css`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: min(28rem, calc(100% - 1rem));
  max-width: calc(100vw - 4rem);
  z-index: 400;
  display: flex;
  flex-direction: column;
  background: var(--slds-g-color-neutral-base-100, #fff);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.14);
  border-right: 1px solid var(--slds-g-color-border-base-1, #c9c9c9);
  overflow: hidden;
`;

const issuesAggregatedFlyoutHeaderCss = css`
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.75rem 0.5rem;
  border-bottom: 1px solid var(--slds-g-color-border-base-1, #e5e5e5);
`;

const issuesAggregatedFlyoutBodyCss = css`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem;
`;

const issuesGridSectionCss = css`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const aggregatedFlyoutSectionsCss = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const aggregatedNestedRollupsListCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
`;

const aggregatedRollupRowInteractiveCss = css`
  cursor: pointer;
  border-radius: 0.25rem;

  &:focus {
    outline: none;
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--slds-g-color-brand-base-50, #0176d3);
    outline: none;
  }

  &:hover article.slds-card {
    background: var(--slds-g-color-neutral-base-95, #f3f3f3);
  }
`;

const aggregatedRollupMetricsFooterCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  width: 100%;
`;

const aggregatedObjectRollupCardTitleCss = css`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.125rem;
  min-width: 0;
  width: 100%;
`;

const aggregatedRollupDrillInChevronCss = css`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: var(--slds-g-color-neutral-base-50, #706e6b);

  svg {
    width: 0.875rem;
    height: 0.875rem;
    fill: currentColor;
  }
`;

const aggregatedSectionToggleButtonCss = css`
  && {
    color: var(--slds-g-color-neutral-base-30, #444444);
  }

  && svg {
    fill: currentColor;
  }
`;

const aggregatedSectionToggleChevronSvgCss = (expanded: boolean) => css`
  width: 0.875rem;
  height: 0.875rem;
  fill: currentColor;
  transform: rotate(${expanded ? '90deg' : '0deg'});
  transition: transform 0.15s ease;
`;

const FindingCodeInline: FunctionComponent<{ code: string | undefined }> = ({ code }) => {
  const { title, technicalCode } = getFindingCodeDisplayParts(code);
  return (
    <span>
      {title}
      {technicalCode ? (
        <span className="slds-text-color_weak">
          {' '}
          (<code>{technicalCode}</code>)
        </span>
      ) : null}
    </span>
  );
};

function aggregatedRollupRowKeyDown(onOpen: () => void) {
  return (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };
}

const AggregatedIssueCodeRollupCard: FunctionComponent<{
  row: PermissionFindingCodeRollup;
  onOpen: () => void;
}> = ({ row, onOpen }) => {
  const subtitle =
    row.label.trim().length > 0 && row.label.trim() !== row.code ? (
      <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_none">{row.label}</p>
    ) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      css={aggregatedRollupRowInteractiveCss}
      title="View finding details"
      onClick={onOpen}
      onKeyDown={aggregatedRollupRowKeyDown(onOpen)}
    >
      <Card
        nestedBorder
        title={<FindingCodeInline code={row.code === '(no code)' ? undefined : row.code} />}
        actions={
          <span css={aggregatedRollupDrillInChevronCss} className="slds-icon-text-default" aria-hidden="true">
            <Icon
              type="utility"
              icon="chevronright"
              omitContainer
              className="slds-icon"
              svgCss={css`
                fill: currentColor;
              `}
            />
          </span>
        }
        footer={
          <div css={aggregatedRollupMetricsFooterCss}>
            <span>
              <span className="slds-text-heading_medium">{row.count}</span>
              <span className="slds-text-body_small slds-text-color_weak slds-m-left_xx-small">finding{row.count === 1 ? '' : 's'}</span>
            </span>
            <span className="slds-text-body_small">
              <span className="slds-text-color_error">{row.errorCount} errors</span>
              <span className="slds-text-color_weak"> · </span>
              <span className="slds-text-color_weak">{row.warningCount} warnings</span>
            </span>
          </div>
        }
      >
        {subtitle}
      </Card>
    </div>
  );
};

const AggregatedObjectRollupCardTitle: FunctionComponent<{
  objectApiName: string;
  sobjectExportDetails: Record<string, SobjectExportDetail> | undefined;
}> = ({ objectApiName, sobjectExportDetails }) => {
  if (objectApiName === '(no object)') {
    return <span className="slds-truncate">No object</span>;
  }

  const { displayLabel, showApiInParens } = formatObjectLabelForModalSummary(objectApiName, sobjectExportDetails);

  return (
    <div css={aggregatedObjectRollupCardTitleCss}>
      <span className="slds-truncate" title={displayLabel}>
        {displayLabel}
      </span>
      {showApiInParens ? (
        <span className="slds-text-body_small slds-text-color_weak slds-truncate" title={objectApiName}>
          <code>{objectApiName}</code>
        </span>
      ) : null}
    </div>
  );
};

const AggregatedObjectRollupCard: FunctionComponent<{
  row: PermissionFindingObjectRollup;
  sobjectExportDetails: Record<string, SobjectExportDetail> | undefined;
  onOpen: () => void;
}> = ({ row, sobjectExportDetails, onOpen }) => {
  const hint =
    row.objectApiName === '(no object)' ? (
      <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_none">These findings are not tied to a specific object.</p>
    ) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      css={aggregatedRollupRowInteractiveCss}
      title="View finding details"
      onClick={onOpen}
      onKeyDown={aggregatedRollupRowKeyDown(onOpen)}
    >
      <Card
        nestedBorder
        title={<AggregatedObjectRollupCardTitle objectApiName={row.objectApiName} sobjectExportDetails={sobjectExportDetails} />}
        actions={
          <span css={aggregatedRollupDrillInChevronCss} className="slds-icon-text-default" aria-hidden="true">
            <Icon
              type="utility"
              icon="chevronright"
              omitContainer
              className="slds-icon"
              svgCss={css`
                fill: currentColor;
              `}
            />
          </span>
        }
        footer={
          <div css={aggregatedRollupMetricsFooterCss}>
            <span>
              <span className="slds-text-heading_medium">{row.count}</span>
              <span className="slds-text-body_small slds-text-color_weak slds-m-left_xx-small">finding{row.count === 1 ? '' : 's'}</span>
            </span>
            <span className="slds-text-body_small">
              <span className="slds-text-color_error">{row.errorCount} errors</span>
              <span className="slds-text-color_weak"> · </span>
              <span className="slds-text-color_weak">{row.warningCount} warnings</span>
            </span>
          </div>
        }
      >
        {hint}
      </Card>
    </div>
  );
};

/**
 * Maps Issues "Group By" to the grid column key used by {@link TreeDataGrid} `groupBy` / `rowGrouper`.
 * Container grouping uses {@link getFindingContainerId} in the grouper (not only `containerId` on the row).
 */
function issuesGroupByToTreeColumnKey(groupBy: IssuesGroupBy): IssuesGridColumnKey | null {
  switch (groupBy) {
    case 'none':
      return null;
    case 'severity':
      return 'severity';
    case 'object':
      return 'objectApiName';
    case 'code':
      return 'code';
    case 'container':
      return 'containerId';
    default:
      return null;
  }
}

function sortFindings(rows: PermissionAnalysisFinding[], groupBy: IssuesGroupBy): PermissionAnalysisFinding[] {
  const copy = [...rows];
  const getter = (row: PermissionAnalysisFinding): string => {
    switch (groupBy) {
      case 'severity':
        return normalizeSeverity(row.severity as string | undefined);
      case 'object':
        return String(row.objectApiName ?? '');
      case 'code':
        return String(row.code ?? '');
      case 'container':
        return getFindingContainerId(row) ?? '';
      default:
        return '';
    }
  };
  copy.sort((a, b) => getter(a).localeCompare(getter(b)) || String(a.message ?? '').localeCompare(String(b.message ?? '')));
  return copy;
}

type StandardFindingColumnKey =
  | 'severity'
  | 'code'
  | 'objectApiName'
  | 'fieldApiName'
  | 'message'
  | 'permissionSetId'
  | 'parentId'
  | 'containerId';

function mapStandardFindingColumn(key: StandardFindingColumnKey): ColumnWithFilter<RowWithKey> {
  const fieldType = key.endsWith('Id') ? 'salesforceId' : 'text';
  const base = setColumnFromType(key, fieldType);
  const severityCellClass = (row: RowWithKey) => {
    const finding = row as PermissionAnalysisFinding;
    const severityValue = finding.severity as string | undefined;
    if (isWarningSeverity(severityValue) && !isErrorSeverity(severityValue)) {
      return 'permission-finding-severity-cell--warning';
    }
    return undefined;
  };
  const renderCell =
    key === 'message'
      ? ({ row }: RenderCellProps<RowWithKey, unknown>) => (
          <span
            css={css`
              white-space: pre-wrap;
            `}
          >
            {String((row as PermissionAnalysisFinding).message ?? '')}
          </span>
        )
      : key === 'code'
        ? ({ row }: RenderCellProps<RowWithKey, unknown>) => {
            const finding = row as PermissionAnalysisFinding;
            const rawCode = finding.code;
            const normalized = typeof rawCode === 'string' ? rawCode : undefined;
            const { title: codeTitle, technicalCode } = getFindingCodeDisplayParts(normalized);
            return (
              <span>
                {codeTitle}
                {technicalCode ? (
                  <span className="slds-text-color_weak">
                    {' '}
                    (<code>{technicalCode}</code>)
                  </span>
                ) : null}
              </span>
            );
          }
        : base.renderCell;

  return {
    ...base,
    name: ISSUES_GRID_COLUMN_LABELS[key],
    key,
    field: key,
    resizable: true,
    ...(key === 'severity' ? { cellClass: severityCellClass } : {}),
    renderCell,
  } as ColumnWithFilter<RowWithKey>;
}

function buildFindingColumns(): ColumnWithFilter<RowWithKey>[] {
  const keys: StandardFindingColumnKey[] = [
    'severity',
    'code',
    'objectApiName',
    'fieldApiName',
    'message',
    'permissionSetId',
    'parentId',
    'containerId',
  ];
  return keys.map(mapStandardFindingColumn);
}

const FINDING_COLUMNS = buildFindingColumns();

const issuesTabGroupByTriggerClassName = 'slds-button slds-button_neutral';

interface IssuesFindingTreeDataGridProps {
  sortedFindings: PermissionAnalysisFinding[];
  treeGroupColumnKey: IssuesGridColumnKey;
  dataTreeColumns: ColumnWithFilter<RowWithKey>[];
  getRowKey: (row: PermissionAnalysisFinding) => string;
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
  onSortedAndFilteredRowsChange: (rows: readonly PermissionAnalysisFinding[]) => void;
}

/**
 * Mount with a changing `key` from the parent whenever toolbar-filtered rows change so expanded groups
 * reset without a state-sync effect.
 */
const IssuesFindingTreeDataGrid: FunctionComponent<IssuesFindingTreeDataGridProps> = ({
  sortedFindings,
  treeGroupColumnKey,
  dataTreeColumns,
  getRowKey,
  org,
  serverUrl,
  skipFrontdoorLogin,
  defaultApiVersion,
  onSortedAndFilteredRowsChange,
}) => {
  const [expandedGroupIds, setExpandedGroupIds] = useState<ReadonlySet<unknown>>(() => {
    const grouped = groupIssueFindingsByColumnKey(sortedFindings, treeGroupColumnKey);
    return new Set(Object.keys(grouped));
  });

  return (
    <DataTree
      org={org}
      serverUrl={serverUrl}
      skipFrontdoorLogin={skipFrontdoorLogin}
      columns={dataTreeColumns}
      data={sortedFindings}
      getRowKey={getRowKey}
      includeQuickFilter
      context={{ defaultApiVersion }}
      groupBy={[treeGroupColumnKey]}
      rowGrouper={groupIssueFindingsByColumnKey}
      expandedGroupIds={expandedGroupIds}
      onExpandedGroupIdsChange={(nextExpanded) => setExpandedGroupIds(nextExpanded)}
      onSortedAndFilteredRowsChange={onSortedAndFilteredRowsChange}
      rowClass={(row) => {
        const severityValue = (row as PermissionAnalysisFinding).severity as string | undefined;
        if (isErrorSeverity(severityValue)) {
          return 'permission-finding-row--error';
        }
        return undefined;
      }}
    />
  );
};

export const PermissionAnalysisIssuesTab: FunctionComponent<PermissionAnalysisIssuesTabProps> = ({
  findings,
  permissionSetAssignments,
  org,
  serverUrl,
  skipFrontdoorLogin,
  defaultApiVersion,
  searchParams,
  setSearchParams,
  issueScopeFilterContext,
  sobjectExportDetails,
}) => {
  const [aggregatedDetailsModal, setAggregatedDetailsModal] = useState<{
    findings: PermissionAnalysisFinding[];
    title: string;
    tagline: string;
    summaryLine: string;
  } | null>(null);

  const [gridFilteredFindings, setGridFilteredFindings] = useState<PermissionAnalysisFinding[] | null>(null);
  const [aggregatedSidePanelOpen, setAggregatedSidePanelOpen] = useState(false);
  const [aggregatedIssueCodeSectionExpanded, setAggregatedIssueCodeSectionExpanded] = useState(true);
  const [aggregatedByObjectSectionExpanded, setAggregatedByObjectSectionExpanded] = useState(true);

  const { filteredFindings, groupBy, updateParams, hiddenIssueGridColumns } = usePermissionAnalysisIssuesFilters({
    findings,
    permissionSetAssignments,
    searchParams,
    setSearchParams,
    issueScopeFilterContext,
  });

  const gridColumns = useMemo(() => {
    const filtered = FINDING_COLUMNS.filter((col) => !hiddenIssueGridColumns.has(col.key as IssuesGridColumnKey));
    return filtered.length > 0 ? filtered : FINDING_COLUMNS;
  }, [hiddenIssueGridColumns]);

  const treeGroupColumnKey = issuesGroupByToTreeColumnKey(groupBy);

  const dataTreeColumns = useMemo(() => {
    if (!treeGroupColumnKey) {
      return gridColumns;
    }
    const hasGroupCol = gridColumns.some((col) => col.key === treeGroupColumnKey);
    const groupColumnDef = FINDING_COLUMNS.find((col) => col.key === treeGroupColumnKey);
    if (!groupColumnDef) {
      return gridColumns;
    }
    if (hasGroupCol) {
      return gridColumns;
    }
    return [groupColumnDef, ...gridColumns];
  }, [gridColumns, treeGroupColumnKey]);

  const setIssueColumnHidden = useCallback(
    (columnKey: IssuesGridColumnKey, hide: boolean) => {
      const nextHidden = new Set(hiddenIssueGridColumns);
      if (hide) {
        if (ISSUES_GRID_COLUMN_KEYS.length - nextHidden.size <= 1) {
          return;
        }
        nextHidden.add(columnKey);
      } else {
        nextHidden.delete(columnKey);
      }
      updateParams({ issueHiddenCols: nextHidden.size === 0 ? null : [...nextHidden].sort().join(',') });
    },
    [hiddenIssueGridColumns, updateParams],
  );

  const sortedFindings = useMemo(() => sortFindings(filteredFindings, groupBy), [filteredFindings, groupBy]);

  useEffect(() => {
    setGridFilteredFindings(null);
  }, [sortedFindings]);

  const rollupFindings = gridFilteredFindings ?? sortedFindings;

  const aggregation = useMemo(() => aggregatePermissionAnalysisFindings(rollupFindings), [rollupFindings]);

  const openAggregatedDetailsForCode = useCallback(
    (codeKey: string) => {
      const matches = rollupFindings.filter((finding) => {
        const codeRaw = String(finding.code ?? '').trim();
        const key = codeRaw.length > 0 ? codeRaw : '(no code)';
        return key === codeKey;
      });
      const displayCode = codeKey === '(no code)' ? undefined : codeKey;
      const { title: issueTitle } = getFindingCodeDisplayParts(displayCode);
      const title =
        codeKey === '(no code)'
          ? 'Findings without issue code'
          : issueTitle.trim().length > 0
            ? `Findings: ${issueTitle}`
            : `Findings: ${codeKey}`;
      setAggregatedDetailsModal({
        findings: sortFindings(matches, groupBy),
        title,
        tagline: 'Issue details for the current filters.',
        summaryLine: `${matches.length} finding${matches.length === 1 ? '' : 's'} for this issue code.`,
      });
    },
    [rollupFindings, groupBy],
  );

  const openAggregatedDetailsForObject = useCallback(
    (objectKey: string) => {
      const matches = rollupFindings.filter((finding) => {
        const objectRaw = String(finding.objectApiName ?? '').trim();
        const key = objectRaw.length > 0 ? objectRaw : '(no object)';
        return key === objectKey;
      });
      const title = objectKey === '(no object)' ? 'Findings without object' : `Findings: ${objectKey}`;
      setAggregatedDetailsModal({
        findings: sortFindings(matches, groupBy),
        title,
        tagline: 'Issue details for the current filters.',
        summaryLine: `${matches.length} finding${matches.length === 1 ? '' : 's'} for this object.`,
      });
    },
    [rollupFindings, groupBy],
  );

  const rowsMap = useMemo(() => new WeakMap(sortedFindings.map((row, index) => [row, `finding-${index}`])), [sortedFindings]);
  const getRowKey = useCallback((row: PermissionAnalysisFinding) => rowsMap.get(row) ?? 'finding', [rowsMap]);

  const issueTreeMountKey = useMemo(() => sortedFindings.map(getRowKey).join('\u001f'), [sortedFindings, getRowKey]);

  const handleSortedAndFilteredRowsChange = useCallback((rows: readonly PermissionAnalysisFinding[]) => {
    setGridFilteredFindings([...rows]);
  }, []);

  useEffect(() => {
    if (!aggregatedSidePanelOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAggregatedSidePanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aggregatedSidePanelOpen]);

  if (!findings.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">
          No findings for this job yet. Run a permission export analysis to evaluate object vs field read access; results include an
          aggregated summary (opened from the left rail when findings exist), toolbar filters (same style as data table filters), column
          filters on the grid, and Columns / Group By controls above the grid when findings exist.
        </ScopedNotification>
      </div>
    );
  }

  const topCodeRollups = aggregation.byCode.slice(0, 12);
  const topObjectRollups = aggregation.byObject.slice(0, 12);

  const aggregatedFlyoutBody = (
    <>
      <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_medium">
        Summary for the rows currently visible in the grid ({rollupFindings.length} row{rollupFindings.length === 1 ? '' : 's'}). Refine
        results with toolbar filters and grid header filters; use Columns and Group By for layout and tree grouping. Select a card below to
        open full finding messages and metadata.
      </p>
      <div css={aggregatedFlyoutSectionsCss}>
        <Card
          title="By Issue Code"
          icon={{ type: 'standard', icon: 'picklist_choice', title: 'By Issue Code' }}
          nestedBorder
          className="slds-m-bottom_none"
          actions={
            <button
              type="button"
              className="slds-button slds-button_icon slds-button_icon-border-filled"
              css={aggregatedSectionToggleButtonCss}
              aria-expanded={aggregatedIssueCodeSectionExpanded}
              aria-controls="permission-analysis-aggregated-section-issue-code-body"
              aria-label={aggregatedIssueCodeSectionExpanded ? 'Collapse By Issue Code section' : 'Expand By Issue Code section'}
              title={aggregatedIssueCodeSectionExpanded ? 'Collapse By Issue Code' : 'Expand By Issue Code'}
              onClick={() => setAggregatedIssueCodeSectionExpanded((previous) => !previous)}
            >
              <Icon
                type="utility"
                icon="chevronright"
                omitContainer
                className="slds-button__icon"
                svgCss={aggregatedSectionToggleChevronSvgCss(aggregatedIssueCodeSectionExpanded)}
              />
            </button>
          }
          footer={
            aggregatedIssueCodeSectionExpanded && aggregation.byCode.length > topCodeRollups.length ? (
              <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_none">
                Showing top {topCodeRollups.length} of {aggregation.byCode.length} codes.
              </p>
            ) : undefined
          }
        >
          <div id="permission-analysis-aggregated-section-issue-code-body" hidden={!aggregatedIssueCodeSectionExpanded}>
            {topCodeRollups.length === 0 ? (
              <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_none">No codes in the current filter.</p>
            ) : (
              <div css={aggregatedNestedRollupsListCss}>
                {topCodeRollups.map((row) => (
                  <AggregatedIssueCodeRollupCard key={row.code} row={row} onOpen={() => openAggregatedDetailsForCode(row.code)} />
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card
          title="By Object"
          icon={{ type: 'standard', icon: 'entity', title: 'By Object' }}
          nestedBorder
          className="slds-m-bottom_none"
          actions={
            <button
              type="button"
              className="slds-button slds-button_icon slds-button_icon-border-filled"
              css={aggregatedSectionToggleButtonCss}
              aria-expanded={aggregatedByObjectSectionExpanded}
              aria-controls="permission-analysis-aggregated-section-object-body"
              aria-label={aggregatedByObjectSectionExpanded ? 'Collapse By Object section' : 'Expand By Object section'}
              title={aggregatedByObjectSectionExpanded ? 'Collapse By Object' : 'Expand By Object'}
              onClick={() => setAggregatedByObjectSectionExpanded((previous) => !previous)}
            >
              <Icon
                type="utility"
                icon="chevronright"
                omitContainer
                className="slds-button__icon"
                svgCss={aggregatedSectionToggleChevronSvgCss(aggregatedByObjectSectionExpanded)}
              />
            </button>
          }
          footer={
            aggregatedByObjectSectionExpanded && aggregation.byObject.length > topObjectRollups.length ? (
              <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_none">
                Showing top {topObjectRollups.length} of {aggregation.byObject.length} objects.
              </p>
            ) : undefined
          }
        >
          <div id="permission-analysis-aggregated-section-object-body" hidden={!aggregatedByObjectSectionExpanded}>
            {topObjectRollups.length === 0 ? (
              <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_none">No objects in the current filter.</p>
            ) : (
              <div css={aggregatedNestedRollupsListCss}>
                {topObjectRollups.map((row) => (
                  <AggregatedObjectRollupCard
                    key={row.objectApiName}
                    row={row}
                    sobjectExportDetails={sobjectExportDetails}
                    onOpen={() => openAggregatedDetailsForObject(row.objectApiName)}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );

  return (
    <div className="slds-grid slds-grid_vertical" css={issuesTabVerticalRootCss}>
      <div css={issuesWorkspaceCss}>
        <div css={issuesAggregatedRailCss}>
          <button
            type="button"
            css={issuesAggregatedRailToggleCss}
            title={aggregatedSidePanelOpen ? 'Collapse Aggregated Findings' : 'Expand Aggregated Findings'}
            aria-expanded={aggregatedSidePanelOpen}
            aria-controls={aggregatedSidePanelOpen ? 'permission-analysis-aggregated-findings-flyout' : undefined}
            onClick={() => setAggregatedSidePanelOpen((open) => !open)}
          >
            <Icon
              type="utility"
              icon={aggregatedSidePanelOpen ? 'arrow_left' : 'arrow_right'}
              omitContainer
              className="slds-icon slds-icon-text-default"
            />
            <span css={issuesAggregatedRailLabelCss}>Aggregated Findings</span>
          </button>
          <span css={issuesAggregatedRailCountCss} aria-hidden="true">
            {rollupFindings.length}
          </span>
        </div>

        <div css={issuesMainPaneCss}>
          {aggregatedSidePanelOpen ? (
            <>
              <button
                type="button"
                css={issuesAggregatedBackdropCss}
                aria-label="Close Aggregated Findings panel"
                onClick={() => setAggregatedSidePanelOpen(false)}
              />
              <aside
                id="permission-analysis-aggregated-findings-flyout"
                css={issuesAggregatedFlyoutCss}
                className="slds-theme_default"
                role="dialog"
                aria-modal="false"
                aria-labelledby="permission-analysis-aggregated-findings-title"
              >
                <div css={issuesAggregatedFlyoutHeaderCss}>
                  <h2 id="permission-analysis-aggregated-findings-title" className="slds-text-heading_small slds-m-bottom_none">
                    Aggregated Findings
                  </h2>
                  <button
                    type="button"
                    className="slds-button slds-button_icon slds-button_icon-border-filled"
                    title="Close panel"
                    aria-label="Close Aggregated Findings panel"
                    onClick={() => setAggregatedSidePanelOpen(false)}
                  >
                    <svg className="slds-button__icon" aria-hidden="true" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M14.3 11.7l6.2-6.2c.4-.4.4-1 0-1.4l-.7-.7c-.4-.4-1-.4-1.4 0L12 9.2 5.8 3.1c-.4-.4-1-.4-1.4 0l-.7.7c-.4.4-.4 1 0 1.4l6.2 6.2-6.2 6.2c-.4.4-.4 1 0 1.4l.7.7c.4.4 1 .4 1.4 0l6.2-6.2 6.2 6.2c.4.4 1 .4 1.4 0l.7-.7c.4-.4.4-1 0-1.4l-6.2-6.2z"
                      />
                    </svg>
                  </button>
                </div>
                <div css={issuesAggregatedFlyoutBodyCss}>{aggregatedFlyoutBody}</div>
              </aside>
            </>
          ) : null}

          <div
            className="slds-p-horizontal_small slds-p-vertical_x-small slds-border_bottom slds-border_color-border"
            css={css`
              display: flex;
              justify-content: flex-end;
              align-items: center;
              flex-wrap: wrap;
              gap: 0.5rem;
              flex-shrink: 0;
            `}
          >
            <Popover
              placement="bottom-end"
              header="Columns"
              buttonProps={{ className: issuesTabGroupByTriggerClassName }}
              content={
                <div className="slds-p-around_small">
                  <fieldset className="slds-form-element">
                    <legend css={issuesTabFilterLegendCss} className="slds-form-element__legend slds-text-title_caps">
                      Visible columns
                    </legend>
                    <p css={issuesTabFilterHelpCss} className="slds-text-body_small slds-text-color_weak">
                      Uncheck to hide a column. At least one column stays visible.
                    </p>
                    <div className="slds-form-element__control">
                      {ISSUES_GRID_COLUMN_KEYS.map((columnKey) => {
                        const visible = !hiddenIssueGridColumns.has(columnKey);
                        const disableUncheck = visible && ISSUES_GRID_COLUMN_KEYS.length - hiddenIssueGridColumns.size <= 1;
                        return (
                          <div key={columnKey} className="slds-checkbox">
                            <input
                              type="checkbox"
                              id={`issues-tab-visible-col-${columnKey}`}
                              checked={visible}
                              disabled={disableUncheck}
                              onChange={(ev) => setIssueColumnHidden(columnKey, !ev.target.checked)}
                            />
                            <label className="slds-checkbox__label" htmlFor={`issues-tab-visible-col-${columnKey}`}>
                              <span className="slds-checkbox_faux" />
                              <span className="slds-form-element__label">{ISSUES_GRID_COLUMN_LABELS[columnKey]}</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div className="slds-m-top_small">
                    <button
                      type="button"
                      className="slds-button slds-button_neutral"
                      onClick={() => updateParams({ issueHiddenCols: null })}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              }
            >
              Columns
            </Popover>
            <Popover
              placement="bottom-end"
              header="Group By"
              buttonProps={{ className: issuesTabGroupByTriggerClassName }}
              content={
                <div className="slds-p-around_small">
                  <fieldset className="slds-form-element">
                    <legend css={issuesTabFilterLegendCss} className="slds-form-element__legend slds-text-title_caps">
                      Findings group by
                    </legend>
                    <div className="slds-form-element__control">
                      {(
                        [
                          ['none', 'None (default sort)'],
                          ['severity', 'Severity'],
                          ['object', 'Object'],
                          ['code', 'Code'],
                          ['container', 'Container'],
                        ] as const
                      ).map(([value, label]) => (
                        <div key={value} className="slds-radio">
                          <input
                            type="radio"
                            id={`issues-tab-cf-group-${value}`}
                            name="issuesTabCfGroup"
                            value={value}
                            checked={groupBy === value}
                            onChange={() => updateParams({ cfGroup: value === 'none' ? null : value })}
                          />
                          <label className="slds-radio__label" htmlFor={`issues-tab-cf-group-${value}`}>
                            <span className="slds-radio_faux" />
                            <span className="slds-form-element__label">{label}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                </div>
              }
            >
              Group By
            </Popover>
          </div>

          {findings.length > 0 && filteredFindings.length === 0 ? (
            <div className="slds-p-horizontal_small slds-p-vertical_x-small">
              <ScopedNotification theme="info">
                No findings match the current toolbar filters. Clear them from the summary line under the toolbar, or change filter
                selections there and in the toolbar popovers.
              </ScopedNotification>
            </div>
          ) : null}

          <div css={issuesGridSectionCss}>
            <AutoFullHeightContainer
              fillHeight
              bottomBuffer={32}
              baseCss={css`
                flex: 1;
                min-height: 0;
              `}
            >
              {groupBy === 'none' || !treeGroupColumnKey ? (
                <DataTable
                  org={org}
                  serverUrl={serverUrl}
                  skipFrontdoorLogin={skipFrontdoorLogin}
                  columns={gridColumns}
                  data={sortedFindings}
                  getRowKey={getRowKey}
                  includeQuickFilter
                  context={{ defaultApiVersion }}
                  onSortedAndFilteredRowsChange={handleSortedAndFilteredRowsChange}
                  rowClass={(row) => {
                    const severityValue = (row as PermissionAnalysisFinding).severity as string | undefined;
                    if (isErrorSeverity(severityValue)) {
                      return 'permission-finding-row--error';
                    }
                    return undefined;
                  }}
                />
              ) : (
                <IssuesFindingTreeDataGrid
                  key={`${groupBy}:${issueTreeMountKey}`}
                  sortedFindings={sortedFindings}
                  treeGroupColumnKey={treeGroupColumnKey}
                  dataTreeColumns={dataTreeColumns}
                  getRowKey={getRowKey}
                  org={org}
                  serverUrl={serverUrl}
                  skipFrontdoorLogin={skipFrontdoorLogin}
                  defaultApiVersion={defaultApiVersion}
                  onSortedAndFilteredRowsChange={handleSortedAndFilteredRowsChange}
                />
              )}
            </AutoFullHeightContainer>
          </div>
        </div>
      </div>

      {aggregatedDetailsModal && (
        <PermissionAnalysisFindingsModal
          testId="permission-analysis-aggregated-findings-details"
          open
          title={aggregatedDetailsModal.title}
          tagline={aggregatedDetailsModal.tagline}
          summaryLine={aggregatedDetailsModal.summaryLine}
          findings={aggregatedDetailsModal.findings}
          onClose={() => setAggregatedDetailsModal(null)}
        />
      )}
    </div>
  );
};
