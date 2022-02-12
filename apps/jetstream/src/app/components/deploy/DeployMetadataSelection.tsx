import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ButtonGroupContainer,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
} from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import Split from 'react-split';
import { useRecoilValue } from 'recoil';
import { useAmplitude } from '../core/analytics';
import DeployMetadataPackage from './deploy-metadata-package/DeployMetadataPackage';
import * as fromDeployMetadataState from './deploy-metadata.state';
import './DeployMetadataSelection.scss';
import DownloadMetadataPackage from './download-metadata-package/DownloadMetadataPackage';
import DateSelection from './selection-components/DateSelection';
import ManagedPackageSelection from './selection-components/ManagedPackageSelection';
import MetadataSelection from './selection-components/MetadataSelection';
import UserSelection from './selection-components/UserSelection';

const HEIGHT_BUFFER = 170;

export interface DeployMetadataSelectionProps {
  selectedOrg: SalesforceOrgUi;
}

export const DeployMetadataSelection: FunctionComponent<DeployMetadataSelectionProps> = ({ selectedOrg }) => {
  const match = useRouteMatch();
  const { trackEvent } = useAmplitude();

  const amplitudeSubmissionSelector = useRecoilValue(fromDeployMetadataState.amplitudeSubmissionSelector);
  const metadataItems = useRecoilValue(fromDeployMetadataState.metadataItemsState);
  const hasSelectionsMade = useRecoilValue(fromDeployMetadataState.hasSelectionsMadeSelector);
  const hasSelectionsMadeMessage = useRecoilValue(fromDeployMetadataState.hasSelectionsMadeMessageSelector);

  function trackContinue() {
    trackEvent(ANALYTICS_KEYS.deploy_configuration, { page: 'initial-selection', ...amplitudeSubmissionSelector });
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'asset_relationship' }} label="Deploy and Compare Metadata" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <ButtonGroupContainer>
              <DownloadMetadataPackage selectedOrg={selectedOrg} />
              <DeployMetadataPackage selectedOrg={selectedOrg} />
            </ButtonGroupContainer>
            {hasSelectionsMade && (
              <Link
                onClick={trackContinue}
                className="slds-button slds-button_brand"
                to={{
                  pathname: `${match.url}/deploy`,
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
            {hasSelectionsMadeMessage && <span>{hasSelectionsMadeMessage}</span>}
          </div>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer
        bottomBuffer={10}
        className="slds-p-horizontal_x-small slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        <Split
          sizes={[33, 33, 33]}
          minSize={[300, 300, 300]}
          gutterSize={metadataItems?.length ? 10 : 0}
          className="slds-gutters"
          css={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div className="slds-p-horizontal_x-small">
            <MetadataSelection selectedOrg={selectedOrg} />
          </div>
          <div className="slds-p-horizontal_x-small">
            <UserSelection selectedOrg={selectedOrg} />
          </div>
          <div className="slds-p-horizontal_x-small">
            <DateSelection />
            <hr className="slds-m-vertical_small" />
            <ManagedPackageSelection />
          </div>
        </Split>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default DeployMetadataSelection;
