/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/react';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { formatNumber, getFilename, prepareCsvFile, prepareExcelFile, saveFile } from '@jetstream/shared/ui-utils';
import { flattenRecords } from '@jetstream/shared/utils';
import { FileExtCsv, FileExtCsvXLSXJson, FileExtJson, FileExtXLSX, MimeType, Record, SalesforceOrgUi } from '@jetstream/types';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import Input from '../form/input/Input';
import Radio from '../form/radio/Radio';
import RadioGroup from '../form/radio/RadioGroup';
import Modal from '../modal/Modal';
import {
  RADIO_ALL_BROWSER,
  RADIO_ALL_SERVER,
  RADIO_FILTERED,
  RADIO_FORMAT_CSV,
  RADIO_FORMAT_JSON,
  RADIO_FORMAT_XLSX,
  RADIO_SELECTED,
} from './download-modal-utils';

export interface RecordDownloadModalProps {
  org: SalesforceOrgUi;
  downloadModalOpen: boolean;
  fields: string[];
  records: Record[];
  filteredRecords?: Record[];
  selectedRecords?: Record[];
  totalRecordCount?: number;
  onModalClose: (cancelled?: boolean) => void;
  onDownloadFromServer?: (fileFormat: FileExtCsvXLSXJson, fileName: string) => void;
}

export const RecordDownloadModal: FunctionComponent<RecordDownloadModalProps> = ({
  org,
  downloadModalOpen,
  fields,
  records,
  filteredRecords,
  selectedRecords,
  totalRecordCount,
  onModalClose,
  onDownloadFromServer,
  children,
}) => {
  const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
  const [downloadRecordsValue, setDownloadRecordsValue] = useState<string>(hasMoreRecords ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
  const [fileFormat, setFileFormat] = useState<FileExtCsvXLSXJson>(RADIO_FORMAT_XLSX);
  const [fileName, setFileName] = useState<string>(getFilename(org, ['records']));
  // If the user changes the filename, we do not want to focus/select the text again or else the user cannot type
  const [doFocusInput, setDoFocusInput] = useState<boolean>(true);
  const inputEl = useRef<HTMLInputElement>();

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

  function downloadRecords() {
    // open modal
    try {
      const fileNameWithExt = `${fileName}.${fileFormat}`;
      if (downloadRecordsValue === RADIO_ALL_SERVER) {
        // emit event, which starts job, which downloads in the background
        if (onDownloadFromServer) {
          onDownloadFromServer(fileFormat, fileNameWithExt);
        }
        onModalClose();
      } else {
        let activeRecords = records;
        if (downloadRecordsValue === RADIO_FILTERED) {
          activeRecords = filteredRecords;
        } else if (downloadRecordsValue === RADIO_SELECTED) {
          activeRecords = selectedRecords;
        }
        const data = flattenRecords(activeRecords, fields);
        let mimeType: MimeType;
        let fileData;
        switch (fileFormat) {
          case 'xlsx': {
            fileData = prepareExcelFile(data, fields);
            mimeType = MIME_TYPES.XLSX;
            break;
          }
          case 'csv': {
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

        onModalClose();
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

  return (
    <Fragment>
      {downloadModalOpen && (
        <Modal
          header="Download Records"
          footer={
            <Fragment>
              <button className="slds-button slds-button_neutral" onClick={() => onModalClose(true)}>
                Cancel
              </button>
              <button className="slds-button slds-button_brand" onClick={downloadRecords}>
                Download
              </button>
            </Fragment>
          }
          skipAutoFocus
          onClose={() => onModalClose(true)}
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
            </RadioGroup>
            <Input label="Filename" isRequired rightAddon={`.${fileFormat}`}>
              <input
                ref={inputEl}
                id="download-filename"
                className="slds-input"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
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
