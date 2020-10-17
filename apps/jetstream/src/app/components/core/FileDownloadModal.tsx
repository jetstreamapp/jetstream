/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { getFilename, prepareCsvFile, prepareExcelFile, saveFile } from '@jetstream/shared/ui-utils';
import { FileExtCsv, FileExtCsvXLSX, FileExtXLSX, MimeType, SalesforceOrgUi } from '@jetstream/types';
import { Input, Modal, Radio, RadioGroup } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';

export interface FileDownloadModalProps {
  modalHeader?: string;
  allowedTypes?: FileExtCsvXLSX[]; // defaults to all types
  org: SalesforceOrgUi;
  data: any[]; // an array of objects to be used in file creation
  header?: string[]; // can be omitted if every field should be included in download, otherwise pass in a list of fields to include in file
  fileNameParts?: string[];
  alternateDownloadButton?: React.ReactNode; // If provided, then caller must manage what happens on click - used for URL links
  onModalClose: () => void;
  // TODO: we may want to provide a hook "onPrepareDownload" to override default file generation process
  // this may be useful if alternateDownloadButton is provided, otherwise this usually is not required
  onChange?: (data: { fileName: string; fileFormat: FileExtCsvXLSX }) => void;
}

export const RADIO_FORMAT_XLSX: FileExtXLSX = 'xlsx';
export const RADIO_FORMAT_CSV: FileExtCsv = 'csv';

const defaultAllowedTypes = [RADIO_FORMAT_XLSX, RADIO_FORMAT_CSV];

export const FileDownloadModal: FunctionComponent<FileDownloadModalProps> = ({
  modalHeader = 'Download Records',
  allowedTypes = defaultAllowedTypes,
  org,
  data,
  header,
  fileNameParts = ['records'],
  alternateDownloadButton,
  onModalClose,
  onChange,
}) => {
  const [allowedTypesSet, setAllowedTypesSet] = useState<Set<string>>(() => new Set(allowedTypes));
  const [fileFormat, setFileFormat] = useState<FileExtCsvXLSX>(allowedTypes[0]);
  const [fileName, setFileName] = useState<string>(getFilename(org, fileNameParts));
  // If the user changes the filename, we do not want to focus/select the text again or else the user cannot type
  const [doFocusInput, setDoFocusInput] = useState<boolean>(true);
  const inputEl = useRef<HTMLInputElement>();

  useEffect(() => {
    if (doFocusInput) {
      inputEl.current.focus();
      inputEl.current.select();
      setDoFocusInput(false);
    }
  }, [inputEl.current]);

  useEffect(() => {
    setAllowedTypesSet(new Set(allowedTypes));
  }, [allowedTypes]);

  useEffect(() => {
    if (onChange) {
      onChange({ fileName, fileFormat });
    }
  }, [onChange, fileName, fileFormat]);

  function downloadRecords() {
    const headerFields = header ? header : Object.keys(data[0]);
    try {
      const fileNameWithExt = `${fileName}.${fileFormat}`;
      let mimeType: MimeType;
      let fileData;
      switch (fileFormat) {
        case 'xlsx': {
          fileData = prepareExcelFile(data, headerFields);
          mimeType = MIME_TYPES.XLSX;
          break;
        }
        case 'csv': {
          fileData = prepareCsvFile(data, headerFields);
          mimeType = MIME_TYPES.CSV;
          break;
        }
        default:
          throw new Error('A valid file type type has not been selected');
      }

      saveFile(fileData, fileNameWithExt, mimeType);

      onModalClose();
    } catch (ex) {
      // TODO: show error message somewhere
    }
  }

  return (
    <Fragment>
      <Modal
        header={modalHeader}
        footer={
          <Fragment>
            {!alternateDownloadButton && (
              <button className="slds-button slds-button_brand" onClick={downloadRecords}>
                Download
              </button>
            )}
            {alternateDownloadButton}
          </Fragment>
        }
        skipAutoFocus
        onClose={() => onModalClose()}
      >
        <div>
          <RadioGroup label="File Format" required className="slds-m-bottom_small">
            {allowedTypesSet.has('xlsx') && (
              <Radio
                name="radio-download-file-format"
                label="Excel"
                value={RADIO_FORMAT_XLSX}
                checked={fileFormat === RADIO_FORMAT_XLSX}
                onChange={(value: FileExtXLSX) => setFileFormat(value)}
              />
            )}
            {allowedTypesSet.has('csv') && (
              <Radio
                name="radio-download-file-format"
                label="CSV"
                value={RADIO_FORMAT_CSV}
                checked={fileFormat === RADIO_FORMAT_CSV}
                onChange={(value: FileExtCsv) => setFileFormat(value)}
              />
            )}
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
    </Fragment>
  );
};

export default FileDownloadModal;
