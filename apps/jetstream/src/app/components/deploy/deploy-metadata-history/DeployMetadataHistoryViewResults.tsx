import { DeployResult, SalesforceDeployHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { SalesforceLogin } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import DeployMetadataStatusModal from '../utils/DeployMetadataStatusModal';

export interface DeployMetadataHistoryViewResultsProps {
  item: SalesforceDeployHistoryItem;
  destinationOrg: SalesforceOrgUi;
  serverUrl: string;
  onGoBack: () => void;
  onClose: () => void;
  onDownload: (deployResults: DeployResult, deploymentUrl: string) => void;
}

export const DeployMetadataHistoryViewResults: FunctionComponent<DeployMetadataHistoryViewResultsProps> = ({
  item,
  destinationOrg,
  serverUrl,
  onGoBack,
  onClose,
  onDownload,
}) => {
  return (
    <DeployMetadataStatusModal
      destinationOrg={destinationOrg}
      finishedSuccessfullyLabel="This deployment was successful"
      finishedPartialSuccessfullyLabel="This deployment was partially successful"
      fallbackErrorMessageLabel="This deployment was not successful."
      fallbackUnknownErrorMessageLabel="This deployment was not successful."
      deployStatusUrl={null}
      loading={false}
      status="idle"
      results={item.results}
      lastChecked={null}
      // TODO:
      errorMessage={null}
      hasError={false}
      statusUrls={
        <div>
          {item.url && (
            <SalesforceLogin org={destinationOrg} serverUrl={serverUrl} skipFrontDoorAuth iconPosition="right" returnUrl={item.url}>
              View the deployment details.
            </SalesforceLogin>
          )}
        </div>
      }
      // hideModal={hideModal}
      getStatusValue={() => ''}
      onGoBack={onGoBack}
      onClose={onClose}
      onDownload={onDownload}
    />
  );
};

export default DeployMetadataHistoryViewResults;
