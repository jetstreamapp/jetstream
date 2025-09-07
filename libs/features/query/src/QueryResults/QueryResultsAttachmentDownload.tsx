import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import {
  cancelZipDownload,
  DownZipFile,
  formatNumber,
  getFilename,
  getOrgUrlParams,
  getZipDownloadUrl,
  isBrowserExtension,
  isDesktop,
  useRollbar,
} from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj, REGEX, splitFilenameByExtension } from '@jetstream/shared/utils';
import { Maybe, SalesforceOrgUi, SalesforceRecord } from '@jetstream/types';
import { Icon, Modal, ScopedNotification, Tooltip } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';

export interface QueryResultsAttachmentDownloadProps {
  selectedOrg: SalesforceOrgUi;
  enabled: boolean;
  sobjectName: Maybe<string>;
  missingFields: string[];
  selectedRecords: SalesforceRecord[];
  hasRecords: boolean;
}

interface EnabledObjectFiledMapping {
  bodyField: string;
  /**
   * titleField is optional and will be used if available, otherwise fallback to nameField
   */
  titleField?: string;
  extensionField?: string;
  nameField: string;
  sizeField: string;
}

export const FILE_DOWNLOAD_FIELD_MAP = new Map<string, EnabledObjectFiledMapping>();
FILE_DOWNLOAD_FIELD_MAP.set('attachment', { bodyField: 'Body', nameField: 'Name', sizeField: 'BodyLength' });
FILE_DOWNLOAD_FIELD_MAP.set('document', { bodyField: 'Body', nameField: 'Name', sizeField: 'BodyLength' });
FILE_DOWNLOAD_FIELD_MAP.set('contentversion', {
  bodyField: 'VersionData',
  titleField: 'Title',
  extensionField: 'FileExtension',
  nameField: 'PathOnClient',
  sizeField: 'ContentSize',
});

const ROOT_FILENAME = '/api/file/stream-download';

function getFile(selectedOrg: SalesforceOrgUi, sobjectName: string, record: SalesforceRecord): DownZipFile {
  sobjectName = sobjectName.toLowerCase();
  if (FILE_DOWNLOAD_FIELD_MAP.has(sobjectName)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { bodyField, nameField, extensionField, titleField, sizeField } = FILE_DOWNLOAD_FIELD_MAP.get(sobjectName)!;
    let recordName = record[nameField];
    if (titleField && record[titleField]) {
      if (extensionField && record[extensionField]) {
        recordName = `${record[titleField]}.${record[extensionField]}`;
      } else {
        // extract extension from nameField if it exists - which it should
        const extension = splitFilenameByExtension(record[nameField])[1];
        if (extension) {
          recordName = `${record[titleField] || ''}${extension}`;
        }
      }
    }

    const [fileName, extension] = splitFilenameByExtension(recordName);
    recordName = `${fileName.replaceAll(REGEX.SAFE_FILENAME, '-')}${extension || ''}`;
    const BASE_URL = isDesktop() ? 'app://jetstream' : window.location.origin;

    return {
      baseUrl: BASE_URL,
      downloadUrl: `${ROOT_FILENAME}?${getOrgUrlParams(selectedOrg, { url: record[bodyField] })}`,
      name: recordName,
      size: record[sizeField],
    };
  }
  throw new Error(`Object type ${sobjectName} does not support file download.`);
}

function getFileNamesWithoutDuplicates(org: SalesforceOrgUi, sobjectName: string, records: SalesforceRecord[]): DownZipFile[] {
  return Object.values(
    records.reduce(
      (acc, record) => {
        const file = getFile(org, sobjectName, record);
        let fileName = file.name;
        const [fileNameWithoutExt, fileExtension] = splitFilenameByExtension(file.name);
        if (acc[file.name]) {
          let counter = 1;
          while (acc[`${fileNameWithoutExt} (${counter})${fileExtension}`]) {
            counter++;
          }
          fileName = `${fileNameWithoutExt} (${counter})${fileExtension}`;
          file.name = fileName;
        }
        acc[fileName] = file;
        return acc;
      },
      {} as Record<string, DownZipFile>,
    ),
  );
}

