import { css } from '@emotion/react';
import type { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  DataTable,
  Popover,
  RowWithKey,
  ScopedNotification,
  setColumnFromType,
} from '@jetstream/ui';
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
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
  type PermissionAnalysisFinding,
  type PermissionExportRow,
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
}

function normalizeSeverity(value: string | undefined): string {
  return (value ?? '').toLowerCase();
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
    name: key === 'code' ? 'Issue' : key,
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
}) => {
  const [aggregatedDetailsModal, setAggregatedDetailsModal] = useState<{
    findings: PermissionAnalysisFinding[];
    title: string;
    tagline: string;
    summaryLine: string;
  } | null>(null);

  const [gridFilteredFindings, setGridFilteredFindings] = useState<PermissionAnalysisFinding[] | null>(null);

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

  const handleSortedAndFilteredRowsChange = useCallback((rows: readonly PermissionAnalysisFinding[]) => {
    setGridFilteredFindings([...rows]);
  }, []);

  if (!findings.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">
          No findings for this job yet. Run a permission export analysis to evaluate object vs field read access; results include an
          aggregated summary, toolbar filters (same style as data table filters), column filters on the grid, and Columns / Group By
          controls above the grid when findings exist.
        </ScopedNotification>
      </div>
    );
  }

  const topCodeRollups = aggregation.byCode.slice(0, 12);
  const topObjectRollups = aggregation.byObject.slice(0, 12);

  return (
    <div className="slds-grid slds-grid_vertical">
      <div className="slds-box slds-theme_default slds-m-around_small slds-p-around_small">
        <h2 className="slds-text-heading_small slds-m-bottom_x-small">Aggregated Findings</h2>
        <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_small">
          Rollups for the rows visible in the grid ({rollupFindings.length} row{rollupFindings.length === 1 ? '' : 's'}). Use the toolbar
          filters first, then column header filter icons on the grid for finer control; use Columns and Group By above the grid to choose
          visible columns and sort grouping. Click a row in either rollup table to open full messages and metadata for those findings.
        </p>
        <div
          css={css`
            display: grid;
            grid-template-columns: 1fr;
            gap: 1.5rem;
            align-items: start;

            @media (min-width: 64rem) {
              grid-template-columns: 1fr 1fr;
            }
          `}
        >
          <div>
            <h3 className="slds-text-title_caps slds-m-bottom_x-small">By issue code</h3>
            {topCodeRollups.length === 0 ? (
              <p className="slds-text-body_small slds-text-color_weak">No codes in the current filter.</p>
            ) : (
              <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-max-medium-table_stacked">
                <thead>
                  <tr className="slds-line-height_reset">
                    <th scope="col">Issue</th>
                    <th scope="col">Count</th>
                    <th scope="col">Errors</th>
                    <th scope="col">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {topCodeRollups.map((row) => (
                    <tr
                      key={row.code}
                      className="slds-hint-parent"
                      css={css`
                        cursor: pointer;
                      `}
                      title="View finding details"
                      onClick={() => openAggregatedDetailsForCode(row.code)}
                    >
                      <td data-label="Issue">
                        <FindingCodeInline code={row.code === '(no code)' ? undefined : row.code} />
                      </td>
                      <td data-label="Count">{row.count}</td>
                      <td data-label="Errors">{row.errorCount}</td>
                      <td data-label="Warnings">{row.warningCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {aggregation.byCode.length > topCodeRollups.length && (
              <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
                Showing top {topCodeRollups.length} of {aggregation.byCode.length} codes.
              </p>
            )}
          </div>
          <div>
            <h3 className="slds-text-title_caps slds-m-bottom_x-small">By object</h3>
            {topObjectRollups.length === 0 ? (
              <p className="slds-text-body_small slds-text-color_weak">No objects in the current filter.</p>
            ) : (
              <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-max-medium-table_stacked">
                <thead>
                  <tr className="slds-line-height_reset">
                    <th scope="col">Object</th>
                    <th scope="col">Count</th>
                    <th scope="col">Errors</th>
                    <th scope="col">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {topObjectRollups.map((row) => (
                    <tr
                      key={row.objectApiName}
                      className="slds-hint-parent"
                      css={css`
                        cursor: pointer;
                      `}
                      title="View finding details"
                      onClick={() => openAggregatedDetailsForObject(row.objectApiName)}
                    >
                      <td data-label="Object">{row.objectApiName}</td>
                      <td data-label="Count">{row.count}</td>
                      <td data-label="Errors">{row.errorCount}</td>
                      <td data-label="Warnings">{row.warningCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {aggregation.byObject.length > topObjectRollups.length && (
              <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
                Showing top {topObjectRollups.length} of {aggregation.byObject.length} objects.
              </p>
            )}
          </div>
        </div>
      </div>

      <div
        className="slds-p-horizontal_small slds-p-vertical_x-small slds-border_bottom slds-border_color-border"
        css={css`
          display: flex;
          justify-content: flex-end;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
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
                <button type="button" className="slds-button slds-button_neutral" onClick={() => updateParams({ issueHiddenCols: null })}>
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

      <AutoFullHeightContainer
        fillHeight
        bottomBuffer={32}
        baseCss={css`
          min-height: 240px;
        `}
      >
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
      </AutoFullHeightContainer>

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
