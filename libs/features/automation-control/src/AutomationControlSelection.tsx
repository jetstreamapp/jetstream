import { css } from '@emotion/react';
import { TITLES } from '@jetstream/shared/constants';
import { useRollbar, useTitle } from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { DescribeGlobalSObjectResult, ListItem, SalesforceOrgUi } from '@jetstream/types';
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
import { RequireMetadataApiBanner, fromAutomationControlState, selectedOrgState } from '@jetstream/ui-core';
import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { AutomationMetadataType } from './automation-control-types';

const HEIGHT_BUFFER = 170;

/** TODO: include any other criteria if needed */
export function filterPermissionsSobjects(sobject: DescribeGlobalSObjectResult | null) {
  return (
    !!sobject &&
    sobject.triggerable &&
    !sobject.deprecatedAndHidden &&
    !sobject.customSetting &&
    !sobject.name.endsWith('ChangeEvent') &&
    !sobject.name.endsWith('ChgEvent') &&
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

  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  const hasSelectionsMade = useRecoilValue(fromAutomationControlState.hasSelectionsMade);
  const [sobjects, setSobjects] = useRecoilState(fromAutomationControlState.sObjectsState);
  const [selectedSObjects, setSelectedSObjects] = useRecoilState(fromAutomationControlState.selectedSObjectsState);

  const automationTypes = useRecoilValue(fromAutomationControlState.automationTypes);
  const [selectedAutomationTypes, setSelectedAutomationTypes] = useRecoilState(fromAutomationControlState.selectedAutomationTypes);

  function handleSobjectChange(sobjects: DescribeGlobalSObjectResult[] | null) {
    setSobjects(sobjects);
  }

  return (
    <Page testId="automation-control--selection-page">
      <RequireMetadataApiBanner />
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'activations' }} label="Automation Control" docsPath="/automation-control" />
          <PageHeaderActions colType="actions" buttonType="separate">
            {hasSelectionsMade && (
              <Link className="slds-button slds-button_brand" to="editor">
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
              items={automationTypes as ListItem[]}
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
