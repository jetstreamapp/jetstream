/** @jsx jsx */
import { jsx } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { Icon } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import DownloadPackageWithFileSelector from '../utils/DownloadPackageWithFileSelector';
import DownloadMetadataPackageConfigModal from './DownloadMetadataPackageConfigModal';

export interface DownloadMetadataPackageProps {
  selectedOrg: SalesforceOrgUi;
}

export const DownloadMetadataPackage: FunctionComponent<DownloadMetadataPackageProps> = ({ selectedOrg }) => {
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [packageManifest, setPackageManifest] = useState<string>();
  const [packageNames, setPackageNames] = useState<string[]>();

  function handleClick() {
    setConfigModalOpen(true);
  }

  function handleDownloadFromManifest(packageManifest: string) {
    handleDownload(packageManifest, null);
  }
  function handleDownloadFromPackageNames(packageNames: string[]) {
    handleDownload(null, packageNames);
  }
  function handleDownload(packageManifest: string, packageNames: string[]) {
    setPackageManifest(packageManifest);
    setPackageNames(packageNames);
    setConfigModalOpen(false);
    setDownloadResultsModalOpen(true);
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
          selectedOrg={selectedOrg}
          onClose={() => setConfigModalOpen(false)}
          onDownloadFromManifest={handleDownloadFromManifest}
          onDownloadFromPackageNames={handleDownloadFromPackageNames}
        />
      )}
      {downloadResultsModalOpen && (
        <DownloadPackageWithFileSelector
          type="package"
          selectedOrg={selectedOrg}
          packageManifest={packageManifest}
          packageNames={packageNames}
          onClose={() => setDownloadResultsModalOpen(false)}
        />
      )}
    </Fragment>
  );
};

export default DownloadMetadataPackage;
