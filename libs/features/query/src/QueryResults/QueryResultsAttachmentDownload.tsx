import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, MAX_BINARY_DOWNLOAD_RECORDS } from '@jetstream/shared/constants';
import { downloadBinaryAttachmentsZip_WEB_EXTENSION } from '@jetstream/shared/data';
import {
  formatNumber,
  getFilename,
  getOrgUrlParams,
  isBrowserExtension,
  isDesktop,
  saveFile,
  useNonInitialEffect,
  useRollbar,
} from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj, getRecordIdFromAttributes } from '@jetstream/shared/utils';
import { AsyncJobNew, BinaryDownloadCompatibleObjectsSchema, Maybe, SalesforceOrgUi, SalesforceRecord } from '@jetstream/types';
import { Icon, Modal, Radio, RadioGroup, ScopedNotification, Tooltip } from '@jetstream/ui';
import { fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import z from 'zod';

const FileNameFormatSchema = z.enum(['name', 'id', 'nameAndId']);
type FileNameFormat = z.infer<typeof FileNameFormatSchema>;

const LS_KEY = 'query-attachment-download-filename-format';
export interface QueryResultsAttachmentDownloadProps {
  selectedOrg: SalesforceOrgUi;
  enabled: boolean;
  sobjectName: Maybe<string>;
  selectedRecords: SalesforceRecord[];
  hasRecords: boolean;
}

export const binaryCompatibleObjects = new Set(Object.keys(BinaryDownloadCompatibleObjectsSchema.enum));

export const QueryResultsAttachmentDownload: FunctionComponent<QueryResultsAttachmentDownloadProps> = ({
  selectedOrg,
  enabled,
  sobjectName,
  selectedRecords,
  hasRecords,
}) => {
  sobjectName = sobjectName?.toLowerCase() || null;
  const rollbar = useRollbar();
  const { trackEvent } = useAmplitude();
  const [modalOpen, setModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [disabledReason, setDisabledReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileNameFormat, setFileNameFormat] = useState<FileNameFormat>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        return FileNameFormatSchema.parse(stored);
      }
    } catch {
      // ignore
    }
    return 'name';
  });

  useNonInitialEffect(() => {
    try {
      localStorage.setItem(LS_KEY, fileNameFormat);
    } catch {
      // ignore
    }
  }, [fileNameFormat]);

  useEffect(() => {
    setVisible(binaryCompatibleObjects.has(sobjectName?.toLowerCase() || '') && hasRecords);
    if (selectedRecords.length && selectedRecords.length <= 500) {
      setDisabled(false);
      setDisabledReason('');
    } else if (selectedRecords.length > MAX_BINARY_DOWNLOAD_RECORDS) {
      setDisabled(true);
      setDisabledReason(`You can select up to ${formatNumber(MAX_BINARY_DOWNLOAD_RECORDS)} records at a time for attachment download`);
    } else {
      setDisabled(true);
      setDisabledReason('Select one or more records');
    }
  }, [sobjectName, selectedRecords, trackEvent, hasRecords]);

  useEffect(() => {
    if (visible) {
      trackEvent(ANALYTICS_KEYS.attachment_QueriedEligibleObject, { sobjectName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackEvent, visible]);

  async function handleOpenModal() {
    try {
      if (!sobjectName) {
        return;
      }
      trackEvent(ANALYTICS_KEYS.attachment_ModalOpened, { selectedRecords: selectedRecords.length, sobjectName });
      setDisabledReason('');
      setErrorMessage(null);
      setIsDownloading(false);
      setModalOpen(true);
    } catch (ex) {
      logger.error('[ERROR] Initializing service worker failed!');
      logger.error(ex);
      setErrorMessage(
        'There was a problem initiating the download, your browser may not support this capability. Try refreshing the page and trying again.',
      );
      trackEvent(ANALYTICS_KEYS.attachment_Error, { selectedRecords: selectedRecords.length, sobjectName, error: getErrorMessage(ex) });
      rollbar.error('Error initiating zip download', getErrorMessageAndStackObj(ex));
    }
  }

  async function handleDownload() {
    try {
      if (!sobjectName) {
        return;
      }
      setIsDownloading(true);
      setErrorMessage(null);

      const fileName = `${getFilename(selectedOrg, [sobjectName])}.zip`;

      // Desktop app: create a background job for download
      if (isDesktop() && window.electronAPI?.downloadZipToFile) {
        try {
          // Create a background job for the download - actual download happens in the job worker
          const newJob: AsyncJobNew = {
            type: 'DesktopFileDownload',
            title: `Download ${formatNumber(selectedRecords.length)} Attachment${selectedRecords.length === 1 ? '' : 's'}`,
            org: selectedOrg,
            meta: {
              sobjectName,
              recordIds: selectedRecords.map((record) => record['Id'] || getRecordIdFromAttributes(record)),
              fileName,
              nameFormat: fileNameFormat,
            },
          };

          // Emit the job to the job system
          fromJetstreamEvents.emit({ type: 'newJob', payload: [newJob] });

          // Close modal immediately - user can track progress in jobs panel
          handleModalClose(false);
        } catch (ex) {
          logger.error('[ERROR] Desktop download failed!');
          logger.error(ex);
          trackEvent(ANALYTICS_KEYS.attachment_Error, { selectedRecords: selectedRecords.length, sobjectName, error: getErrorMessage(ex) });
          rollbar.error('Error in desktop zip download', getErrorMessageAndStackObj(ex));
        }
      } else if (isBrowserExtension()) {
        // For browser extension, we fetch the data and save the file directly (streaming download not supported)
        const response = await downloadBinaryAttachmentsZip_WEB_EXTENSION(selectedOrg, {
          fileName,
          sobject: sobjectName.toLowerCase(),
          recordIds: selectedRecords.map((record) => record['Id'] || getRecordIdFromAttributes(record)),
          nameFormat: fileNameFormat,
        });
        saveFile(response, fileName, 'application/zip;charset=utf-8');
        handleModalClose(false);
      } else {
        // Web app: download so that the browser streams the file directly to get progress indication from the browser
        const url = `/api/file/stream-download/zip?${getOrgUrlParams(selectedOrg, {
          sobject: sobjectName.toLowerCase(),
          recordIds: selectedRecords.map((record) => record['Id'] || getRecordIdFromAttributes(record)).join(','),
          nameFormat: fileNameFormat,
          fileName,
        })}`;

        // Programmatically trigger download
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.download = fileName;
        link.click();

        handleModalClose(false);
      }
    } catch (ex) {
      logger.error('[ERROR] Attempting to download failed!');
      logger.error(ex);
      setErrorMessage('There was a problem initiating the download.');
      setIsDownloading(false);
      trackEvent(ANALYTICS_KEYS.attachment_Error, { selectedRecords: selectedRecords.length, sobjectName, error: getErrorMessage(ex) });
      rollbar.error('Error initiating zip download', getErrorMessageAndStackObj(ex));
    }
  }

  function handleModalClose(cancel?: boolean) {
    setModalOpen(false);
    setIsDownloading(false);
    if (cancel) {
      trackEvent(ANALYTICS_KEYS.attachment_Canceled, { selectedRecords: selectedRecords.length, sobjectName });
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
              <button className="slds-button slds-m-top_xx-small" disabled={!enabled || disabled} onClick={handleOpenModal}>
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
              <button className="slds-button slds-button_neutral" onClick={() => handleModalClose(true)} disabled={isDownloading}>
                Cancel
              </button>
              <button className="slds-button slds-button_brand" onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? 'Preparing Download...' : 'Download'}
              </button>
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
          <RadioGroup
            label="How would you like each file to be named?"
            labelHelp="Choose the format for the filename of each downloaded file. If two files have the same name, a number will be appended to make them unique."
            required
          >
            <Radio
              id="file-format-name"
              name="file-format"
              label="Name or Title"
              value="name"
              checked={fileNameFormat === 'name'}
              onChange={(value) => setFileNameFormat(value as FileNameFormat)}
              disabled={isDownloading}
            />
            <Radio
              id="file-format-id"
              name="file-format"
              label="Record Id"
              value="id"
              checked={fileNameFormat === 'id'}
              onChange={(value) => setFileNameFormat(value as FileNameFormat)}
              disabled={isDownloading}
            />
            <Radio
              id="file-format-name-and-id"
              name="file-format"
              label="Name or Title with Record Id appended"
              value="nameAndId"
              checked={fileNameFormat === 'nameAndId'}
              onChange={(value) => setFileNameFormat(value as FileNameFormat)}
              disabled={isDownloading}
            />
          </RadioGroup>
        </Modal>
      )}
    </div>
  );
};

export default QueryResultsAttachmentDownload;
