import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { SplitWrapper as Split } from '@jetstream/splitjs';
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
import { fromDeployMetadataState, RequireMetadataApiBanner, selectedOrgState, useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import './DeployMetadataSelection.scss';
import DeployMetadataHistoryModal from './deploy-metadata-history/DeployMetadataHistoryModal';
import DeployMetadataPackage from './deploy-metadata-package/DeployMetadataPackage';
import DownloadMetadataPackage from './download-metadata-package/DownloadMetadataPackage';
import DateSelection from './selection-components/DateSelection';
import ManagedPackageSelection from './selection-components/ManagedPackageSelection';
import MetadataSelection from './selection-components/MetadataSelection';
import UserSelection from './selection-components/UserSelection';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeployMetadataSelectionProps {}

export const DeployMetadataSelection: FunctionComponent<DeployMetadataSelectionProps> = () => {
  const { trackEvent } = useAmplitude();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const amplitudeSubmissionSelector = useRecoilValue(fromDeployMetadataState.amplitudeSubmissionSelector);
  const metadataItems = useRecoilValue(fromDeployMetadataState.metadataItemsState);
  const hasSelectionsMade = useRecoilValue(fromDeployMetadataState.hasSelectionsMadeSelector);
  const hasSelectionsMadeMessage = useRecoilValue(fromDeployMetadataState.hasSelectionsMadeMessageSelector);

  function trackContinue() {
    trackEvent(ANALYTICS_KEYS.deploy_configuration, { page: 'initial-selection', ...amplitudeSubmissionSelector });
  }

  return (
    <Page testId="deploy-metadata-selection-page">
      <RequireMetadataApiBanner />
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'asset_relationship' }}
            label="Deploy and Compare Metadata"
            docsPath="/deploy-metadata"
          />
          <PageHeaderActions colType="actions" buttonType="separate">
            <DeployMetadataHistoryModal className="collapsible-button collapsible-button-xl" />
            <ButtonGroupContainer>
              <DownloadMetadataPackage className="collapsible-button collapsible-button-xl" selectedOrg={selectedOrg} />
              <DeployMetadataPackage className="collapsible-button collapsible-button-sm" selectedOrg={selectedOrg} />
            </ButtonGroupContainer>
            {hasSelectionsMade && (
              <Link onClick={trackContinue} className="slds-button slds-button_brand" to="deploy">
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
