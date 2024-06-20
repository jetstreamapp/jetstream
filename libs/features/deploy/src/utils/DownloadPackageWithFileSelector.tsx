import { getPackageXml } from '@jetstream/shared/data';
import { saveFile } from '@jetstream/shared/ui-utils';
import {
  AsyncJobNew,
  FileExtAllTypes,
  ListMetadataResult,
  Maybe,
  MimeType,
  RetrievePackageFromListMetadataJob,
  RetrievePackageFromManifestJob,
  RetrievePackageFromPackageNamesJob,
  SalesforceOrgUi,
} from '@jetstream/types';
import { FileFauxDownloadModal } from '@jetstream/ui';
import { applicationCookieState, fromJetstreamEvents } from '@jetstream/ui-core';
import isString from 'lodash/isString';
import { Fragment, FunctionComponent } from 'react';
import { useRecoilState } from 'recoil';

export interface DownloadPackageWithFileSelectorProps {
  type: 'manifest' | 'package';
  selectedOrg: SalesforceOrgUi;
  modalHeader?: string;
  modalTagline?: string;
  fileNameParts?: string[];
  listMetadataItems?: Maybe<Record<string, ListMetadataResult[]>>;
  packageManifest?: Maybe<string>;
  packageNames?: Maybe<string[]>;
  onClose?: () => void;
}

/**
 * Initiate a download that requires async processing to obtain the data
 * A file download modal is shown, then the data is downloaded async afterwards
 */
export const DownloadPackageWithFileSelector: FunctionComponent<DownloadPackageWithFileSelectorProps> = ({
  type,
  selectedOrg,
  modalHeader = type === 'manifest' ? 'Download Manifest' : 'Download Package',
  modalTagline,
  fileNameParts = type === 'manifest' ? ['package-manifest'] : ['metadata-package'],
  listMetadataItems,
  packageManifest,
  packageNames,
  onClose,
}) => {
  const [{ google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);

  async function handleManifestDownload(data: { fileName: string; fileFormat: FileExtAllTypes; mimeType: MimeType }) {
    onClose && onClose();
    const filename = `${data.fileName}.${data.fileFormat}`;
    if (listMetadataItems) {
      saveFile(await getPackageXml(selectedOrg, listMetadataItems), filename, data.mimeType);
    } else if (packageManifest) {
      saveFile(packageManifest, filename, data.mimeType);
    }
  }

  async function handlePackageDownload(data: {
    fileName: string;
    fileFormat: FileExtAllTypes;
    mimeType: MimeType;
    uploadToGoogle: boolean;
    googleFolder?: Maybe<string>;
  }) {
    onClose && onClose();

    let jobMeta: RetrievePackageFromListMetadataJob | RetrievePackageFromManifestJob | RetrievePackageFromPackageNamesJob;

    if (listMetadataItems) {
      jobMeta = {
        type: 'listMetadata',
        fileName: data.fileName,
        fileFormat: data.fileFormat,
        mimeType: data.mimeType,
        listMetadataItems,
        uploadToGoogle: data.uploadToGoogle,
        googleFolder: data.googleFolder,
      };
    } else if (packageManifest) {
      jobMeta = {
        type: 'packageManifest',
        fileName: data.fileName,
        fileFormat: data.fileFormat,
        mimeType: data.mimeType,
        packageManifest,
        uploadToGoogle: data.uploadToGoogle,
        googleFolder: data.googleFolder,
      };
    } else if (packageNames) {
      jobMeta = {
        type: 'packageNames',
        fileName: data.fileName,
        fileFormat: data.fileFormat,
        mimeType: data.mimeType,
        packageNames,
        uploadToGoogle: data.uploadToGoogle,
        googleFolder: data.googleFolder,
      };
    } else {
      throw new Error('No package data provided');
    }

    const jobs: AsyncJobNew<RetrievePackageFromListMetadataJob | RetrievePackageFromManifestJob | RetrievePackageFromPackageNamesJob>[] = [
      {
        type: 'RetrievePackageZip',
        title: `Download Metadata Package`,
        org: selectedOrg,
        meta: jobMeta,
      },
    ];

    fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
  }

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <Fragment>
      {(listMetadataItems || isString(packageManifest) || Array.isArray(packageNames)) && (
        <FileFauxDownloadModal
          modalHeader={modalHeader}
          modalTagline={modalTagline}
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          fileNameParts={fileNameParts}
          allowedTypes={type === 'manifest' ? ['xml'] : ['zip']}
          onCancel={() => onClose && onClose()}
          onDownload={type === 'manifest' ? handleManifestDownload : handlePackageDownload}
        />
      )}
    </Fragment>
  );
};

export default DownloadPackageWithFileSelector;
