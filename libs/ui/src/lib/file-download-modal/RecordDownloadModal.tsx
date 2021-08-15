/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/react';
import { MIME_TYPES } from '@jetstream/shared/constants';
import {
  formatNumber,
  getFilename,
  GoogleApiData,
  isEnterKey,
  prepareCsvFile,
  prepareExcelFile,
  saveFile,
} from '@jetstream/shared/ui-utils';
import { flattenRecords } from '@jetstream/shared/utils';
import {
  FileExtCsv,
  FileExtCsvXLSXJsonGSheet,
  FileExtGSheet,
  FileExtJson,
  FileExtXLSX,
  MimeType,
  Record,
  SalesforceOrgUi,
} from '@jetstream/types';
import Grid from 'libs/ui/src/lib/grid/Grid';
import { Fragment, FunctionComponent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import FileDownloadGoogle from '../file-download-modal/options/FileDownloadGoogle';
import DuelingPicklist from '../form/dueling-picklist/DuelingPicklist';
import { DuelingPicklistItem } from '../form/dueling-picklist/DuelingPicklistTypes';
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
  RADIO_FORMAT_GSHEET,
  RADIO_FORMAT_JSON,
  RADIO_FORMAT_XLSX,
  RADIO_SELECTED,
} from './download-modal-utils';

export interface RecordDownloadModalProps {
  org: SalesforceOrgUi;
  google_apiKey: string;
  google_appId: string;
  google_clientId: string;
  downloadModalOpen: boolean;
  fields: string[];
  records: Record[];
  filteredRecords?: Record[];
  selectedRecords?: Record[];
  totalRecordCount?: number;
  onModalClose: (cancelled?: boolean) => void;
  onDownload?: (fileFormat: FileExtCsvXLSXJsonGSheet, fileName: string, userOverrideFields: boolean, googleFolderId?: string) => void;
  onDownloadFromServer?: (fileFormat: FileExtCsvXLSXJsonGSheet, fileName: string, fields: string[], googleFolderId?: string) => void;
}

