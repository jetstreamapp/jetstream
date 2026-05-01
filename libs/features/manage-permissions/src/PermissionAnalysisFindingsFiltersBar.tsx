import { css } from '@emotion/react';
import { Grid, Icon, Modal, Popover } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { getFindingCodeDisplayParts, type PermissionAnalysisFinding, type PermissionExportRow } from './permission-export-result-view';
import { usePermissionAnalysisIssuesFilters } from './permission-analysis-issues-filters';

const popoverNeutralTriggerClassName = 'slds-button slds-button_neutral';

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

export interface PermissionAnalysisFindingsFiltersBarProps {
  findings: PermissionAnalysisFinding[];
  permissionSetAssignments: PermissionExportRow[];
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}

/**
 * Global finding filters for the permission analysis workspace (URL-backed).
 * Rendered in the page toolbar so filters apply across tabs.
 */
export const PermissionAnalysisFindingsFiltersBar: FunctionComponent<PermissionAnalysisFindingsFiltersBarProps> = ({
  findings,
  permissionSetAssignments,
  searchParams,
  setSearchParams,
}) => {
  const [issueCodesOpen, setIssueCodesOpen] = useState(false);

  const {
    severityFilter,
    olsFlsFilter,
    directAssignmentFilter,
    hasAssignmentData,
    filteredFindings,
    issueCodeRows,
    errorTotal,
    warningTotal,
    errorFiltered,
    warningFiltered,
    issueCodeFilter,
    updateParams,
    setIssueCodeFilter,
  } = usePermissionAnalysisIssuesFilters({
    findings,
    permissionSetAssignments,
    searchParams,
    setSearchParams,
  });

  return (
    <>
      <div
        css={css`
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.25rem 0.5rem;
        `}
      >
        <Popover
          placement="bottom-start"
          header="Column / Scope"
          buttonProps={{ className: popoverNeutralTriggerClassName }}
          content={
            <div className="slds-p-around_small slds-text-body_small">
              Matrix row and container toggles ship with the object-level matrix (Phase C). This control is reserved for that layout.
            </div>
          }
        >
          Column / Scope
          <Icon type="utility" icon="down" className="slds-button__icon slds-button__icon_right" omitContainer />
        </Popover>

        <Popover
          placement="bottom-start"
          header="Direct User Assignments"
          buttonProps={{
            className: popoverNeutralTriggerClassName,
            disabled: !hasAssignmentData,
            title: !hasAssignmentData ? 'Requires permission set assignment data from export' : undefined,
          }}
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
                        id={`toolbar-issue-direct-${value}`}
                        name="toolbarIssueDirectAssign"
                        value={value}
                        checked={directAssignmentFilter === value}
                        disabled={!hasAssignmentData}
                        onChange={() => updateParams({ issueDirectAssign: value === 'all' ? null : value })}
                      />
                      <label className="slds-radio__label" htmlFor={`toolbar-issue-direct-${value}`}>
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
          Direct User Assignments
          <Icon type="utility" icon="down" className="slds-button__icon slds-button__icon_right" omitContainer />
        </Popover>

        <Popover
          placement="bottom-start"
          header="Finding Severity"
          buttonProps={{ className: popoverNeutralTriggerClassName }}
          content={
            <div className="slds-p-around_small">
              <fieldset className="slds-form-element">
                <legend className="slds-form-element__legend slds-text-title_caps">Include</legend>
                {(['all', 'errors', 'warnings'] as const).map((value) => (
                  <div key={value} className="slds-radio">
                    <input
                      type="radio"
                      id={`toolbar-issue-sev-${value}`}
                      name="toolbarIssueSeverity"
                      value={value}
                      checked={severityFilter === value}
                      onChange={() => updateParams({ issueSeverity: value === 'all' ? null : value })}
                    />
                    <label className="slds-radio__label" htmlFor={`toolbar-issue-sev-${value}`}>
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
          Finding Severity
          <Icon type="utility" icon="down" className="slds-button__icon slds-button__icon_right" omitContainer />
        </Popover>

        <Popover
          placement="bottom-start"
          header="OLS / FLS"
          buttonProps={{ className: popoverNeutralTriggerClassName }}
          content={
            <div className="slds-p-around_small">
              <fieldset className="slds-form-element">
                <legend className="slds-form-element__legend slds-text-title_caps">Finding security layer</legend>
                {(['all', 'ols', 'fls'] as const).map((value) => (
                  <div key={value} className="slds-radio">
                    <input
                      type="radio"
                      id={`toolbar-issue-ols-${value}`}
                      name="toolbarIssueOlsFls"
                      value={value}
                      checked={olsFlsFilter === value}
                      onChange={() => updateParams({ issueOlsFls: value === 'all' ? null : value })}
                    />
                    <label className="slds-radio__label" htmlFor={`toolbar-issue-ols-${value}`}>
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
          OLS / FLS
          <Icon type="utility" icon="down" className="slds-button__icon slds-button__icon_right" omitContainer />
        </Popover>

        <button type="button" className="slds-button slds-button_neutral" onClick={() => setIssueCodesOpen(true)}>
          <Icon type="utility" icon="feed" className="slds-button__icon slds-button__icon_left" omitContainer />
          Issue Codes
        </button>
      </div>
      <div
        className="slds-m-top_xx-small slds-text-body_small"
        css={css`
          text-align: center;
        `}
      >
        Errors: {errorFiltered} / {errorTotal} · Warnings: {warningFiltered} / {warningTotal} · Showing {filteredFindings.length} of{' '}
        {findings.length} findings
        {issueCodeFilter ? (
          <>
            {' '}
            · Issue code filter active{' '}
            <button type="button" className="slds-button slds-button_link" onClick={() => setIssueCodeFilter(null)}>
              Clear
            </button>
          </>
        ) : null}
      </div>

      {issueCodesOpen && (
        <Modal
          testId="permission-analysis-issue-codes"
          size="lg"
          header="Issue Codes"
          tagline="Click a row to filter findings to that issue."
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
            Counts for the current finding filters ({filteredFindings.length} row{filteredFindings.length === 1 ? '' : 's'}).
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
                    const toggled = nextFilter != null && issueCodeFilter === nextFilter ? null : nextFilter;
                    setIssueCodeFilter(toggled);
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
          {issueCodeFilter && (
            <p className="slds-m-top_small slds-text-body_small">
              Filtered to <FindingCodeInline code={issueCodeFilter} />.{' '}
              <button type="button" className="slds-button slds-button_link" onClick={() => setIssueCodeFilter(null)}>
                Clear issue filter
              </button>
            </p>
          )}
        </Modal>
      )}
    </>
  );
};
