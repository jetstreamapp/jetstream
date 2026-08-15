import { FileExtAllTypes } from '@jetstream/types';
import { FileDownloadModal } from '@jetstream/ui';
import { fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import { fromAppState, googleDriveAccessState, selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent } from 'react';
import { DownloadModalData } from './useDownloadResults';

export interface LoadRecordsMultiObjectDownloadModalProps {
  downloadModalData: DownloadModalData;
  onClose: () => void;
}

/** The file download modal shared by the request/results downloads on both steps */
export const LoadRecordsMultiObjectDownloadModal: FunctionComponent<LoadRecordsMultiObjectDownloadModalProps> = ({
  downloadModalData,
  onClose,
}) => {
  const { trackEvent } = useAmplitude();
  const selectedOrg = useAtomValue(selectedOrgState);
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(fromAppState.applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);

  if (!downloadModalData.open) {
    return null;
  }

  return (
    <FileDownloadModal
      org={selectedOrg}
      googleIntegrationEnabled={hasGoogleDriveAccess}
      googleShowUpgradeToPro={googleShowUpgradeToPro}
      google_apiKey={google_apiKey}
      google_appId={google_appId}
      google_clientId={google_clientId}
      data={downloadModalData.data}
      header={downloadModalData.header}
      fileNameParts={downloadModalData.fileNameParts}
      allowedTypes={downloadModalData.allowedTypes as FileExtAllTypes[]}
      onModalClose={onClose}
      emitUploadToGoogleEvent={fromJetstreamEvents.emit}
      source="load_records_multi_object"
      trackEvent={trackEvent}
    />
  );
};

export default LoadRecordsMultiObjectDownloadModal;
