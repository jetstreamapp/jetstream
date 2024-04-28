/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { formatNumber, getFilename, isEnterKey, prepareCsvFile, prepareExcelFile, saveFile, useRollbar } from '@jetstream/shared/ui-utils';
import { flattenRecords, getMapOfBaseAndSubqueryRecords } from '@jetstream/shared/utils';
import {
  FileExtCsv,
  FileExtCsvXLSXJsonGSheet,
  FileExtGDrive,
  FileExtJson,
  FileExtXLSX,
  Maybe,
  MimeType,
  QueryResultsColumn,
  SalesforceOrgUi,
  SalesforceRecord,
} from '@jetstream/types';
import { Fragment, FunctionComponent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import FileDownloadGoogle from '../file-download-modal/options/FileDownloadGoogle';
import Checkbox from '../form/checkbox/Checkbox';
import Input from '../form/input/Input';
import Radio from '../form/radio/Radio';
import RadioGroup from '../form/radio/RadioGroup';
import Modal from '../modal/Modal';
import { PopoverErrorButton } from '../popover/PopoverErrorButton';
import ScopedNotification from '../scoped-notification/ScopedNotification';
import {
  RADIO_ALL_BROWSER,
  RADIO_ALL_SERVER,
  RADIO_DOWNLOAD_METHOD_BULK_API,
  RADIO_DOWNLOAD_METHOD_STANDARD,
  RADIO_FILTERED,
  RADIO_FORMAT_CSV,
  RADIO_FORMAT_GDRIVE,
  RADIO_FORMAT_JSON,
  RADIO_FORMAT_XLSX,
  RADIO_SELECTED,
} from './download-modal-utils';

export interface DownloadFromServerOpts {
  fileFormat: FileExtCsvXLSXJsonGSheet;
  fileName: string;
  fields: string[];
  subqueryFields: Record<string, string[]>;
  whichFields: 'all' | 'specified';
  includeSubquery: boolean;
  /**
   * If downloading from server, this will be the first set of records
   * If uploading to gdrive, this will be the records to include or the first set of records depending on the option selected
   */
  recordsToInclude?: any[];
  /** Only applies if fileFormat === 'gdrive', indicates to ignore nextRecords if there are any */
  hasAllRecords: boolean;
  googleFolder?: Maybe<string>;
  includeDeletedRecords: boolean;
  useBulkApi: boolean; // FIXME: made req to see where used
}

export interface RecordDownloadModalProps {
  org: SalesforceOrgUi;
  google_apiKey: string;
  google_appId: string;
  google_clientId: string;
  downloadModalOpen: boolean;
  columns?: QueryResultsColumn[];
  fields: string[];
  subqueryFields?: Record<string, string[]>;
  records: SalesforceRecord[];
  filteredRecords?: SalesforceRecord[];
  selectedRecords?: SalesforceRecord[];
  totalRecordCount?: number;
  includeDeletedRecords?: boolean;
  onModalClose: (cancelled?: boolean) => void;
  onDownload?: (fileFormat: FileExtCsvXLSXJsonGSheet, whichFields: 'all' | 'specified', includeSubquery: boolean) => void;
  onDownloadFromServer?: (options: DownloadFromServerOpts) => void;
  children?: React.ReactNode;
}

const PROHIBITED_BULK_APEX_TYPES = new Set(['Address', 'Location', 'complexvaluetype']);
const ALLOW_BULK_API_COUNT = 5_000;
const REQUIRE_BULK_API_COUNT = 500_000;

export const RecordDownloadModal: FunctionComponent<RecordDownloadModalProps> = ({
  org,
  google_apiKey,
  google_appId,
  google_clientId,
  downloadModalOpen,
  columns = [],
  fields = [],
  subqueryFields = {},
  records = [],
  filteredRecords,
  selectedRecords,
  totalRecordCount,
  includeDeletedRecords = false,
  onModalClose,
  onDownload,
  onDownloadFromServer,
  children,
}) => {
  const rollbar = useRollbar();
  const hasGoogleInputConfigured = !!google_apiKey && !!google_appId && !!google_clientId && !!onDownloadFromServer;
  const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
  const [downloadRecordsValue, setDownloadRecordsValue] = useState<string>(hasMoreRecords ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
  const [fileFormat, setFileFormat] = useState<FileExtCsvXLSXJsonGSheet>(RADIO_FORMAT_XLSX);
  const [downloadMethod, setDownloadMethod] = useState<typeof RADIO_DOWNLOAD_METHOD_STANDARD | typeof RADIO_DOWNLOAD_METHOD_BULK_API>(
    RADIO_DOWNLOAD_METHOD_STANDARD
  );
  const [includeSubquery, setIncludeSubquery] = useState(true);
  const [fileName, setFileName] = useState<string>(getFilename(org, ['records']));
  // If the user changes the filename, we do not want to focus/select the text again or else the user cannot type
  const [doFocusInput, setDoFocusInput] = useState<boolean>(true);
  const inputEl = useRef<HTMLInputElement>(null);

  const [isSignedInWithGoogle, setIsSignedInWithGoogle] = useState<boolean>(false);
  const [googleFolder, setGoogleFolder] = useState<Maybe<string>>(null);

  const [whichFields, setWhichFields] = useState<'all' | 'specified'>('specified');

  const [invalidConfig, setInvalidConfig] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isGooglePickerVisible, setIsGooglePickerVisible] = useState(false);

  const hasSubqueryFields = subqueryFields && !!Object.keys(subqueryFields).length && (fileFormat === 'xlsx' || fileFormat === 'gdrive');

  const allowBulkApi =
    (totalRecordCount || 0) >= ALLOW_BULK_API_COUNT &&
    !Object.keys(subqueryFields).length &&
    records?.[0]?.attributes?.type !== 'AggregateResult' &&
    !columns.some((column) => PROHIBITED_BULK_APEX_TYPES.has(column.apexType || '')) &&
    downloadRecordsValue === RADIO_ALL_SERVER;

  const allowBulkApiWithWarning =
    !allowBulkApi &&
    (totalRecordCount || 0) >= ALLOW_BULK_API_COUNT &&
    records?.[0]?.attributes?.type !== 'AggregateResult' &&
    downloadRecordsValue === RADIO_ALL_SERVER;

  const requireBulkApi = allowBulkApiWithWarning && (totalRecordCount || 0) >= REQUIRE_BULK_API_COUNT;
  const isBulkApi = downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API;

  useEffect(() => {
    if (requireBulkApi) {
      setFileFormat(RADIO_FORMAT_CSV);
      setDownloadMethod(RADIO_DOWNLOAD_METHOD_BULK_API);
    }
  }, [requireBulkApi, downloadRecordsValue]);

  useEffect(() => {
    if (isBulkApi) {
      setFileFormat(RADIO_FORMAT_CSV);
    }
  }, [isBulkApi]);

  useEffect(() => {
    if (!fileName || (fileFormat === 'gdrive' && !isSignedInWithGoogle)) {
      setInvalidConfig(true);
    } else {
      setInvalidConfig(false);
    }
  }, [fileName, fileFormat, googleFolder, isSignedInWithGoogle]);

  useEffect(() => {
    if (downloadModalOpen) {
      setDoFocusInput(true);
      if (records.length > 0 && records[0].attributes && records[0].attributes.type) {
        setFileName(getFilename(org, ['records', records[0].attributes.type]));
      } else {
        setFileName(getFilename(org, ['records']));
      }
    } else {
      setDownloadRecordsValue(hasMoreRecords ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
      setFileFormat(RADIO_FORMAT_XLSX);
      setIncludeSubquery(true);
    }
  }, [downloadModalOpen, hasMoreRecords, org, records]);

  useEffect(() => {
    if (doFocusInput && fileName && downloadModalOpen && inputEl.current) {
      inputEl.current.focus();
      inputEl.current.select();
      setDoFocusInput(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName]);

  useEffect(() => {
    const hasMoreRecordsTemp = !!totalRecordCount && !!records && totalRecordCount > records.length;
    setHasMoreRecords(hasMoreRecordsTemp);
    setDownloadRecordsValue(hasMoreRecordsTemp ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
  }, [totalRecordCount, records]);

  function handleModalClose(cancelled?: boolean) {
    onModalClose(cancelled);
    if (whichFields !== 'specified') {
      setWhichFields('specified');
    }
  }

  async function handleDownload() {
    errorMessage && setErrorMessage(null);
    let fieldsToUse = fields;
    if (fieldsToUse.length === 0) {
      return;
    }

    let _includeSubquery = includeSubquery && hasSubqueryFields;

    // Remove invalid fields from query if necessary for bulk query
    if (downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API && allowBulkApiWithWarning) {
      const complexFields = new Set(
        columns.filter((column) => PROHIBITED_BULK_APEX_TYPES.has(column.apexType || '')).map(({ columnFullPath }) => columnFullPath)
      );
      fieldsToUse = fieldsToUse.filter((field) => !subqueryFields[field] && !complexFields.has(field));
      _includeSubquery = false;
    }

    try {
      const fileNameWithExt = `${fileName}${fileFormat !== 'gdrive' ? `.${fileFormat}` : ''}`;

      let activeRecords = records;
      if (downloadRecordsValue === RADIO_FILTERED) {
        activeRecords = filteredRecords || [];
      } else if (downloadRecordsValue === RADIO_SELECTED) {
        activeRecords = selectedRecords || [];
      }

      /** Google will always load in the background to account for upload to Google */
      if (fileFormat === 'gdrive' || downloadRecordsValue === RADIO_ALL_SERVER) {
        // emit event, which starts job, which downloads in the background
        if (onDownloadFromServer) {
          onDownloadFromServer({
            fileFormat,
            fileName: fileNameWithExt,
            fields: fieldsToUse,
            subqueryFields,
            whichFields,
            includeSubquery: _includeSubquery,
            recordsToInclude: activeRecords,
            hasAllRecords: downloadRecordsValue !== RADIO_ALL_SERVER,
            googleFolder,
            includeDeletedRecords,
            useBulkApi: downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API,
          });
        }
        handleModalClose();
      } else {
        let mimeType: MimeType;
        let fileData;
        switch (fileFormat) {
          case 'xlsx': {
            let data: Record<string, any[]> = {};

            if (includeSubquery && hasSubqueryFields) {
              data = getMapOfBaseAndSubqueryRecords(activeRecords, fields, subqueryFields);
            } else {
              data['records'] = flattenRecords(activeRecords, fields);
            }

            fileData = prepareExcelFile(data);
            mimeType = MIME_TYPES.XLSX;
            break;
          }
          case 'csv': {
            const data = flattenRecords(activeRecords, fields);
            fileData = prepareCsvFile(data, fields);
            mimeType = MIME_TYPES.CSV;
            break;
          }
          case 'json': {
            fileData = JSON.stringify(activeRecords, null, 2);
            mimeType = MIME_TYPES.JSON;
            break;
          }
          default:
            throw new Error('A valid file type type has not been selected');
        }

        saveFile(fileData, fileNameWithExt, mimeType);

        if (onDownload) {
          onDownload(fileFormat, whichFields, includeSubquery && hasSubqueryFields);
        }
        handleModalClose();
      }
    } catch (ex) {
      // TODO: show error message somewhere
      logger.error('Error downloading file', ex);
      rollbar.error('Record download error', { message: ex.message, stack: ex.stack });
      setErrorMessage('There was a problem preparing your file download.');
    }
  }

  function hasFilteredRecords(): boolean {
    return Array.isArray(filteredRecords) && filteredRecords.length && filteredRecords.length !== records.length ? true : false;
  }

  function hasSelectedRecords(): boolean {
    return Array.isArray(selectedRecords) && selectedRecords.length && selectedRecords.length !== records.length ? true : false;
  }

  function handleKeyUp(event: KeyboardEvent<HTMLElement>) {
    if (isEnterKey(event) && !invalidConfig) {
      handleDownload();
    }
  }

  function handleFolderSelected(folderId: string) {
    setGoogleFolder(folderId);
  }

  return (
    <Fragment>
      {downloadModalOpen && (
        <Modal
          header="Download Records"
          footer={
            <Fragment>
              {errorMessage && (
                <span className="slds-text-align_left d-inline-block">
                  <PopoverErrorButton errors={errorMessage} omitPortal />
                </span>
              )}
              <button className="slds-button slds-button_neutral" onClick={() => handleModalClose(true)}>
                Cancel
              </button>
              <button className="slds-button slds-button_brand" onClick={handleDownload} disabled={invalidConfig}>
                Download
              </button>
            </Fragment>
          }
          skipAutoFocus
          overrideZIndex={1001}
          onClose={() => handleModalClose(true)}
          hide={isGooglePickerVisible}
        >
          <div>
            {requireBulkApi && (
              <ScopedNotification theme="info">
                Because of the record volume, your download will use the Salesforce Bulk API and is limited to CSV.
              </ScopedNotification>
            )}
            <RadioGroup label="Which Records" required className="slds-m-bottom_small">
              {hasMoreRecords && (
                <Fragment>
                  <Radio
                    name="radio-download"
                    label={`All records (${formatNumber(totalRecordCount || records.length)})`}
                    value={RADIO_ALL_SERVER}
                    checked={downloadRecordsValue === RADIO_ALL_SERVER}
                    onChange={setDownloadRecordsValue}
                  />
                  <Radio
                    name="radio-download"
                    label={`First set of records (${formatNumber(records.length)})`}
                    value={RADIO_ALL_BROWSER}
                    checked={downloadRecordsValue === RADIO_ALL_BROWSER}
                    onChange={setDownloadRecordsValue}
                  />
                </Fragment>
              )}
              {!hasMoreRecords && (
                <Radio
                  name="radio-download"
                  label={`All records (${formatNumber(totalRecordCount || records.length)})`}
                  value={RADIO_ALL_BROWSER}
                  checked={downloadRecordsValue === RADIO_ALL_BROWSER}
                  onChange={setDownloadRecordsValue}
                />
              )}
              {hasFilteredRecords() && (
                <Radio
                  name="radio-download"
                  label={`Filtered records (${formatNumber(filteredRecords?.length || 0)})`}
                  value={RADIO_FILTERED}
                  checked={downloadRecordsValue === RADIO_FILTERED}
                  onChange={setDownloadRecordsValue}
                />
              )}
              {hasSelectedRecords() && (
                <Radio
                  name="radio-download"
                  label={`Selected records (${formatNumber(selectedRecords?.length || 0)})`}
                  value={RADIO_SELECTED}
                  checked={downloadRecordsValue === RADIO_SELECTED}
                  onChange={setDownloadRecordsValue}
                />
              )}
            </RadioGroup>
            <RadioGroup label="File Format" required className="slds-m-bottom_small">
              <Radio
                name="radio-download-file-format"
                label="Excel"
                value={RADIO_FORMAT_XLSX}
                checked={fileFormat === RADIO_FORMAT_XLSX}
                onChange={(value: FileExtXLSX) => setFileFormat(value)}
                disabled={isBulkApi}
              />
              <Radio
                name="radio-download-file-format"
                label="CSV"
                value={RADIO_FORMAT_CSV}
                checked={fileFormat === RADIO_FORMAT_CSV}
                onChange={(value: FileExtCsv) => setFileFormat(value)}
              />
              <Radio
                name="radio-download-file-format"
                label="JSON"
                value={RADIO_FORMAT_JSON}
                checked={fileFormat === RADIO_FORMAT_JSON}
                onChange={(value: FileExtJson) => setFileFormat(value)}
                disabled={isBulkApi}
              />
              {hasGoogleInputConfigured && (
                <Radio
                  name="radio-download-file-format"
                  label="Google Drive"
                  value={RADIO_FORMAT_GDRIVE}
                  checked={fileFormat === RADIO_FORMAT_GDRIVE}
                  onChange={(value: FileExtGDrive) => setFileFormat(value)}
                  disabled={isBulkApi}
                />
              )}
              {fileFormat === 'gdrive' && (
                <FileDownloadGoogle
                  google_apiKey={google_apiKey}
                  google_appId={google_appId}
                  google_clientId={google_clientId}
                  onFolderSelected={handleFolderSelected}
                  onSignInChanged={setIsSignedInWithGoogle}
                  onSelectorVisible={setIsGooglePickerVisible}
                />
              )}
            </RadioGroup>
            {hasSubqueryFields && (
              <Checkbox
                id="subquery-checkbox"
                className="slds-m-vertical_x-small"
                label="Create a worksheet for each subquery"
                checked={includeSubquery}
                onChange={setIncludeSubquery}
              />
            )}
            {allowBulkApi && (
              <RadioGroup
                label="Download Method"
                required
                className="slds-m-bottom_small"
                labelHelp="The Bulk API handles large record volumes but has limitations in file format and query support."
              >
                <Radio
                  name="radio-download-method"
                  label="Standard"
                  value={RADIO_DOWNLOAD_METHOD_STANDARD}
                  checked={downloadMethod === RADIO_DOWNLOAD_METHOD_STANDARD}
                  onChange={(value: typeof RADIO_DOWNLOAD_METHOD_STANDARD) => setDownloadMethod(value)}
                  disabled={requireBulkApi}
                />
                <Radio
                  name="radio-download-method"
                  label="Salesforce Bulk API"
                  value={RADIO_DOWNLOAD_METHOD_BULK_API}
                  checked={downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API}
                  onChange={(value: typeof RADIO_DOWNLOAD_METHOD_BULK_API) => setDownloadMethod(value)}
                  disabled={requireBulkApi}
                />
              </RadioGroup>
            )}
            {allowBulkApiWithWarning && (
              <>
                <RadioGroup
                  label="Download Method"
                  required
                  className="slds-m-bottom_small"
                  labelHelp="The Bulk API handles large record volumes but has limitations in file format and query support."
                >
                  <Radio
                    name="radio-download-method"
                    label="Standard"
                    value={RADIO_DOWNLOAD_METHOD_STANDARD}
                    checked={downloadMethod === RADIO_DOWNLOAD_METHOD_STANDARD}
                    onChange={(value: typeof RADIO_DOWNLOAD_METHOD_STANDARD) => setDownloadMethod(value)}
                    disabled={requireBulkApi}
                  />
                  <Radio
                    name="radio-download-method"
                    label="Salesforce Bulk API"
                    value={RADIO_DOWNLOAD_METHOD_BULK_API}
                    checked={downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API}
                    onChange={(value: typeof RADIO_DOWNLOAD_METHOD_BULK_API) => setDownloadMethod(value)}
                    disabled={requireBulkApi}
                  />
                </RadioGroup>
                {downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API && (
                  <ScopedNotification theme="warning">
                    Complex fields, including addresses and subqueries, will be automatically removed from your download.
                  </ScopedNotification>
                )}
              </>
            )}
            <Input
              label="Filename"
              isRequired
              rightAddon={fileFormat !== RADIO_FORMAT_GDRIVE ? `.${fileFormat}` : undefined}
              errorMessage="This field is required"
              errorMessageId="filename-error"
            >
              <input
                ref={inputEl}
                id="download-filename"
                className="slds-input"
                value={fileName}
                minLength={1}
                maxLength={250}
                onChange={(event) => setFileName(event.target.value)}
                onKeyUp={handleKeyUp}
              />
            </Input>
          </div>
        </Modal>
      )}
      {children}
    </Fragment>
  );
};

export default RecordDownloadModal;
