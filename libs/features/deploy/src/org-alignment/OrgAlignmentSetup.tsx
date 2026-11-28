import { COMMON_METADATA_TYPES } from '@jetstream/connected-ui';
import { SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, Grid, Icon, NotSeeingRecentMetadataPopover, RadioButton, RadioGroup, Tooltip } from '@jetstream/ui';
import { GroupScopedOrgsCombobox, OrgLabelBadge } from '@jetstream/ui-core';
import { Fragment, FunctionComponent } from 'react';
import { OrgAlignmentComparisonOptions } from './orgAlignmentTypes';

const REFRESH_MESSAGES = [
  'Jetstream remembers which components each org has for a while to make comparisons faster.',
  'If metadata was recently added, renamed or deleted, refresh to get the latest from both orgs and compare again.',
];

export interface OrgAlignmentSetupProps {
  /** Collapsed shows the two orgs on one line so the results get the room */
  expanded: boolean;
  sourceOrg: SalesforceOrgUi | null;
  targetOrg: SalesforceOrgUi | null;
  sourceOrgOptions: SalesforceOrgUi[];
  targetOrgOptions: SalesforceOrgUi[];
  options: OrgAlignmentComparisonOptions;
  /** Both orgs are chosen and no comparison is running */
  canCompare: boolean;
  isRunning: boolean;
  hasResults: boolean;
  lastCompletedAt: Date | null;
  onExpandedChange: (expanded: boolean) => void;
  onSourceOrgChange: (org: SalesforceOrgUi) => void;
  onTargetOrgChange: (org: SalesforceOrgUi) => void;
  onSwapOrgs: () => void;
  onOptionsChange: (changes: Partial<OrgAlignmentComparisonOptions>) => void;
  /** Separate from `onOptionsChange` because existing results are compared again when this changes */
  onNormalizePermissionXmlChange: (enabled: boolean) => void;
  /** Compare again without using what Jetstream remembers about either org */
  onRefreshAndCompare: () => void;
  onChooseTypes: () => void;
}

