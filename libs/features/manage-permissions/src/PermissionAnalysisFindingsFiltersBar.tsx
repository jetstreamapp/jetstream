import { css } from '@emotion/react';
import classNames from 'classnames';
import { Icon, Popover, type PopoverRef } from '@jetstream/ui';
import { FunctionComponent, useRef } from 'react';
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

/** Vertical spacing between filter sections inside the combined popover. */
const filterSectionCss = css`
  & + & {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--slds-g-color-border-base-1, #e5e5e5);
  }
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

export interface PermissionAnalysisFindingsFiltersBarProps {
  /** Unfiltered findings (total count for toolbar stats). */
  findings: PermissionAnalysisFinding[];
  /** Single hook result from {@link usePermissionAnalysisIssuesFilters} in the parent view. */
  issuesFilters: UsePermissionAnalysisIssuesFiltersResult;
}

/**
 * Global issue filters (URL-backed) consolidated into a single popover; popover body matches DataTable filter panels.
 */
export const PermissionAnalysisFindingsFiltersBar: FunctionComponent<PermissionAnalysisFindingsFiltersBarProps> = ({
  findings,
  issuesFilters,
}) => {
  const popoverRef = useRef<PopoverRef | null>(null);
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

  const supportsExportScopeFilter = issueScopeFilterContext?.supportsExportScopeFilter === true;
  const activeFilterCount =
    (severityFilter !== 'all' ? 1 : 0) +
    (olsFlsFilter !== 'all' ? 1 : 0) +
    (directAssignmentFilter !== 'all' ? 1 : 0) +
    (supportsExportScopeFilter && scopeFilter !== 'all' ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const resetAllFilters = () => {
    updateParams({
      issueSeverity: null,
      issueOlsFls: null,
      issueDirectAssign: null,
      issueScope: null,
    });
  };

  return (
    <div css={findingsFiltersBarRootCss}>
      <div className="slds-builder-toolbar__item-group" css={findingsFiltersToolbarClusterCss}>
        <div
          onClick={(ev) => ev.stopPropagation()}
          onPointerDown={(ev) => ev.stopPropagation()}
          onKeyDown={(ev) => ev.stopPropagation()}
        >
          <Popover
            ref={popoverRef}
            header={
              <header className="slds-popover__header" onPointerDown={(ev) => ev.stopPropagation()}>
                <h2 className="slds-text-heading_small">Filters</h2>
              </header>
            }
            footer={
              <footer className="slds-popover__footer">
                <button
                  type="button"
                  className="slds-button slds-button_neutral slds-m-top_x-small"
                  onClick={() => {
                    resetAllFilters();
                    popoverRef.current?.close();
                  }}
                  disabled={!hasActiveFilters}
                >
                  Reset all
                </button>
              </footer>
            }
            content={
              <div onPointerDown={(ev) => ev.stopPropagation()}>
                <div className="slds-p-around_small">
                  {supportsExportScopeFilter && (
                    <fieldset className="slds-form-element" css={filterSectionCss}>
                      <legend css={filterPanelLegendCss} className="slds-form-element__legend slds-text-title_caps">
                        Export scope
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
                  )}

                  <fieldset className="slds-form-element" css={filterSectionCss}>
                    <legend css={filterPanelLegendCss} className="slds-form-element__legend slds-text-title_caps">
                      Direct assignments
                    </legend>
                    <p css={filterPanelHelpTextCss} className="slds-text-body_small slds-text-color_weak">
                      Filter issues to permission sets that have—or lack—a direct assignment to a Salesforce User.
                    </p>
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

                  <fieldset className="slds-form-element" css={filterSectionCss}>
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

                  <fieldset className="slds-form-element" css={filterSectionCss}>
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
                </div>
              </div>
            }
            buttonProps={{
              className: 'slds-button slds-button_neutral',
              onClick: (ev) => ev.stopPropagation(),
              'aria-label': 'Filters',
              title: 'Filters',
            }}
          >
            <Icon
              type="utility"
              icon="filterList"
              className={classNames('slds-button__icon slds-button__icon_left', {
                'slds-text-color_brand': hasActiveFilters,
              })}
              omitContainer
            />
            <span className="slds-truncate">Filters{hasActiveFilters ? ` (${activeFilterCount})` : ''}</span>
          </Popover>
        </div>

        <div className="slds-text-body_small" css={findingsFiltersStatsCss}>
          Errors: {errorFiltered} / {errorTotal} · Warnings: {warningFiltered} / {warningTotal} · Showing {filteredFindings.length} of{' '}
          {findings.length} issues
        </div>
      </div>
    </div>
  );
};
