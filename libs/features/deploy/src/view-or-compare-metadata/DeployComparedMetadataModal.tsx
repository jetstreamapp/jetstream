import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { DeployOptions, DeployResult, ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, FileDownloadModal, Grid, Icon, Modal } from '@jetstream/ui';
import { fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { Fragment, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import DeployMetadataToOrgConfigModal from '../deploy-to-different-org/DeployMetadataToOrgConfigModal';
import DeployMetadataToOrgStatusModal from '../deploy-to-different-org/DeployMetadataToOrgStatusModal';
import { getDeployResultsExcelData } from '../utils/deploy-metadata.utils';
import { DeployFromCompareMetadataItem } from './viewOrCompareMetadataTypes';

export interface DeployComparedMetadataModalProps {
  sourceOrg: SalesforceOrgUi;
  targetOrg: SalesforceOrgUi;
  items: DeployFromCompareMetadataItem[];
  onClose: (closeAll?: boolean) => void;
}

export const DeployComparedMetadataModal = ({ sourceOrg, targetOrg, items, onClose }: DeployComparedMetadataModalProps) => {
  const { trackEvent } = useAmplitude();
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const [mode, setMode] = useState<'SELECTION' | 'DEPLOY_CONFIG' | 'DEPLOY'>('SELECTION');
  const [selectedItems, setSelectedFiles] = useState<Set<string>>(
    () => new Set(items.flatMap((parent) => parent.items.filter((item) => !item.sourceAndTargetMatch).map((item) => item.filename)))
  );
  const [metadataToDeploy, setMetadataToDeploy] = useState<Record<string, ListMetadataResult[]>>();
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [deployMetadataOptions, setDeployMetadataOptions] = useState<DeployOptions | null>(null);
  const [deployResultsData, setDeployResultsData] = useState<Record<string, any[]>>();

  function handleChange(key: string, value: boolean) {
    const selected = new Set(selectedItems);
    if (value) {
      selected.add(key);
    } else {
      selected.delete(key);
    }
    setSelectedFiles(selected);
  }

  function handleDeployResultsDownload(deployResults: DeployResult, deploymentUrl: string) {
    setDeployResultsData(getDeployResultsExcelData(deployResults, deploymentUrl));
    setDownloadResultsModalOpen(true);
  }

  function handleDeployMetadata(destinationOrg: SalesforceOrgUi, deployOptions: DeployOptions) {
    setDeployMetadataOptions(deployOptions);
    setMode('DEPLOY');
    trackEvent(ANALYTICS_KEYS.deploy_deployMetadata, { type: 'org-to-org-from-comparison', deployOptions });
  }

  function handleContinue() {
    setMode('DEPLOY_CONFIG');
    setMetadataToDeploy(
      items
        .flatMap((item) => item.items)
        .filter((item) => selectedItems.has(item.filename))
        .map((item) => item.source)
        .reduce((acc: Record<string, ListMetadataResult[]>, item) => {
          acc[item.type] = acc[item.type] || [];
          acc[item.type].push({
            createdById: item.createdById,
            createdByName: item.createdByName,
            createdDate: null,
            fileName: item.fileName,
            fullName: item.fullName,
            id: item.id,
            lastModifiedById: item.lastModifiedById,
            lastModifiedByName: item.lastModifiedByName,
            lastModifiedDate: null,
            namespacePrefix: item.namespacePrefix,
            type: item.type,
          });
          return acc;
        }, {})
    );
  }

  if (mode === 'DEPLOY_CONFIG' && metadataToDeploy) {
    return (
      <DeployMetadataToOrgConfigModal
        sourceOrg={sourceOrg}
        initialSelectedDestinationOrg={targetOrg}
        initialOptions={deployMetadataOptions}
        selectedMetadata={metadataToDeploy}
        lockDestinationOrg
        onClose={() => setMode('SELECTION')}
        onDeploy={handleDeployMetadata}
      />
    );
  }

  if (mode === 'DEPLOY' && metadataToDeploy) {
    return (
      <>
        <DeployMetadataToOrgStatusModal
          hideModal={downloadResultsModalOpen}
          sourceOrg={sourceOrg}
          destinationOrg={targetOrg}
          selectedMetadata={metadataToDeploy}
          deployOptions={deployMetadataOptions || {}}
          onGoBack={() => setMode('DEPLOY_CONFIG')}
          onClose={() => onClose(true)}
          onDownload={handleDeployResultsDownload}
        />
        {downloadResultsModalOpen && deployResultsData && (
          <FileDownloadModal
            modalHeader="Download Deploy Results"
            org={targetOrg}
            googleIntegrationEnabled={hasGoogleDriveAccess}
            googleShowUpgradeToPro={googleShowUpgradeToPro}
            google_apiKey={google_apiKey}
            google_appId={google_appId}
            google_clientId={google_clientId}
            fileNameParts={['deploy-results']}
            allowedTypes={['xlsx']}
            data={deployResultsData}
            onModalClose={() => setDownloadResultsModalOpen(false)}
            emitUploadToGoogleEvent={fromJetstreamEvents.emit}
            source="deploy_metadata_to_org_from_comparison"
            trackEvent={trackEvent}
          />
        )}
      </>
    );
  }

  return (
    <Modal
      header="Deploy Metadata"
      closeOnBackdropClick={false}
      closeOnEsc={false}
      footer={
        <Grid align="end">
          <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </button>
          <button className="slds-button slds-button_neutral" onClick={() => onClose(true)}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" form="create-object-form" type="submit" onClick={handleContinue}>
            Continue
          </button>
        </Grid>
      }
      onClose={() => onClose(false)}
    >
      <div>
        {items.map((metadata) => (
          <Fragment key={metadata.type}>
            <h3>{metadata.type}</h3>
            <div className="slds-m-left_x-small">
              {metadata.items.map((item) => (
                <div key={item.filename}>
                  <Checkbox
                    id={`deploy-checkbox-${metadata.type}-${item.filename}`}
                    label={
                      <span
                        className={classNames({
                          'slds-text-color_success': item.sourceAndTargetMatch,
                          'slds-text-color_destructive': !item.sourceAndTargetMatch,
                        })}
                      >
                        {item.source.fullName} {!item.sourceAndTargetMatch && `(Different)`}
                      </span>
                    }
                    checked={selectedItems.has(item.filename)}
                    onChange={(value) => handleChange(item.filename, value)}
                  />
                </div>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </Modal>
  );
};
