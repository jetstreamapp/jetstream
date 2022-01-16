import { css } from '@emotion/react';
import { TITLES } from '@jetstream/shared/constants';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ConnectedSobjectListMultiSelect,
  Icon,
  ListWithFilterMultiSelect,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
} from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent } from 'react';
import { useRouteMatch } from 'react-router';
import { Link } from 'react-router-dom';
import Split from 'react-split';
import { useTitle } from 'react-use';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';
import { AutomationMetadataType } from './automation-control-types';
import * as fromAutomationCtlState from './automation-control.state';

const HEIGHT_BUFFER = 170;

/** TODO: include any other criteria if needed */
export function filterPermissionsSobjects(sobject: DescribeGlobalSObjectResult) {
  return (
    sobject.triggerable &&
    !sobject.deprecatedAndHidden &&
    !sobject.customSetting &&
    !sobject.name.endsWith('__History') &&
    !sobject.name.endsWith('__Tag') &&
    !sobject.name.endsWith('__Share')
  );
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlSelectionProps {}

export const AutomationControlSelection: FunctionComponent<AutomationControlSelectionProps> = () => {
  useTitle(TITLES.AUTOMATION_CONTROL);
  const rollbar = useRollbar();

  const match = useRouteMatch();

  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  const hasSelectionsMade = useRecoilValue(fromAutomationCtlState.hasSelectionsMade);
  const [sobjects, setSobjects] = useRecoilState(fromAutomationCtlState.sObjectsState);
  const [selectedSObjects, setSelectedSObjects] = useRecoilState(fromAutomationCtlState.selectedSObjectsState);

  const automationTypes = useRecoilValue(fromAutomationCtlState.automationTypes);
  const [selectedAutomationTypes, setSelectedAutomationTypes] = useRecoilState(fromAutomationCtlState.selectedAutomationTypes);

  function handleSobjectChange(sobjects: DescribeGlobalSObjectResult[]) {
    setSobjects(sobjects);
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'activations' }} label="Automation Control" />
          <PageHeaderActions colType="actions" buttonType="separate">
            {hasSelectionsMade && (
              <Link
                className="slds-button slds-button_brand"
                to={{
                  pathname: `${match.url}/editor`,
                }}
              >
                Continue
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              </Link>
            )}
            {!hasSelectionsMade && (
              <button className="slds-button slds-button_brand" disabled>
                Continue
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              </button>
            )}
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <div
            className="slds-col_bump-left"
            css={css`
              min-height: 19px;
            `}
          >
            {!hasSelectionsMade && <span>Select one or more objects and at least one automation type</span>}
          </div>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer
        bottomBuffer={10}
        className="slds-p-horizontal_x-small slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        <Split
          sizes={[50, 50]}
          minSize={[300, 300]}
          className="slds-gutters"
          css={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div className="slds-p-horizontal_x-small">
            <ConnectedSobjectListMultiSelect
              selectedOrg={selectedOrg}
              sobjects={sobjects}
              selectedSObjects={selectedSObjects}
              filterFn={filterPermissionsSobjects}
              onSobjects={handleSobjectChange}
              onSelectedSObjects={setSelectedSObjects}
            />
          </div>

          <div className="slds-p-horizontal_x-small">
            <ListWithFilterMultiSelect
              labels={{
                listHeading: 'Automation Types',
                filter: 'Filter Automation Types',
                descriptorSingular: 'automation type',
                descriptorPlural: 'automation types',
              }}
              items={automationTypes}
              selectedItems={selectedAutomationTypes}
              loading={false}
              onSelected={(items) => setSelectedAutomationTypes(items as AutomationMetadataType[])}
            />
          </div>
        </Split>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default AutomationControlSelection;
