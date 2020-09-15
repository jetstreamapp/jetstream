/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  Accordion,
  AutoFullHeightContainer,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  SobjectList,
  SobjectListMultiSelect,
  Tabs,
} from '@jetstream/ui';
import { selectedOrgState } from '../../app-state';
import classNames from 'classnames';
import Split from 'react-split';
import * as fromAutomationCtlState from './automation-control.state';
import { describeGlobal } from '@jetstream/shared/data';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { logger } from '@jetstream/shared/client-logger';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlProps {}

export const AutomationControl: FunctionComponent<AutomationControlProps> = () => {
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);
  // TODO: reset when org changes
  const [sobjects, setSobjects] = useRecoilState(fromAutomationCtlState.sObjectsState);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  // TODO: do we want full object type?
  const [selectedSObjects, setSelectedSObjects] = useState<string[]>([]);

  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  // reset everything if the selected org changes
  useEffect(() => {
    if (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      // RESET STUFF
    } else if (!selectedOrg) {
      // RESET STUFF
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  useEffect(() => {
    if (selectedOrg && !loading && !errorMessage && !sobjects) {
      (async () => {
        setLoading(true);
        try {
          const results = await describeGlobal(selectedOrg);
          setSobjects(orderObjectsBy(results.sobjects.filter(filterSobjectFn), 'label'));
        } catch (ex) {
          logger.error(ex);
          setErrorMessage(ex.message);
        }
        setLoading(false);
      })();
    }
  }, [selectedOrg, loading, errorMessage, sobjects, setSobjects]);

  function filterSobjectFn(sobject: DescribeGlobalSObjectResult): boolean {
    return sobject.queryable && !sobject.name.endsWith('CleanInfo') && !sobject.name.endsWith('share') && !sobject.name.endsWith('history');
  }

  return (
    <div>
      <Page>
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle icon={{ type: 'standard', icon: 'activations' }} label="Automation Control" />
            <PageHeaderActions colType="actions" buttonType="separate">
              <button className={classNames('slds-button slds-button_neutral')} title="Enable All">
                <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
                Enable All
              </button>
              <button className={classNames('slds-button slds-button_neutral')} title="Disable All">
                <Icon type="utility" icon="dash" className="slds-button__icon slds-button__icon_left" omitContainer />
                Disable All
              </button>
              <button className="slds-button slds-button_brand">
                <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" />
                Deploy Changes
              </button>
            </PageHeaderActions>
          </PageHeaderRow>
        </PageHeader>
        <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
          <Split
            sizes={[25, 75]}
            minSize={[300, 600]}
            gutterSize={10}
            className="slds-gutters"
            css={css`
              display: flex;
              flex-direction: row;
            `}
          >
            <div className="slds-p-horizontal_x-small">
              <h2 className="slds-text-heading_medium slds-text-align_center">Objects</h2>
              {/* FIXME: allow multi-select (new component?) */}
              <SobjectListMultiSelect
                sobjects={sobjects}
                selectedSObjects={selectedSObjects}
                loading={loading}
                errorMessage={errorMessage}
                onSelected={setSelectedSObjects}
                errorReattempt={() => setErrorMessage(null)}
              />
            </div>
            <div className="slds-p-horizontal_x-small">
              <div>{selectedSObjects.length} Objects selected</div>
              <div>Which automation do you want to work with?</div>
              <div>
                <ul>
                  <li>- Duplicate Rules</li>
                  <li>- Validation Rules</li>
                  <li>- Workflow Rules</li>
                  <li>- Process Builders</li>
                  <li>- Apex Triggers</li>
                </ul>
              </div>
              <button className="slds-button slds-button_brand">
                Continue to View Current Automation
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              </button>
            </div>
          </Split>
        </AutoFullHeightContainer>
      </Page>
    </div>
  );
};

export default AutomationControl;
