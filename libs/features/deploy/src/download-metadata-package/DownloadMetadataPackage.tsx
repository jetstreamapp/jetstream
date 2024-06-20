import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import { Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent, useState } from 'react';
import { useAmplitude } from '@jetstream/ui-core';
import DownloadPackageWithFileSelector from '../utils/DownloadPackageWithFileSelector';
import DownloadMetadataPackageConfigModal from './DownloadMetadataPackageConfigModal';

export interface DownloadMetadataPackageProps {
  className?: string;
  selectedOrg: SalesforceOrgUi;
}

export const DownloadMetadataPackage: FunctionComponent<DownloadMetadataPackageProps> = ({
  className,
  selectedOrg: initiallySelectedOrg,
}) => {
  const { trackEvent } = useAmplitude();
  const [destinationOrg, setDestinationOrg] = useState<SalesforceOrgUi>(initiallySelectedOrg);
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [downloadResultsModalOpen, setDownloadResultsModalOpen] = useState<boolean>(false);
  const [packageManifest, setPackageManifest] = useState<string | null>(null);
  const [packageNames, setPackageNames] = useState<string[] | null>(null);

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
  function handleDownload(packageManifest: string | null, packageNames: string[] | null) {
    setPackageManifest(packageManifest);
    setPackageNames(packageNames);
    setConfigModalOpen(false);
    setDownloadResultsModalOpen(true);
    trackEvent(ANALYTICS_KEYS.deploy_downloadMetadataPkg);
  }

  return (
    <Fragment>
      <button
        className={classNames('slds-button slds-button_neutral', className)}
        onClick={handleClick}
        title="If you have a Package.xml file or your org has an outbound changeset or an unmanaged package, you can download the metadata as a zip file so that you can view or modify the components locally and re-deploy to any org."
      >
        <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
        <span>Download Metadata Package</span>
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
