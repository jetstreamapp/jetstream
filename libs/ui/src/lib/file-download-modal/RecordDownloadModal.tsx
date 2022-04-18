/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { MIME_TYPES } from '@jetstream/shared/constants';
import {
  formatNumber,
  getFilename,
  GoogleApiData,
  isEnterKey,
  prepareCsvFile,
  prepareExcelFile,
  saveFile,
  useRollbar,
} from '@jetstream/shared/ui-utils';
import { flattenRecords, getMapOfBaseAndSubqueryRecords } from '@jetstream/shared/utils';
import {
  FileExtCsv,
  FileExtCsvXLSXJsonGSheet,
  FileExtGDrive,
  FileExtJson,
  FileExtXLSX,
  MapOf,
  MimeType,
  Record,
  SalesforceOrgUi,
} from '@jetstream/types';
import { Fragment, FunctionComponent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { PopoverErrorButton } from '../popover/PopoverErrorButton';
import FileDownloadGoogle from '../file-download-modal/options/FileDownloadGoogle';
import Checkbox from '../form/checkbox/Checkbox';
import Input from '../form/input/Input';
import Radio from '../form/radio/Radio';
import RadioButton from '../form/radio/RadioButton';
import RadioGroup from '../form/radio/RadioGroup';
import Modal from '../modal/Modal';
import {
  RADIO_ALL_BROWSER,
  RADIO_ALL_SERVER,
  RADIO_FILTERED,
  RADIO_FORMAT_CSV,
  RADIO_FORMAT_GDRIVE,
  RADIO_FORMAT_JSON,
  RADIO_FORMAT_XLSX,
  RADIO_SELECTED,
} from './download-modal-utils';
import { logger } from '@jetstream/shared/client-logger';

export interface RecordDownloadModalProps {
  org: SalesforceOrgUi;
  google_apiKey: string;
  google_appId: string;
  google_clientId: string;
  downloadModalOpen: boolean;
  fields: string[];
  modifiedFields: string[];
  subqueryFields?: MapOf<string[]>;
  records: Record[];
  filteredRecords?: Record[];
  selectedRecords?: Record[];
  totalRecordCount?: number;
  onModalClose: (cancelled?: boolean) => void;
  onDownload?: (fileFormat: FileExtCsvXLSXJsonGSheet, whichFields: 'all' | 'specified', includeSubquery: boolean) => void;
  onDownloadFromServer?: (options: {
    fileFormat: FileExtCsvXLSXJsonGSheet;
    fileName: string;
    fields: string[];
    subqueryFields: MapOf<string[]>;
    whichFields: 'all' | 'specified';
    includeSubquery: boolean;
    googleFolder?: string;
  }) => void;
  children?: React.ReactNode;
}

export const RecordDownloadModal: FunctionComponent<RecordDownloadModalProps> = ({
  org,
  google_apiKey,
  google_appId,
  google_clientId,
  downloadModalOpen,
  fields = [],
  modifiedFields = [],
  subqueryFields = {},
  records,
  filteredRecords,
  selectedRecords,
  totalRecordCount,
  onModalClose,
  onDownload,
  onDownloadFromServer,
  children,
}) => {
  const rollbar = useRollbar();
  const hasGoogleInputConfigured = !!google_apiKey && !!google_appId && !!google_clientId;
  const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
  const [downloadRecordsValue, setDownloadRecordsValue] = useState<string>(hasMoreRecords ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
  const [fileFormat, setFileFormat] = useState<FileExtCsvXLSXJsonGSheet>(RADIO_FORMAT_XLSX);
  const [includeSubquery, setIncludeSubquery] = useState(true);
  const [fileName, setFileName] = useState<string>(getFilename(org, ['records']));
  const [columnAreModified, setColumnsAreModified] = useState(false);
  // If the user changes the filename, we do not want to focus/select the text again or else the user cannot type
  const [doFocusInput, setDoFocusInput] = useState<boolean>(true);
  const inputEl = useRef<HTMLInputElement>();

  const [googleApiData, setGoogleApiData] = useState<GoogleApiData>();
  const [googleFolder, setGoogleFolder] = useState<string>();

  const [whichFields, setWhichFields] = useState<'all' | 'specified'>('specified');

  const [invalidConfig, setInvalidConfig] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const googleAuthorized = !!googleApiData?.authorized;

  const hasSubqueryFields = subqueryFields && !!Object.keys(subqueryFields).length && (fileFormat === 'xlsx' || fileFormat === 'gdrive');

  useEffect(() => {
    if (fields !== modifiedFields && fields && modifiedFields) {
      setColumnsAreModified(fields.some((field, i) => field !== modifiedFields[i]));
    }
  }, [fields, modifiedFields]);

  useEffect(() => {
    if (!fileName || (fileFormat === 'gdrive' && !googleAuthorized)) {
      setInvalidConfig(true);
    } else {
      setInvalidConfig(false);
    }
  }, [fileName, fileFormat, googleAuthorized, googleFolder]);

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
    const hasMoreRecordsTemp = totalRecordCount && records && totalRecordCount > records.length;
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
    if (errorMessage) {
      setErrorMessage(null);
    }
    const fieldsToUse = whichFields === 'specified' ? modifiedFields : fields;
    if (fieldsToUse.length === 0) {
      return;
    }
    try {
      const fileNameWithExt = `${fileName}${fileFormat !== 'gdrive' ? `.${fileFormat}` : ''}`;
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
            includeSubquery: includeSubquery && hasSubqueryFields,
            googleFolder,
          });
        }
        handleModalClose();
      } else {
        let activeRecords = records;
        if (downloadRecordsValue === RADIO_FILTERED) {
          activeRecords = filteredRecords;
        } else if (downloadRecordsValue === RADIO_SELECTED) {
          activeRecords = selectedRecords;
        }

        let mimeType: MimeType;
        let fileData;
        switch (fileFormat) {
          case 'xlsx': {
            let data: MapOf<any[]> = {};

            if (includeSubquery && hasSubqueryFields) {
              data = getMapOfBaseAndSubqueryRecords(activeRecords, fieldsToUse, subqueryFields);
            } else {
              data['records'] = flattenRecords(activeRecords, fieldsToUse);
            }

            fileData = prepareExcelFile(data);
            mimeType = MIME_TYPES.XLSX;
            break;
          }
          case 'csv': {
            const data = flattenRecords(activeRecords, fieldsToUse);
            fileData = prepareCsvFile(data, fieldsToUse);
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

  function handleGoogleApiData(apiData: GoogleApiData) {
    setGoogleApiData(apiData);
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
        >
          <div>
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
                  label={`Filtered records (${formatNumber(filteredRecords.length) || 0})`}
                  value={RADIO_FILTERED}
                  checked={downloadRecordsValue === RADIO_FILTERED}
                  onChange={setDownloadRecordsValue}
                />
              )}
              {hasSelectedRecords() && (
                <Radio
                  name="radio-download"
                  label={`Selected records (${formatNumber(selectedRecords.length) || 0})`}
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
              />
              {hasGoogleInputConfigured && (
                <Radio
                  name="radio-download-file-format"
                  label="Google Drive"
                  value={RADIO_FORMAT_GDRIVE}
                  checked={fileFormat === RADIO_FORMAT_GDRIVE}
                  onChange={(value: FileExtGDrive) => setFileFormat(value)}
                />
              )}
              {fileFormat === 'gdrive' && (
                <FileDownloadGoogle
                  google_apiKey={google_apiKey}
                  google_appId={google_appId}
                  google_clientId={google_clientId}
                  onFolderSelected={handleFolderSelected}
                  onGoogleApiData={handleGoogleApiData}
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
            {fileFormat !== 'json' && columnAreModified && (
              <RadioGroup
                label="Include Which Fields"
                isButtonGroup
                labelHelp="With Current table view, the downloaded file will match the modifications you made to the table columns."
              >
                <RadioButton
                  name="which-fields"
                  label="Current table view"
                  value="specified"
                  checked={whichFields === 'specified'}
                  onChange={(value) => setWhichFields('specified')}
                />
                <RadioButton
                  name="which-fields"
                  label="Original table view"
                  value="all"
                  checked={whichFields === 'all'}
                  onChange={(value) => setWhichFields('all')}
                />
              </RadioGroup>
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
