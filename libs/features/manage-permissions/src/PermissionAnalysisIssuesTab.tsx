import { css } from '@emotion/react';
import { PermissionExportFindingCode } from '@jetstream/shared/constants';
import type { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  DataTable,
  Grid,
  Icon,
  Modal,
  Popover,
  RowWithKey,
  ScopedNotification,
  setColumnFromType,
} from '@jetstream/ui';
import { FunctionComponent, useCallback, useMemo, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import {
  aggregatePermissionAnalysisFindings,
  type PermissionAnalysisFinding,
  type PermissionExportRow,
  getFindingCodeDisplayParts,
  getFindingContainerId,
  getPermissionSetIdsWithDirectUserAssignment,
} from './permission-export-result-view';

export type IssuesSeverityFilter = 'all' | 'errors' | 'warnings';
export type IssuesOlsFlsFilter = 'all' | 'ols' | 'fls';
export type IssuesDirectAssignmentFilter = 'all' | 'assigned' | 'unassigned';
export type IssuesGroupBy = 'none' | 'severity' | 'object' | 'code' | 'container';

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

function isErrorSeverity(value: string | undefined): boolean {
  const normalized = normalizeSeverity(value);
  return normalized === 'error' || normalized === 'errors';
}

function isWarningSeverity(value: string | undefined): boolean {
  const normalized = normalizeSeverity(value);
  return normalized === 'warning' || normalized === 'warnings';
}

function findingCodeKind(code: string | undefined): 'ols' | 'fls' | 'other' {
  const upper = (code ?? '').toUpperCase();
  if (upper.startsWith('OLS')) {
    return 'ols';
  }
  if (upper.startsWith('FLS')) {
    return 'fls';
  }
  return 'other';
}

function readParam(searchParams: URLSearchParams, key: string, fallback: string): string {
  const value = searchParams.get(key);
  return value && value.length > 0 ? value : fallback;
}

function mergeSearchParams(searchParams: URLSearchParams, updates: Record<string, string | null | undefined>): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next;
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
                const { title, technicalCode } = getFindingCodeDisplayParts(normalized);
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
  const [issueCodesOpen, setIssueCodesOpen] = useState(false);
  const [issueCodeTableFilter, setIssueCodeTableFilter] = useState<string | null>(null);

  const severityFilter = readParam(searchParams, 'issueSeverity', 'all') as IssuesSeverityFilter;
  const olsFlsFilter = readParam(searchParams, 'issueOlsFls', 'all') as IssuesOlsFlsFilter;
  const directAssignmentFilter = readParam(searchParams, 'issueDirectAssign', 'all') as IssuesDirectAssignmentFilter;
  const groupBy = readParam(searchParams, 'cfGroup', 'none') as IssuesGroupBy;

  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      setSearchParams(mergeSearchParams(searchParams, updates), { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const permissionSetsWithUsers = useMemo(
    () => getPermissionSetIdsWithDirectUserAssignment(permissionSetAssignments),
    [permissionSetAssignments],
  );
  const hasAssignmentData = permissionSetAssignments.length > 0;

  const filteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      if (severityFilter === 'errors' && !isErrorSeverity(finding.severity as string | undefined)) {
        return false;
      }
      if (severityFilter === 'warnings' && !isWarningSeverity(finding.severity as string | undefined)) {
        return false;
      }
      if (olsFlsFilter === 'ols' && findingCodeKind(finding.code as string | undefined) !== 'ols') {
        return false;
      }
      if (olsFlsFilter === 'fls' && findingCodeKind(finding.code as string | undefined) !== 'fls') {
        return false;
      }
      if (directAssignmentFilter !== 'all' && hasAssignmentData) {
        const containerId = getFindingContainerId(finding);
        if (!containerId) {
          return false;
        }
        const assigned = permissionSetsWithUsers.has(containerId);
        if (directAssignmentFilter === 'assigned' && !assigned) {
          return false;
        }
        if (directAssignmentFilter === 'unassigned' && assigned) {
          return false;
        }
      }
      if (issueCodeTableFilter && String(finding.code ?? '') !== issueCodeTableFilter) {
        return false;
      }
      return true;
    });
  }, [findings, severityFilter, olsFlsFilter, directAssignmentFilter, hasAssignmentData, permissionSetsWithUsers, issueCodeTableFilter]);

  const sortedFindings = useMemo(() => sortFindings(filteredFindings, groupBy), [filteredFindings, groupBy]);

  const errorTotal = useMemo(() => findings.filter((f) => isErrorSeverity(f.severity as string | undefined)).length, [findings]);
  const warningTotal = useMemo(() => findings.filter((f) => isWarningSeverity(f.severity as string | undefined)).length, [findings]);
  const errorFiltered = useMemo(
    () => filteredFindings.filter((f) => isErrorSeverity(f.severity as string | undefined)).length,
    [filteredFindings],
  );
  const warningFiltered = useMemo(
    () => filteredFindings.filter((f) => isWarningSeverity(f.severity as string | undefined)).length,
    [filteredFindings],
  );

  const aggregation = useMemo(() => aggregatePermissionAnalysisFindings(filteredFindings), [filteredFindings]);

  const issueCodeRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filteredFindings) {
      const code = String(row.code ?? '');
      const key = code.length > 0 ? code : '(no code)';
      if (key === PermissionExportFindingCode.FINDINGS_TRUNCATED) {
        continue;
      }
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  }, [filteredFindings]);

  const rowsMap = useMemo(() => new WeakMap(sortedFindings.map((row, index) => [row, `finding-${index}`])), [sortedFindings]);
  const getRowKey = useCallback((row: PermissionAnalysisFinding) => rowsMap.get(row) ?? 'finding', [rowsMap]);

  if (!findings.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">
          No findings for this job yet. Run a permission export analysis to evaluate object vs field read access; results include an
          aggregated summary, filters, and Issue Codes.
        </ScopedNotification>
      </div>
    );
  }

  const topCodeRollups = aggregation.byCode.slice(0, 12);
  const topObjectRollups = aggregation.byObject.slice(0, 12);

  return (
    <div className="slds-grid slds-grid_vertical">
      <div className="slds-box slds-theme_default slds-m-around_small slds-p-around_small">
        <h2 className="slds-text-heading_small slds-m-bottom_x-small">Aggregated findings</h2>
        <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_small">
          Rollups for the current filter set ({filteredFindings.length} row{filteredFindings.length === 1 ? '' : 's'}). Use filters below to
          refocus the grid and these totals.
        </p>
        <div className="slds-grid slds-wrap slds-gutters_small">
          <div className="slds-col slds-size_1-of-1 slds-large-size_1-of-2">
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
                    <tr key={row.code}>
                      <td data-label="Issue">
                        <FindingCodeInline code={row.code} />
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
          <div className="slds-col slds-size_1-of-1 slds-large-size_1-of-2">
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
                    <tr key={row.objectApiName}>
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
        className="slds-p-around_small slds-border_bottom slds-border_color-border"
        css={css`
          background: var(--slds-g-color-neutral-base-95, #f3f3f3);
        `}
      >
        <Grid align="spread" verticalAlign="center" wrap>
          <Grid verticalAlign="center" wrap className="slds-gutters_x-small">
            <Popover
              placement="bottom-start"
              header="Column / Scope"
              content={
                <div className="slds-p-around_small slds-text-body_small">
                  Matrix row and container toggles ship with the object-level matrix (Phase C). This control is reserved for that layout.
                </div>
              }
            >
              <button type="button" className="slds-button slds-button_neutral slds-m-right_xx-small">
                Column / Scope
                <Icon type="utility" icon="down" className="slds-button__icon slds-button__icon_right" omitContainer />
              </button>
            </Popover>

            <Popover
              placement="bottom-start"
              header="Direct User Assignments"
              content={
                <div className="slds-p-around_small">
                  <p className="slds-text-body_small slds-m-bottom_small">
                    Filter findings to permission sets that have—or lack—a direct assignment to a Salesforce User.
                  </p>
                  <fieldset className="slds-form-element">
                    <legend className="slds-form-element__legend slds-text-title_caps">Include</legend>
                    <div className="slds-form-element__control">
                      {(['all', 'assigned', 'unassigned'] as const).map((value) => (
                        <div key={value} className="slds-radio">
                          <input
                            type="radio"
                            id={`issue-direct-${value}`}
                            name="issueDirectAssign"
                            value={value}
                            checked={directAssignmentFilter === value}
                            disabled={!hasAssignmentData}
                            onChange={() => updateParams({ issueDirectAssign: value === 'all' ? null : value })}
                          />
                          <label className="slds-radio__label" htmlFor={`issue-direct-${value}`}>
                            <span className="slds-radio_faux" />
                            <span className="slds-form-element__label">
                              {value === 'all'
                                ? 'All'
                                : value === 'assigned'
                                  ? 'With direct user assignment'
                                  : 'Without direct user assignment'}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                    {!hasAssignmentData && (
                      <p className="slds-text-color_weak slds-m-top_x-small slds-text-body_small">
                        No assignment rows in this export; run a new export after upgrading Jetstream.
                      </p>
                    )}
                  </fieldset>
                </div>
              }
            >
              <button
                type="button"
                className="slds-button slds-button_neutral slds-m-right_xx-small"
                disabled={!hasAssignmentData}
                title={!hasAssignmentData ? 'Requires permission set assignment data from export' : undefined}
              >
                Direct User Assignments
                <Icon type="utility" icon="down" className="slds-button__icon slds-button__icon_right" omitContainer />
              </button>
            </Popover>

            <Popover
              placement="bottom-start"
              header="Finding Severity"
              content={
                <div className="slds-p-around_small">
                  <fieldset className="slds-form-element">
                    <legend className="slds-form-element__legend slds-text-title_caps">Include</legend>
                    {(['all', 'errors', 'warnings'] as const).map((value) => (
                      <div key={value} className="slds-radio">
                        <input
                          type="radio"
                          id={`issue-sev-${value}`}
                          name="issueSeverity"
                          value={value}
                          checked={severityFilter === value}
                          onChange={() => updateParams({ issueSeverity: value === 'all' ? null : value })}
                        />
                        <label className="slds-radio__label" htmlFor={`issue-sev-${value}`}>
                          <span className="slds-radio_faux" />
                          <span className="slds-form-element__label">
                            {value === 'all' ? 'All' : value === 'errors' ? 'Errors only' : 'Warnings only'}
                          </span>
                        </label>
                      </div>
                    ))}
                  </fieldset>
                </div>
              }
            >
              <button type="button" className="slds-button slds-button_neutral slds-m-right_xx-small">
                Finding Severity
                <Icon type="utility" icon="down" className="slds-button__icon slds-button__icon_right" omitContainer />
              </button>
            </Popover>

            <Popover
              placement="bottom-start"
              header="OLS / FLS"
              content={
                <div className="slds-p-around_small">
                  <fieldset className="slds-form-element">
                    <legend className="slds-form-element__legend slds-text-title_caps">Finding security layer</legend>
                    {(['all', 'ols', 'fls'] as const).map((value) => (
                      <div key={value} className="slds-radio">
                        <input
                          type="radio"
                          id={`issue-ols-${value}`}
                          name="issueOlsFls"
                          value={value}
                          checked={olsFlsFilter === value}
                          onChange={() => updateParams({ issueOlsFls: value === 'all' ? null : value })}
                        />
                        <label className="slds-radio__label" htmlFor={`issue-ols-${value}`}>
                          <span className="slds-radio_faux" />
                          <span className="slds-form-element__label">
                            {value === 'all' ? 'All' : value === 'ols' ? 'Object-level (OLS) codes' : 'Field-level (FLS) codes'}
                          </span>
                        </label>
                      </div>
                    ))}
                  </fieldset>
                </div>
              }
            >
              <button type="button" className="slds-button slds-button_neutral slds-m-right_xx-small">
                OLS / FLS
                <Icon type="utility" icon="down" className="slds-button__icon slds-button__icon_right" omitContainer />
              </button>
            </Popover>

            <Popover
              placement="bottom-start"
              header="Group By"
              content={
                <div className="slds-p-around_small">
                  <fieldset className="slds-form-element">
                    <legend className="slds-form-element__legend slds-text-title_caps">Findings group by</legend>
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
                          id={`issue-group-${value}`}
                          name="cfGroup"
                          value={value}
                          checked={groupBy === value}
                          onChange={() => updateParams({ cfGroup: value === 'none' ? null : value })}
                        />
                        <label className="slds-radio__label" htmlFor={`issue-group-${value}`}>
                          <span className="slds-radio_faux" />
                          <span className="slds-form-element__label">{label}</span>
                        </label>
                      </div>
                    ))}
                  </fieldset>
                </div>
              }
            >
              <button type="button" className="slds-button slds-button_neutral slds-m-right_xx-small">
                Group By
                <Icon type="utility" icon="down" className="slds-button__icon slds-button__icon_right" omitContainer />
              </button>
            </Popover>

            <button type="button" className="slds-button slds-button_neutral" onClick={() => setIssueCodesOpen(true)}>
              <Icon type="utility" icon="filterList" className="slds-button__icon slds-button__icon_left" omitContainer />
              Issue Codes
            </button>
          </Grid>
        </Grid>
        <div className="slds-m-top_x-small slds-text-body_small">
          Errors: {errorFiltered} / {errorTotal} · Warnings: {warningFiltered} / {warningTotal} · Showing {filteredFindings.length} of{' '}
          {findings.length} findings
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

      {issueCodesOpen && (
        <Modal
          testId="permission-analysis-issue-codes"
          size="lg"
          header="Issue Codes"
          tagline="Click a row to filter the findings table to that issue."
          closeOnBackdropClick
          directionalFooter
          footer={
            <Grid align="end">
              <button type="button" className="slds-button slds-button_neutral" onClick={() => setIssueCodesOpen(false)}>
                Close
              </button>
            </Grid>
          }
          onClose={() => setIssueCodesOpen(false)}
        >
          <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_small">
            Counts for the current Issues filters ({filteredFindings.length} row{filteredFindings.length === 1 ? '' : 's'}).
          </p>
          <table className="slds-table slds-table_cell-buffer slds-table_bordered">
            <thead>
              <tr className="slds-line-height_reset">
                <th scope="col">Issue</th>
                <th scope="col">Count</th>
              </tr>
            </thead>
            <tbody>
              {issueCodeRows.map((row) => (
                <tr
                  key={row.code}
                  className="slds-hint-parent"
                  css={css`
                    cursor: pointer;
                  `}
                  onClick={() => {
                    const nextFilter = row.code === '(no code)' ? null : row.code;
                    setIssueCodeTableFilter((current) => (current === nextFilter ? null : nextFilter));
                    setIssueCodesOpen(false);
                  }}
                >
                  <td>
                    <FindingCodeInline code={row.code === '(no code)' ? undefined : row.code} />
                  </td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {issueCodeTableFilter && (
            <p className="slds-m-top_small slds-text-body_small">
              Table filtered to <FindingCodeInline code={issueCodeTableFilter} />.{' '}
              <button type="button" className="slds-button slds-button_link" onClick={() => setIssueCodeTableFilter(null)}>
                Clear issue filter
              </button>
            </p>
          )}
        </Modal>
      )}
    </div>
  );
};