/** The orgs, metadata types and options of a comparison */
export const OrgAlignmentSetup: FunctionComponent<OrgAlignmentSetupProps> = ({
  expanded,
  sourceOrg,
  targetOrg,
  sourceOrgOptions,
  targetOrgOptions,
  options,
  canCompare,
  isRunning,
  hasResults,
  lastCompletedAt,
  onExpandedChange,
  onSourceOrgChange,
  onTargetOrgChange,
  onSwapOrgs,
  onOptionsChange,
  onNormalizePermissionXmlChange,
  onRefreshAndCompare,
  onChooseTypes,
}) => {
  return (
    <Fragment>
      {!expanded && sourceOrg && targetOrg && (
        <Grid align="spread" verticalAlign="center" wrap className="slds-box slds-box_x-small slds-theme_default slds-m-bottom_small">
          <Grid verticalAlign="center" wrap>
            <span className="slds-text-title_caps slds-m-right_x-small">Source</span>
            <OrgLabelBadge org={sourceOrg} />
            <span className="slds-text-title_caps slds-m-left_medium slds-m-right_x-small">Target</span>
            <OrgLabelBadge org={targetOrg} />
            {lastCompletedAt && !isRunning && (
              <span className="slds-m-left_medium slds-text-body_small slds-text-color_weak">
                Compared at {lastCompletedAt.toLocaleTimeString()}
              </span>
            )}
          </Grid>
          <Grid verticalAlign="center">
            <NotSeeingRecentMetadataPopover
              className="slds-m-right_medium"
              header="Missing or outdated metadata?"
              refreshButtonLabel="Refresh and Compare Again"
              viewInSalesforceSetup={undefined}
              messages={REFRESH_MESSAGES}
              disabled={!canCompare}
              onReload={onRefreshAndCompare}
            />
            <button type="button" className="slds-button" disabled={isRunning} onClick={() => onExpandedChange(true)}>
              Change Comparison
              <Icon type="utility" icon="chevrondown" className="slds-button__icon slds-button__icon_right" omitContainer />
            </button>
          </Grid>
        </Grid>
      )}

      {expanded && (
        <div className="slds-box slds-theme_default slds-m-bottom_small">
          <Grid verticalAlign="end" wrap className="slds-gutters_small">
            <div className="slds-col slds-size_1-of-1 slds-medium-size_5-of-12">
              <GroupScopedOrgsCombobox
                label="Source Org"
                hideLabel={false}
                placeholder="Select the source org"
                orgs={sourceOrgOptions}
                selectedOrg={sourceOrg}
                disabled={isRunning}
                minWidth={0}
                onSelected={onSourceOrgChange}
              />
            </div>
            <div className="slds-col slds-grow-none slds-p-bottom_xxx-small">
              <Tooltip id="org-alignment-swap-orgs" content="Swap the source and target orgs">
                <button
                  type="button"
                  className="slds-button slds-button_icon slds-button_icon-border-filled"
                  aria-label="Swap the source and target orgs"
                  disabled={isRunning || (!sourceOrg && !targetOrg)}
                  onClick={onSwapOrgs}
                >
                  <Icon type="utility" icon="rotate" className="slds-button__icon" omitContainer />
                </button>
              </Tooltip>
            </div>
            <div className="slds-col slds-size_1-of-1 slds-medium-size_5-of-12">
              <GroupScopedOrgsCombobox
                label="Target Org"
                hideLabel={false}
                placeholder="Select the target org"
                orgs={targetOrgOptions}
                selectedOrg={targetOrg}
                disabled={isRunning}
                minWidth={0}
                onSelected={onTargetOrgChange}
              />
            </div>
            {hasResults && (
              <div className="slds-col slds-grow-none slds-col_bump-left slds-p-bottom_xxx-small">
                <button type="button" className="slds-button" onClick={() => onExpandedChange(false)}>
                  Hide
                  <Icon type="utility" icon="up" className="slds-button__icon slds-button__icon_right" omitContainer />
                </button>
              </div>
            )}
          </Grid>

          <Grid align="spread" verticalAlign="center" wrap className="slds-m-top_small slds-p-top_small slds-border_top">
            <Grid verticalAlign="center" wrap>
              <span className="slds-text-title_caps slds-m-right_x-small">Metadata Types:</span>
              <RadioGroup label="Metadata types" hideLabel isButtonGroup className="slds-m-right_x-small">
                <RadioButton
                  name="org-alignment-scope"
                  label={`Common (${COMMON_METADATA_TYPES.length})`}
                  value="common"
                  checked={options.selectionMode === 'common'}
                  disabled={isRunning}
                  onChange={() => onOptionsChange({ selectionMode: 'common' })}
                />
                <RadioButton
                  name="org-alignment-scope"
                  label="All"
                  value="all"
                  checked={options.selectionMode === 'all'}
                  disabled={isRunning}
                  onChange={() => onOptionsChange({ selectionMode: 'all' })}
                />
                <RadioButton
                  name="org-alignment-scope"
                  label={`Custom (${options.customMetadataTypes.length})`}
                  value="custom"
                  checked={options.selectionMode === 'custom'}
                  disabled={isRunning}
                  onChange={() => onOptionsChange({ selectionMode: 'custom' })}
                />
              </RadioGroup>
              <button
                type="button"
                className="slds-button slds-button_neutral"
                disabled={isRunning || !sourceOrg || !targetOrg}
                onClick={onChooseTypes}
              >
                Choose Types
              </button>
            </Grid>

            <Grid verticalAlign="center" wrap>
              <Checkbox
                id="org-alignment-normalize-xml"
                className="slds-m-right_medium"
                label="Ignore permission ordering"
                labelHelp="Salesforce returns the entries of profiles and permission sets in a different order in each org. Leave this on so that only real permission differences are reported."
                checked={options.normalizePermissionXml}
                onChange={onNormalizePermissionXmlChange}
              />
              <Checkbox
                id="org-alignment-include-managed"
                className="slds-m-right_medium"
                label="Include managed packages"
                labelHelp="Components from managed packages are skipped because Salesforce hides their content. Turn this on to list them anyway, they are shown as Not Compared."
                checked={options.includeManaged}
                disabled={isRunning}
                onChange={(includeManaged) => onOptionsChange({ includeManaged })}
              />
              <NotSeeingRecentMetadataPopover
                header="Missing or outdated metadata?"
                refreshButtonLabel="Refresh and Compare Again"
                viewInSalesforceSetup={undefined}
                messages={REFRESH_MESSAGES}
                disabled={!canCompare}
                onReload={onRefreshAndCompare}
              />
            </Grid>
          </Grid>
        </div>
      )}
    </Fragment>
  );
};

export default OrgAlignmentSetup;
