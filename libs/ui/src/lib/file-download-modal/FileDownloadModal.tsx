/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { getFilename, prepareCsvFile, prepareExcelFile, saveFile } from '@jetstream/shared/ui-utils';
import { FileExtCsv, FileExtCsvXLSX, FileExtXLSX, MapOf, MimeType, SalesforceOrgUi } from '@jetstream/types';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import Input from '../form/input/Input';
import Radio from '../form/radio/Radio';
import RadioGroup from '../form/radio/RadioGroup';
import Modal from '../modal/Modal';
import { RADIO_FORMAT_CSV, RADIO_FORMAT_XLSX } from './download-modal-utils';

export interface FileDownloadModalProps {
  modalHeader?: string;
  modalTagline?: string;
  allowedTypes?: FileExtCsvXLSX[]; // defaults to all types
  org: SalesforceOrgUi;
  // if data is MapOf<any[]> then only excel is a supported option and header, if provided, should be the same type
  data: any[] | MapOf<any[]>;
  header?: string[] | MapOf<any[]>; // can be omitted if every field should be included in download, otherwise pass in a list of fields to include in file
  fileNameParts?: string[];
  alternateDownloadButton?: React.ReactNode; // If provided, then caller must manage what happens on click - used for URL links
  onModalClose: () => void;
  // TODO: we may want to provide a hook "onPrepareDownload" to override default file generation process
  // this may be useful if alternateDownloadButton is provided, otherwise this usually is not required
  onChange?: (data: { fileName: string; fileFormat: FileExtCsvXLSX }) => void;
}

const defaultAllowedTypes = [RADIO_FORMAT_XLSX, RADIO_FORMAT_CSV];

export const FileDownloadModal: FunctionComponent<FileDownloadModalProps> = ({
  modalHeader = 'Download Records',
  modalTagline,
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

  // throw error if invalid data is passed in
  useEffect(() => {
    if (allowedTypes && data) {
      if (!Array.isArray(data)) {
        if (allowedTypes.length !== 1) {
          throw new Error('An improper configuration of data was provided');
        } else if (allowedTypes[0] !== 'xlsx') {
          throw new Error('An improper configuration of data was provided');
        }
      }
    }
  }, [allowedTypes, data]);

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
    try {
      const fileNameWithExt = `${fileName}.${fileFormat}`;
      let mimeType: MimeType;
      let fileData;
      switch (fileFormat) {
        case 'xlsx': {
          if (Array.isArray(data)) {
            const headerFields = (header ? header : Object.keys(data[0])) as string[];
            fileData = prepareExcelFile(data, headerFields);
          } else {
            fileData = prepareExcelFile(data, header as MapOf<string[]>);
          }
          mimeType = MIME_TYPES.XLSX;
          break;
        }
        case 'csv': {
          const headerFields = (header ? header : Object.keys(data[0])) as string[];
          fileData = prepareCsvFile(data as any[], headerFields);
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
        tagline={modalTagline}
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