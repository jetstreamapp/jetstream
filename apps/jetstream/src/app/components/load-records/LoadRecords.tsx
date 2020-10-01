/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, Icon, Page, PageHeader, PageHeaderActions, PageHeaderRow, PageHeaderTitle } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';
import Split from 'react-split';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';
import * as fromLoadRecordsState from './load-records.state';
import LoadRecordsConfiguration from './LoadRecordsConfiguration';
import LoadRecordsSObjects from './LoadRecordsSObjects';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoadRecordsProps {}

export const LoadRecords: FunctionComponent<LoadRecordsProps> = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useRecoilState(fromLoadRecordsState.priorSelectedOrg);
  const selectedSObject = useRecoilValue(fromLoadRecordsState.selectedSObjectState);
  const [sobjects, setSobjects] = useRecoilState(fromLoadRecordsState.sObjectsState);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [deployModalActive, setDeployModalActive] = useState<boolean>(false);

  // useState()
  // useEffect()

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'data_streams' }} label="Load Records" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <button className="slds-button slds-button_brand">
              <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" />
              Load Records
            </button>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        <Split
          sizes={[33, 77]}
          minSize={[200, 300]}
          gutterSize={selectedSObject ? 10 : 0}
          className="slds-gutters"
          css={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div className="slds-p-horizontal_x-small">
            <h2 className="slds-text-heading_medium slds-text-align_center">Objects</h2>
            <LoadRecordsSObjects />
          </div>
          <div className="slds-p-horizontal_x-small">
            <LoadRecordsConfiguration selectedOrg={selectedOrg} selectedSObject={selectedSObject} />
          </div>
        </Split>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default LoadRecords;
