import { css } from '@emotion/react';
import classNames from 'classnames';
import { Icon, Popover, type PopoverRef } from '@jetstream/ui';
import { FunctionComponent, ReactNode, useRef } from 'react';
import { type UsePermissionAnalysisIssuesFiltersResult } from './permission-analysis-issues-filters';
import { type PermissionAnalysisFinding } from './permission-export-result-view';

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

/**
 * Inline-size container for this toolbar strip so nested `@container` rules track the middle column width,
 * not the viewport.
 */
const findingsFiltersBarRootCss = css`
  width: 100%;
  min-width: 0;
`;

/**
 * Single horizontal row with the main toolbar (back | filters | history). Parent may scroll on very narrow widths.
 */
const findingsFiltersToolbarClusterCss = css`
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.35rem 0.5rem;
  width: max-content;
  max-width: none;
`;

/** Do not flex-shrink (avoids a ~0px box that breaks every word onto its own line). */
const findingsFiltersStatsCss = css`
  flex: 0 0 auto;
  text-align: left;
  white-space: nowrap;
`;

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
  /** Unfiltered findings (total count for toolbar stats). */
  findings: PermissionAnalysisFinding[];
  /** Single hook result from {@link usePermissionAnalysisIssuesFilters} in the parent view. */
  issuesFilters: UsePermissionAnalysisIssuesFiltersResult;
}

/**
 * Global issue filters (URL-backed) as toolbar buttons; popover body matches DataTable filter panels.
 */
export const PermissionAnalysisFindingsFiltersBar: FunctionComponent<PermissionAnalysisFindingsFiltersBarProps> = ({
  findings,
  issuesFilters,
}) => {
  const {
    severityFilter,
    olsFlsFilter,
    directAssignmentFilter,
    scopeFilter,
    issueScopeFilterContext,
    hasAssignmentData,
    filteredFindings,
    errorTotal,
    warningTotal,
    errorFiltered,
    warningFiltered,
    updateParams,
  } = issuesFilters;

  const exportScopeFilterActive = issueScopeFilterContext?.supportsExportScopeFilter === true && scopeFilter !== 'all';

  return (
    <div css={findingsFiltersBarRootCss}>
      <div className="slds-builder-toolbar__item-group" css={findingsFiltersToolbarClusterCss}>
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
                Narrow issues to permission containers that were selected as profiles or as permission sets for this export job.
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
            Filter issues to permission sets that have—or lack—a direct assignment to a Salesforce User.
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
              Issue severity
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
              Issue security layer
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

        <div className="slds-text-body_small" css={findingsFiltersStatsCss}>
          Errors: {errorFiltered} / {errorTotal} · Warnings: {warningFiltered} / {warningTotal} · Showing {filteredFindings.length} of{' '}
          {findings.length} issues
        </div>
      </div>
    </div>
  );
};
