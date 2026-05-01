import { css } from '@emotion/react';
import classNames from 'classnames';
import { Grid, Icon, Modal, Popover, ToolbarItemGroup, type PopoverRef } from '@jetstream/ui';
import { FunctionComponent, ReactNode, useRef, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { usePermissionAnalysisIssuesFilters } from './permission-analysis-issues-filters';
import { getFindingCodeDisplayParts, type PermissionAnalysisFinding, type PermissionExportRow } from './permission-export-result-view';

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

/**
 * Toolbar-styled control: neutral SLDS button opens the same popover chrome as DataTable {@link HeaderFilter}
 * (Filter header, Reset footer, filterList icon highlights when active).
 */
function ToolbarFilterButton({
  label,
  filterActive,
  onReset,
  showResetFooter = true,
  children,
}: {
  label: string;
  filterActive: boolean;
  onReset: () => void;
  showResetFooter?: boolean;
  children: ReactNode;
}) {
  const popoverRef = useRef<PopoverRef | null>(null);

  return (
    <div
      onClick={(ev) => {
        ev.stopPropagation();
      }}
      onPointerDown={(ev) => ev.stopPropagation()}
      onKeyDown={(ev) => ev.stopPropagation()}
    >
      <Popover
        ref={popoverRef}
        header={
          <header className="slds-popover__header" onPointerDown={(ev) => ev.stopPropagation()}>
            <h2 className="slds-text-heading_small">Filter</h2>
          </header>
        }
        footer={
          showResetFooter ? (
            <footer className="slds-popover__footer">
              <button
                type="button"
                className="slds-button slds-button_neutral slds-m-top_x-small"
                onClick={() => {
                  onReset();
                  popoverRef.current?.close();
                }}
              >
                Reset
              </button>
            </footer>
          ) : undefined
        }
        content={
          <div onPointerDown={(ev) => ev.stopPropagation()}>
            <div className="slds-p-around_small">{children}</div>
          </div>
        }
        buttonProps={{
          className: 'slds-button slds-button_neutral',
          onClick: (ev) => ev.stopPropagation(),
          'aria-label': label,
          title: label,
        }}
      >
        <Icon
          type="utility"
          icon="filterList"
          className={classNames('slds-button__icon slds-button__icon_left', {
            'slds-text-color_brand': filterActive,
          })}
          omitContainer
        />
        <span className="slds-truncate">{label}</span>
      </Popover>
    </div>
  );
}

export interface PermissionAnalysisFindingsFiltersBarProps {
  findings: PermissionAnalysisFinding[];
  permissionSetAssignments: PermissionExportRow[];
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}

/**
 * Global finding filters (URL-backed) as toolbar buttons; popover body matches DataTable filter panels.
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
      <ToolbarItemGroup
        css={css`
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
        `}
      >
        <ToolbarFilterButton label="Column / Scope" filterActive={false} showResetFooter={false} onReset={() => {}}>
          <p className="slds-text-body_small">
            Matrix row and container toggles ship with the object-level matrix (Phase C). This control is reserved for that layout.
          </p>
        </ToolbarFilterButton>

        <ToolbarFilterButton
          label="Direct assignments"
          filterActive={directAssignmentFilter !== 'all'}
          onReset={() => updateParams({ issueDirectAssign: null })}
        >
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
                      {value === 'all' ? 'All' : value === 'assigned' ? 'With direct user assignment' : 'Without direct user assignment'}
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
        </ToolbarFilterButton>

        <ToolbarFilterButton label="Severity" filterActive={severityFilter !== 'all'} onReset={() => updateParams({ issueSeverity: null })}>
          <fieldset className="slds-form-element">
            <legend className="slds-form-element__legend slds-text-title_caps">Finding severity</legend>
            <div className="slds-form-element__control">
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
            </div>
          </fieldset>
        </ToolbarFilterButton>

        <ToolbarFilterButton label="OLS / FLS" filterActive={olsFlsFilter !== 'all'} onReset={() => updateParams({ issueOlsFls: null })}>
          <fieldset className="slds-form-element">
            <legend className="slds-form-element__legend slds-text-title_caps">Finding security layer</legend>
            <div className="slds-form-element__control">
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
            </div>
          </fieldset>
        </ToolbarFilterButton>

        <div onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => ev.stopPropagation()} onKeyDown={(ev) => ev.stopPropagation()}>
          <button
            type="button"
            className="slds-button slds-button_neutral"
            aria-label="Issue Codes"
            title="Issue Codes"
            onClick={() => setIssueCodesOpen(true)}
          >
            <Icon
              type="utility"
              icon="feed"
              className={classNames('slds-button__icon slds-button__icon_left', {
                'slds-text-color_brand': !!issueCodeFilter,
              })}
              omitContainer
            />
            <span className="slds-truncate">Issue Codes</span>
          </button>
        </div>
      </ToolbarItemGroup>
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