export const RecordDownloadModal: FunctionComponent<RecordDownloadModalProps> = ({
  org,
  google_apiKey,
  google_appId,
  google_clientId,
  downloadModalOpen,
  fields = [],
  records,
  filteredRecords,
  selectedRecords,
  totalRecordCount,
  onModalClose,
  onDownload,
  onDownloadFromServer,
  children,
}) => {
  const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
  const [downloadRecordsValue, setDownloadRecordsValue] = useState<string>(hasMoreRecords ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
  const [fileFormat, setFileFormat] = useState<FileExtCsvXLSXJsonGSheet>(RADIO_FORMAT_XLSX);
  const [fileName, setFileName] = useState<string>(getFilename(org, ['records']));
  // If the user changes the filename, we do not want to focus/select the text again or else the user cannot type
  const [doFocusInput, setDoFocusInput] = useState<boolean>(true);
  const inputEl = useRef<HTMLInputElement>();

  const [googleApiData, setGoogleApiData] = useState<GoogleApiData>();
  const [googleFolder, setGoogleFolder] = useState<string>();

  const [whichFields, setWhichFields] = useState<'all' | 'specified'>('all');
  const [fieldOverrideFields, setFieldOverrideFields] = useState<DuelingPicklistItem[]>([]);
  const [fieldOverrideSelectedFields, setFieldOverrideSelectedFields] = useState<string[]>([]);

  const [invalidConfig, setInvalidConfig] = useState(false);
  const googleAuthorized = !!googleApiData?.authorized;

  useEffect(() => {
    if (!fileName || (fileFormat === 'gsheet' && !googleAuthorized)) {
      setInvalidConfig(true);
    } else {
      setInvalidConfig(false);
    }
  }, [fileName, fileFormat, googleAuthorized, googleFolder]);

  useEffect(() => {
    if (fields) {
      setFieldOverrideFields(fields.map((field) => ({ label: field, value: field })));
      setFieldOverrideSelectedFields([...fields]);
    } else {
      setFieldOverrideFields([]);
    }
  }, [fields]);

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
    }
  }, [downloadModalOpen, records]);

  useEffect(() => {
    if (doFocusInput && fileName && downloadModalOpen && inputEl.current) {
      inputEl.current.focus();
      inputEl.current.select();
      setDoFocusInput(false);
    }
  }, [fileName]);

  useEffect(() => {
    const hasMoreRecordsTemp = totalRecordCount && records && totalRecordCount > records.length;
    setHasMoreRecords(hasMoreRecordsTemp);
    setDownloadRecordsValue(hasMoreRecordsTemp ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
  }, [totalRecordCount, records]);

  function handleModalClose(cancelled?: boolean) {
    onModalClose(cancelled);
    if (whichFields !== 'all') {
      setWhichFields('all');
    }
    if (fields) {
      setFieldOverrideSelectedFields([...fields]);
    }
  }

  async function handleDownload() {
    const fieldsToUse = whichFields === 'all' ? fields : fieldOverrideSelectedFields;
    if (fieldsToUse.length === 0) {
      return;
    }
    try {
      const fileNameWithExt = `${fileName}${fileFormat !== 'gsheet' ? `.${fileFormat}` : ''}`;
      /** Google will always load in the background to account for upload to Google */
      if (fileFormat === 'gsheet' || downloadRecordsValue === RADIO_ALL_SERVER) {
        // emit event, which starts job, which downloads in the background
        if (onDownloadFromServer) {
          onDownloadFromServer(fileFormat, fileNameWithExt, fieldsToUse, googleFolder);
        }
        handleModalClose();
      } else {
        let activeRecords = records;
        if (downloadRecordsValue === RADIO_FILTERED) {
          activeRecords = filteredRecords;
        } else if (downloadRecordsValue === RADIO_SELECTED) {
          activeRecords = selectedRecords;
        }
        const data = flattenRecords(activeRecords, fieldsToUse);
        let mimeType: MimeType;
        let fileData;
        switch (fileFormat) {
          case 'xlsx': {
            fileData = prepareExcelFile(data, fieldsToUse);
            mimeType = MIME_TYPES.XLSX;
            break;
          }
          case 'csv': {
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
          onDownload(fileFormat, fileNameWithExt, whichFields === 'specified', googleFolder);
        }
        handleModalClose();
      }
    } catch (ex) {
      // TODO: show error message somewhere
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
              <Radio
                name="radio-download-file-format"
                label="Google Sheet"
                value={RADIO_FORMAT_GSHEET}
                checked={fileFormat === RADIO_FORMAT_GSHEET}
                onChange={(value: FileExtGSheet) => setFileFormat(value)}
              />
            </RadioGroup>
            {fileFormat === 'gsheet' && (
              <FileDownloadGoogle
                google_apiKey={google_apiKey}
                google_appId={google_appId}
                google_clientId={google_clientId}
                onFolderSelected={handleFolderSelected}
                onGoogleApiData={handleGoogleApiData}
              />
            )}
            <Input
              label="Filename"
              isRequired
              rightAddon={`.${fileFormat}`}
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
            {fileFormat !== 'json' && (
              <Fragment>
                <RadioGroup
                  label="Include Which Fields"
                  isButtonGroup
                  labelHelp="Use this to limit or change the order of the fields included in your downloaded file."
                >
                  <RadioButton
                    name="which-fields"
                    label="All Fields"
                    value="all"
                    checked={whichFields === 'all'}
                    onChange={(value) => setWhichFields('all')}
                  />
                  <RadioButton
                    name="which-fields"
                    label="Selected Fields"
                    value="specified"
                    checked={whichFields === 'specified'}
                    onChange={(value) => setWhichFields('specified')}
                  />
                </RadioGroup>
                {whichFields === 'specified' && (
                  <DuelingPicklist
                    label="Fields to include in download"
                    labelHelp="Use shift and ctrl/cmd to select multiple fields and ctrl/cmd + a to select all items."
                    isRequired
                    items={fieldOverrideFields}
                    initialSelectedItems={fieldOverrideSelectedFields}
                    labelLeft="Ignored Fields"
                    labelRight="Included Fields"
                    onChange={setFieldOverrideSelectedFields}
                  ></DuelingPicklist>
                )}
              </Fragment>
            )}
          </div>
        </Modal>
      )}
      {children}
    </Fragment>
  );
};

export default RecordDownloadModal;
