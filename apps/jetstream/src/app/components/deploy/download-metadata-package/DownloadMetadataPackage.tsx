import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import { Icon } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import { useAmplitude } from '../../core/analytics';
import DownloadPackageWithFileSelector from '../utils/DownloadPackageWithFileSelector';
import DownloadMetadataPackageConfigModal from './DownloadMetadataPackageConfigModal';

export interface DownloadMetadataPackageProps {
  selectedOrg: SalesforceOrgUi;
}

export const DownloadMetadataPackage: FunctionComponent<DownloadMetadataPackageProps> = ({ selectedOrg: initiallySelectedOrg }) => {
  const { trackEvent } = useAmplitude();
  const [destinationOrg, setDestinationOrg] = useState<SalesforceOrgUi>(initiallySelectedOrg);
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [packageManifest, setPackageManifest] = useState<string>();
  const [packageNames, setPackageNames] = useState<string[]>();

  function handleClick() {
    setDestinationOrg(initiallySelectedOrg);
    setConfigModalOpen(true);
    trackEvent(ANALYTICS_KEYS.deploy_downloadMetadataPkg);
  }

  function handleDownloadFromManifest(destinationOrg: SalesforceOrgUi, packageManifest: string) {
    setDestinationOrg(destinationOrg);
    handleDownload(packageManifest, null);
    trackEvent(ANALYTICS_KEYS.deploy_downloadMetadataPkg, { type: 'from-manifest' });
  }
  function handleDownloadFromPackageNames(destinationOrg: SalesforceOrgUi, packageNames: string[]) {
    setDestinationOrg(destinationOrg);
    handleDownload(null, packageNames);
    trackEvent(ANALYTICS_KEYS.deploy_downloadMetadataPkg, { type: 'from-package-names' });
  }
  function handleDownload(packageManifest: string, packageNames: string[]) {
    setPackageManifest(packageManifest);
    setPackageNames(packageNames);
    setConfigModalOpen(false);
    setDownloadResultsModalOpen(true);
    trackEvent(ANALYTICS_KEYS.deploy_downloadMetadataPkg);
  }

  return (
    <Fragment>
      <button
        className="slds-button slds-button_neutral"
        onClick={handleClick}
        title="If you have a Package.xml file or your org has an outbound changeset or an unmanaged package, you can download the metadata as a zip file so that you can view or modify the components locally and re-deploy to any org."
      >
        <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
        Download Metadata Package
      </button>
      {/* MODALS */}
      {configModalOpen && (
        <DownloadMetadataPackageConfigModal
          selectedOrg={destinationOrg}
          onClose={() => setConfigModalOpen(false)}
          onDownloadFromManifest={handleDownloadFromManifest}
          onDownloadFromPackageNames={handleDownloadFromPackageNames}
        />
      )}
      {downloadResultsModalOpen && (
        <DownloadPackageWithFileSelector
          type="package"
          selectedOrg={destinationOrg}
          packageManifest={packageManifest}
          packageNames={packageNames}
          onClose={() => setDownloadResultsModalOpen(false)}
        />
      )}
    </Fragment>
  );
};

export default DownloadMetadataPackage;