export const QueryResultsAttachmentDownload: FunctionComponent<QueryResultsAttachmentDownloadProps> = ({
  selectedOrg,
  enabled,
  sobjectName,
  missingFields,
  selectedRecords,
  hasRecords,
}) => {
  sobjectName = sobjectName?.toLowerCase() || null;
  const rollbar = useRollbar();
  const { trackEvent } = useAmplitude();
  const [modalOpen, setModalOpen] = useState(false);
  const [downloadAttachmentUrl, setDownloadAttachmentUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [disabledReason, setDisabledReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setVisible(FILE_DOWNLOAD_FIELD_MAP.has(sobjectName || '') && hasRecords);
    if (isBrowserExtension()) {
      setDisabled(true);
      setDisabledReason('This is not yet supported in the browser extension');
      return;
    }
    if (selectedRecords.length && !missingFields?.length) {
      setDisabled(false);
      setDisabledReason('');
    } else if (selectedRecords.length) {
      setDisabled(true);
      setDisabledReason(`Your query must include the following fields to download attachments: ${missingFields.join(', ')}`);
    } else {
      setDisabled(true);
      setDisabledReason('Select one or more records');
    }
  }, [sobjectName, selectedRecords, missingFields, trackEvent, hasRecords]);

  useEffect(() => {
    if (visible) {
      trackEvent(ANALYTICS_KEYS.attachment_QueriedEligibleObject, { sobjectName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackEvent, visible]);

  async function handleInitiateDownload() {
    try {
      if (!sobjectName) {
        return;
      }
      trackEvent(ANALYTICS_KEYS.attachment_ModalOpened, { selectedRecords: selectedRecords.length, sobjectName });
      setDownloadAttachmentUrl(null);
      setDisabledReason('');
      setErrorMessage(null);
      setModalOpen(true);

      const files = getFileNamesWithoutDuplicates(selectedOrg, sobjectName, selectedRecords);
      const url = await getZipDownloadUrl(getFilename(selectedOrg, [sobjectName, 'files']), files);
      setDownloadAttachmentUrl(url);
    } catch (ex) {
      logger.error('[ERROR] Attempting to get service worker url failed!');
      logger.error(ex);
      setErrorMessage('There was a problem initiating the download, your browser may not support this capability.');
      setDisabledReason('There was a problem initiating the download, your browser may not support this capability.');
      trackEvent(ANALYTICS_KEYS.attachment_Error, { selectedRecords: selectedRecords.length, sobjectName, error: getErrorMessage(ex) });
      rollbar.error('Error initiating zip download', getErrorMessageAndStackObj(ex));
    }
  }

  function handleModalClose(cancel?: boolean) {
    setModalOpen(false);
    if (cancel) {
      trackEvent(ANALYTICS_KEYS.attachment_Canceled, { selectedRecords: selectedRecords.length, sobjectName });
      downloadAttachmentUrl && cancelZipDownload(downloadAttachmentUrl);
    } else {
      trackEvent(ANALYTICS_KEYS.attachment_Downloaded, { selectedRecords: selectedRecords.length, sobjectName });
    }
  }

  return (
    <div>
      <div>
        {visible && (
          <div>
            <Tooltip content={disabled ? disabledReason : undefined}>
              <button className="slds-button slds-m-top_xx-small" disabled={!enabled || disabled} onClick={handleInitiateDownload}>
                <Icon type="doctype" icon="attachment" className="slds-button__icon slds-button__icon_left" omitContainer />
                Download Selected Attachments
              </button>
            </Tooltip>
          </div>
        )}
      </div>
      {modalOpen && (
        <Modal
          closeOnBackdropClick={false}
          closeOnEsc={false}
          onClose={() => handleModalClose(true)}
          header="Download Attachments"
          footer={
            <Fragment>
              <button className="slds-button slds-button_neutral" onClick={() => handleModalClose(true)}>
                Cancel
              </button>
              {!downloadAttachmentUrl && (
                <button className="slds-button slds-button_brand" disabled>
                  Download
                </button>
              )}
              {downloadAttachmentUrl && (
                <a href={downloadAttachmentUrl || ''} className="slds-button slds-button_brand" onClick={() => handleModalClose()}>
                  Download
                </a>
              )}
            </Fragment>
          }
        >
          {errorMessage && (
            <ScopedNotification theme="error" className="slds-m-top_medium">
              <p>{errorMessage}</p>
            </ScopedNotification>
          )}

          <p>You have selected {formatNumber(selectedRecords.length)} records to download content from.</p>
          <p>All of the files will be combined into one zip file.</p>
        </Modal>
      )}
    </div>
  );
};

export default QueryResultsAttachmentDownload;
