import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import {
  DownZipFile,
  formatNumber,
  getFilename,
  getOrgUrlParams,
  getZipDownloadUrl,
  initDownzip,
  isBrowserExtension,
  isDesktop,
  useNonInitialEffect,
  useRollbar,
} from '@jetstream/shared/ui-utils';
import {
  getErrorMessage,
  getErrorMessageAndStackObj,
  getRecordIdFromAttributes,
  REGEX,
  splitFilenameByExtension,
} from '@jetstream/shared/utils';
import { Maybe, SalesforceOrgUi, SalesforceRecord } from '@jetstream/types';
import { Icon, Modal, Radio, RadioGroup, ScopedNotification, Tooltip } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import z from 'zod';

const FileNameFormatSchema = z.enum(['name', 'id', 'nameAndId']);
type FileNameFormat = z.infer<typeof FileNameFormatSchema>;
const LS_KEY = 'query-attachment-download-filename-format';
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

function getFileName(sobjectName: string, record: SalesforceRecord, fileNameFormat: FileNameFormat) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { nameField, extensionField, titleField } = FILE_DOWNLOAD_FIELD_MAP.get(sobjectName)!;
  const recordId = record['Id'] || getRecordIdFromAttributes(record);
  const fileExtension = extensionField ? `.${record[extensionField]}` : splitFilenameByExtension(record[nameField])[1];
  if (!recordId) {
    fileNameFormat = 'name';
  }
  switch (fileNameFormat) {
    case 'name': {
      if (titleField && record[titleField]) {
        if (fileExtension) {
          return `${record[titleField]}${fileExtension}`;
        }
      }
      return record[nameField];
    }
    case 'id': {
      if (fileExtension) {
        return `${recordId}${fileExtension}`;
      }
      return recordId;
    }
    case 'nameAndId': {
      if (titleField && record[titleField]) {
        if (fileExtension) {
          return `${record[titleField]}-${recordId}${fileExtension}`;
        }
      }
      return `${record[nameField]}-${recordId}`;
    }
    default:
      return record[nameField];
  }
}

function getFile(selectedOrg: SalesforceOrgUi, sobjectName: string, record: SalesforceRecord, fileNameFormat: FileNameFormat): DownZipFile {
  sobjectName = sobjectName.toLowerCase();
  if (FILE_DOWNLOAD_FIELD_MAP.has(sobjectName)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { bodyField, sizeField } = FILE_DOWNLOAD_FIELD_MAP.get(sobjectName)!;
    let recordName = getFileName(sobjectName, record, fileNameFormat);

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

function getFileNamesWithoutDuplicates(
  org: SalesforceOrgUi,
  sobjectName: string,
  records: SalesforceRecord[],
  fileNameFormat: FileNameFormat,
): DownZipFile[] {
  return Object.values(
    records.reduce(
      (acc, record) => {
        const file = getFile(org, sobjectName, record, fileNameFormat);
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
      await initDownzip();
    } catch (ex) {
      logger.error('[ERROR] Initializing service worker failed!');
      logger.error(ex);
      setErrorMessage(
        'There was a problem initiating the download, your browser may not support this capability. Try refreshing the page and trying again.',
      );
      setDisabledReason(
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

      // Generate files and URL based on current format selection
      const files = getFileNamesWithoutDuplicates(selectedOrg, sobjectName, selectedRecords, fileNameFormat);
      const url = await getZipDownloadUrl(getFilename(selectedOrg, [sobjectName, 'files']), files);

      // Programmatically trigger download
      const link = document.createElement('a');
      link.href = url;
      link.click();

      // Close modal and track
      handleModalClose(false);
    } catch (ex) {
      logger.error('[ERROR] Attempting to get service worker url failed!');
      logger.error(ex);
      setErrorMessage('There was a problem initiating the download, your browser may not support this capability.');
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
              onChange={(value) => setFileNameFormat(value as 'name' | 'id' | 'nameAndId')}
              disabled={isDownloading}
            />
            <Radio
              id="file-format-id"
              name="file-format"
              label="Record Id"
              value="id"
              checked={fileNameFormat === 'id'}
              onChange={(value) => setFileNameFormat(value as 'name' | 'id' | 'nameAndId')}
              disabled={isDownloading}
            />
            <Radio
              id="file-format-name-and-id"
              name="file-format"
              label="Name or Title with Record Id appended"
              value="nameAndId"
              checked={fileNameFormat === 'nameAndId'}
              onChange={(value) => setFileNameFormat(value as 'name' | 'id' | 'nameAndId')}
              disabled={isDownloading}
            />
          </RadioGroup>
        </Modal>
      )}
    </div>
  );
};

export default QueryResultsAttachmentDownload;
