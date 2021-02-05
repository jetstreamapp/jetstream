/** @jsx jsx */
import { jsx } from '@emotion/react';
import { getPackageXml } from '@jetstream/shared/data';
import { saveFile } from '@jetstream/shared/ui-utils';
import {
  AsyncJobNew,
  FileExtAllTypes,
  ListMetadataResult,
  MapOf,
  MimeType,
  RetrievePackageFromListMetadataJob,
  RetrievePackageFromManifestJob,
  RetrievePackageFromPackageNamesJob,
  SalesforceOrgUi,
} from '@jetstream/types';
import { FileFauxDownloadModal } from '@jetstream/ui';
import isString from 'lodash/isString';
import { Fragment, FunctionComponent } from 'react';
import * as fromJetstreamEvents from '../../core/jetstream-events';
export interface DownloadPackageWithFileSelectorProps {
  type: 'manifest' | 'package';
  selectedOrg: SalesforceOrgUi;
  modalHeader?: string;
  modalTagline?: string;
  fileNameParts?: string[];
  listMetadataItems?: MapOf<ListMetadataResult[]>;
  packageManifest?: string;
  packageNames?: string[];
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
  async function handleManifestDownload(data: { fileName: string; fileFormat: FileExtAllTypes; mimeType: MimeType }) {
    onClose();
    if (listMetadataItems) {
      saveFile(await getPackageXml(selectedOrg, listMetadataItems), data.fileName, data.mimeType);
    } else if (packageManifest) {
      saveFile(packageManifest, data.fileName, data.mimeType);
    }
  }

  async function handlePackageDownload(data: { fileName: string; fileFormat: FileExtAllTypes; mimeType: MimeType }) {
    onClose();

    let jobMeta: RetrievePackageFromListMetadataJob | RetrievePackageFromManifestJob | RetrievePackageFromPackageNamesJob;

    if (listMetadataItems) {
      jobMeta = {
        type: 'listMetadata',
        fileName: data.fileName,
        mimeType: data.mimeType,
        listMetadataItems,
      };
    } else if (packageManifest) {
      jobMeta = {
        type: 'packageManifest',
        fileName: data.fileName,
        mimeType: data.mimeType,
        packageManifest,
      };
    } else if (packageNames) {
      jobMeta = {
        type: 'packageNames',
        fileName: data.fileName,
        mimeType: data.mimeType,
        packageNames,
      };
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
    <Fragment>
      {(listMetadataItems || isString(packageManifest) || Array.isArray(packageNames)) && (
        <FileFauxDownloadModal
          modalHeader={modalHeader}
          modalTagline={modalTagline}
          org={selectedOrg}
          fileNameParts={fileNameParts}
          allowedTypes={type === 'manifest' ? ['xml'] : ['zip']}
          onCancel={onClose}
          onDownload={type === 'manifest' ? handleManifestDownload : handlePackageDownload}
        />
      )}
    </Fragment>
  );
};

export default DownloadPackageWithFileSelector;
