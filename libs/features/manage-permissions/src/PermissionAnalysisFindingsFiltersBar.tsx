import { css } from '@emotion/react';
import classNames from 'classnames';
import { Icon, Popover, ToolbarItemGroup, type PopoverRef } from '@jetstream/ui';
import { FunctionComponent, ReactNode, useRef } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { type IssueScopeFilterContext, usePermissionAnalysisIssuesFilters } from './permission-analysis-issues-filters';
import { getFindingCodeDisplayParts, type PermissionAnalysisFinding, type PermissionExportRow } from './permission-export-result-view';

/** Keeps `<legend>` from sitting inline with the first radio (fieldset default layout). */
const filterPanelLegendCss = css`
  display: block;
  width: 100%;
  float: none;
  padding: 0;
  margin-bottom: 0.375rem;
`;

const filterPanelHelpTextCss = css`
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

/**
 * Toolbar-styled control: neutral SLDS button opens the same popover chrome as DataTable {@link HeaderFilter}
 * (Filter header, Reset footer, filterList icon highlights when active).
 */
function ToolbarFilterButton({
  label,
  filterActive,
  onReset,
  showResetFooter = true,
  popoverHeaderTitle = 'Filter',
  triggerIcon = 'filterList',
  children,
}: {
  label: string;
  filterActive: boolean;
  /** Required when `showResetFooter` is true (default). */
  onReset?: () => void;
  showResetFooter?: boolean;
  /** Popover header (filter panels use "Filter"; stats-only panels use a specific title). */
  popoverHeaderTitle?: string;
  triggerIcon?: 'filterList' | 'feed';
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
            <h2 className="slds-text-heading_small">{popoverHeaderTitle}</h2>
          </header>
        }
        footer={
          showResetFooter ? (
            <footer className="slds-popover__footer">
              <button
                type="button"
                className="slds-button slds-button_neutral slds-m-top_x-small"
                onClick={() => {
                  onReset?.();
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
          icon={triggerIcon}
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
  issueScopeFilterContext?: IssueScopeFilterContext;
}

/**
 * Global finding filters (URL-backed) as toolbar buttons; popover body matches DataTable filter panels.
 */
export const PermissionAnalysisFindingsFiltersBar: FunctionComponent<PermissionAnalysisFindingsFiltersBarProps> = ({
  findings,
  permissionSetAssignments,
  searchParams,
  setSearchParams,
  issueScopeFilterContext,
}) => {
  const {
    severityFilter,
    olsFlsFilter,
    directAssignmentFilter,
    scopeFilter,
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
    issueScopeFilterContext,
  });

  const exportScopeFilterActive = issueScopeFilterContext?.supportsExportScopeFilter === true && scopeFilter !== 'all';

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
        {issueScopeFilterContext?.supportsExportScopeFilter ? (
          <ToolbarFilterButton
            label="Export Scope"
            filterActive={exportScopeFilterActive}
            onReset={() => {
              updateParams({ issueScope: null });
            }}
          >
            <fieldset className="slds-form-element">
              <legend css={filterPanelLegendCss} className="slds-form-element__legend slds-text-title_caps">
                Export Scope
              </legend>
              <p css={filterPanelHelpTextCss} className="slds-text-body_small slds-text-color_weak">
                Narrow findings to permission containers that were selected as profiles or as permission sets for this export job.
              </p>
              <div className="slds-form-element__control">
                {(['all', 'profiles', 'permissionSets'] as const).map((value) => (
                  <div key={value} className="slds-radio">
                    <input
                      type="radio"
                      id={`toolbar-issue-scope-${value}`}
                      name="toolbarIssueScope"
                      value={value}
                      checked={scopeFilter === value}
                      onChange={() => updateParams({ issueScope: value === 'all' ? null : value })}
                    />
                    <label className="slds-radio__label" htmlFor={`toolbar-issue-scope-${value}`}>
                      <span className="slds-radio_faux" />
                      <span className="slds-form-element__label">
                        {value === 'all' ? 'All' : value === 'profiles' ? 'Profiles only' : 'Permission sets only'}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>
          </ToolbarFilterButton>
        ) : null}

        <ToolbarFilterButton
          label="Direct Assignments"
          filterActive={directAssignmentFilter !== 'all'}
          onReset={() => updateParams({ issueDirectAssign: null })}
        >
          <p css={filterPanelHelpTextCss} className="slds-text-body_small">
            Filter findings to permission sets that have—or lack—a direct assignment to a Salesforce User.
          </p>
          <fieldset className="slds-form-element">
            <legend css={filterPanelLegendCss} className="slds-form-element__legend slds-text-title_caps">
              Include
            </legend>
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
            <legend css={filterPanelLegendCss} className="slds-form-element__legend slds-text-title_caps">
              Finding severity
            </legend>
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
            <legend css={filterPanelLegendCss} className="slds-form-element__legend slds-text-title_caps">
              Finding security layer
            </legend>
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

        <ToolbarFilterButton
          label="Issue Codes"
          filterActive={!!issueCodeFilter}
          showResetFooter={false}
          popoverHeaderTitle="Issue Codes"
          triggerIcon="feed"
        >
          <p css={filterPanelHelpTextCss} className="slds-text-body_small slds-text-color_weak">
            Counts for the current toolbar filters ({filteredFindings.length} finding{filteredFindings.length === 1 ? '' : 's'}). Filter by
            issue using the Issue column on the Issues grid.
          </p>
          <div
            role="list"
            css={css`
              max-height: min(50vh, 320px);
              overflow-y: auto;
              overflow-x: hidden;
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
              padding-right: 0.125rem;
            `}
          >
            {issueCodeRows.length === 0 ? (
              <p className="slds-text-body_small slds-text-color_weak">No Issue Codes match the current filters.</p>
            ) : (
              issueCodeRows.map((row) => (
                <div
                  key={row.code}
                  role="listitem"
                  className="slds-box slds-theme_default"
                  css={css`
                    padding: 0.5rem 0.625rem;
                  `}
                >
                  <div
                    css={css`
                      display: flex;
                      flex-wrap: wrap;
                      align-items: flex-start;
                      justify-content: space-between;
                      gap: 0.5rem 0.75rem;
                    `}
                  >
                    <div
                      css={css`
                        flex: 1 1 10rem;
                        min-width: 0;
                        overflow-wrap: anywhere;
                        word-break: break-word;
                        white-space: normal;
                        line-height: 1.35;
                      `}
                    >
                      <FindingCodeInline code={row.code === '(no code)' ? undefined : row.code} />
                    </div>
                    <span
                      className="slds-badge"
                      css={css`
                        flex-shrink: 0;
                        align-self: flex-start;
                      `}
                      title="Finding count"
                    >
                      {row.count}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ToolbarFilterButton>
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
            · Issue Codes filter active{' '}
            <button type="button" className="slds-button slds-button_link" onClick={() => setIssueCodeFilter(null)}>
              Clear
            </button>
          </>
        ) : null}
      </div>
    </>
  );
};
