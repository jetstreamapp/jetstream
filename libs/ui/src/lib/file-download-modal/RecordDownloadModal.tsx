/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { getFilename, prepareCsvFile, prepareExcelFile, saveFile } from '@jetstream/shared/ui-utils';
import { flattenRecords } from '@jetstream/shared/utils';
import { FileExtCsv, FileExtCsvXLSX, FileExtXLSX, MimeType, Record, SalesforceOrgUi } from '@jetstream/types';
import numeral from 'numeral';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import Input from '../form/input/Input';
import Radio from '../form/radio/Radio';
import RadioGroup from '../form/radio/RadioGroup';
import Modal from '../modal/Modal';
import { RADIO_ALL_BROWSER, RADIO_ALL_SERVER, RADIO_FORMAT_CSV, RADIO_FORMAT_XLSX, RADIO_SELECTED } from './download-modal-utils';

export interface RecordDownloadModalProps {
  org: SalesforceOrgUi;
  downloadModalOpen: boolean;
  fields: string[];
  records: Record[];
  selectedRecords?: Record[];
  totalRecordCount?: number;
  onModalClose: (cancelled?: boolean) => void;
  onDownloadFromServer?: (fileFormat: FileExtCsvXLSX, fileName: string) => void;
}

export const RecordDownloadModal: FunctionComponent<RecordDownloadModalProps> = ({
  org,
  downloadModalOpen,
  fields,
  records,
  selectedRecords,
  totalRecordCount,
  onModalClose,
  onDownloadFromServer,
  children,
}) => {
  const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
  const [downloadRecordsValue, setDownloadRecordsValue] = useState<string>(hasMoreRecords ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
  const [fileFormat, setFileFormat] = useState<FileExtCsvXLSX>(RADIO_FORMAT_XLSX);
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
        const activeRecords = downloadRecordsValue === RADIO_ALL_BROWSER ? records : selectedRecords;
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
                    label={`All records (${numeral(totalRecordCount).format('0,0')})`}
                    value={RADIO_ALL_SERVER}
                    checked={downloadRecordsValue === RADIO_ALL_SERVER}
                    onChange={setDownloadRecordsValue}
                  />
                  <Radio
                    name="radio-download"
                    label={`First set of records (${numeral(records.length).format('0,0')})`}
                    value={RADIO_ALL_BROWSER}
                    checked={downloadRecordsValue === RADIO_ALL_BROWSER}
                    onChange={setDownloadRecordsValue}
                  />
                </Fragment>
              )}
              {!hasMoreRecords && (
                <Radio
                  name="radio-download"
                  label={`All records (${numeral(totalRecordCount).format('0,0')})`}
                  value={RADIO_ALL_BROWSER}
                  checked={downloadRecordsValue === RADIO_ALL_BROWSER}
                  onChange={setDownloadRecordsValue}
                />
              )}
              {Array.isArray(selectedRecords) && (
                <Radio
                  name="radio-download"
                  label={`Selected records (${selectedRecords.length || 0})`}
                  value={RADIO_SELECTED}
                  disabled={!selectedRecords?.length}
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
