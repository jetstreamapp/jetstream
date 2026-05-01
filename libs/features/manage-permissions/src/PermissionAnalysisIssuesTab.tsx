import { css } from '@emotion/react';
import type { SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable, RowWithKey, ScopedNotification, setColumnFromType } from '@jetstream/ui';
import { FunctionComponent, useCallback, useMemo, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { PermissionAnalysisFindingsModal } from './PermissionAnalysisFindingsModal';
import {
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

export type {
  IssuesSeverityFilter,
  IssuesOlsFlsFilter,
  IssuesDirectAssignmentFilter,
  IssuesGroupBy,
} from './permission-analysis-issues-filters';

export interface PermissionAnalysisIssuesTabProps {
  findings: PermissionAnalysisFinding[];
  permissionSetAssignments: PermissionExportRow[];
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}

function normalizeSeverity(value: string | undefined): string {
  return (value ?? '').toLowerCase();
}

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

function buildFindingColumns(): ColumnWithFilter<RowWithKey>[] {
  const keys = ['severity', 'code', 'objectApiName', 'fieldApiName', 'message', 'permissionSetId', 'parentId', 'containerId'] as const;
  return keys.map((key) => {
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
    return {
      ...base,
      name: key === 'code' ? 'Issue' : key,
      key,
      field: key,
      resizable: true,
      ...(key === 'severity' ? { cellClass: severityCellClass } : {}),
      formatter:
        key === 'message'
          ? ({ row }: { row: PermissionAnalysisFinding }) => (
              <span
                css={css`
                  white-space: pre-wrap;
                `}
              >
                {String(row.message ?? '')}
              </span>
            )
          : key === 'code'
            ? ({ row }: { row: PermissionAnalysisFinding }) => {
                const rawCode = row.code;
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
            : base.renderCell,
    } as ColumnWithFilter<RowWithKey>;
  });
}

const FINDING_COLUMNS = buildFindingColumns();

export const PermissionAnalysisIssuesTab: FunctionComponent<PermissionAnalysisIssuesTabProps> = ({
  findings,
  permissionSetAssignments,
  org,
  serverUrl,
  skipFrontdoorLogin,
  defaultApiVersion,
  searchParams,
  setSearchParams,
}) => {
  const [aggregatedDetailsModal, setAggregatedDetailsModal] = useState<{
    findings: PermissionAnalysisFinding[];
    title: string;
    tagline: string;
    summaryLine: string;
  } | null>(null);

  const { filteredFindings, groupBy } = usePermissionAnalysisIssuesFilters({
    findings,
    permissionSetAssignments,
    searchParams,
    setSearchParams,
  });

  const sortedFindings = useMemo(() => sortFindings(filteredFindings, groupBy), [filteredFindings, groupBy]);

  const aggregation = useMemo(() => aggregatePermissionAnalysisFindings(filteredFindings), [filteredFindings]);

  const openAggregatedDetailsForCode = useCallback(
    (codeKey: string) => {
      const matches = filteredFindings.filter((finding) => {
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
        tagline: 'Issue details for the current Issues filters.',
        summaryLine: `${matches.length} finding${matches.length === 1 ? '' : 's'} for this issue code.`,
      });
    },
    [filteredFindings, groupBy],
  );

  const openAggregatedDetailsForObject = useCallback(
    (objectKey: string) => {
      const matches = filteredFindings.filter((finding) => {
        const objectRaw = String(finding.objectApiName ?? '').trim();
        const key = objectRaw.length > 0 ? objectRaw : '(no object)';
        return key === objectKey;
      });
      const title = objectKey === '(no object)' ? 'Findings without object' : `Findings: ${objectKey}`;
      setAggregatedDetailsModal({
        findings: sortFindings(matches, groupBy),
        title,
        tagline: 'Issue details for the current Issues filters.',
        summaryLine: `${matches.length} finding${matches.length === 1 ? '' : 's'} for this object.`,
      });
    },
    [filteredFindings, groupBy],
  );

  const rowsMap = useMemo(() => new WeakMap(sortedFindings.map((row, index) => [row, `finding-${index}`])), [sortedFindings]);
  const getRowKey = useCallback((row: PermissionAnalysisFinding) => rowsMap.get(row) ?? 'finding', [rowsMap]);

  if (!findings.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">
          No findings for this job yet. Run a permission export analysis to evaluate object vs field read access; results include an
          aggregated summary, toolbar filters, and Issue Codes.
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
          Rollups for the current filter set ({filteredFindings.length} row{filteredFindings.length === 1 ? '' : 's'}). Use the toolbar
          filters to refocus the grid and these totals. Click a row in either table to open full messages and metadata for those findings.
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
          columns={FINDING_COLUMNS}
          data={sortedFindings}
          getRowKey={getRowKey}
          includeQuickFilter
          context={{ defaultApiVersion }}
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
