/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsx jsx */
import { jsx } from '@emotion/react';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { getFilename, isEnterKey } from '@jetstream/shared/ui-utils';
import { FileExtAllTypes, FileExtCsv, FileExtXLSX, FileExtXml, FileExtZip, MapOf, MimeType, SalesforceOrgUi } from '@jetstream/types';
import { Fragment, FunctionComponent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import Input from '../form/input/Input';
import Radio from '../form/radio/Radio';
import RadioGroup from '../form/radio/RadioGroup';
import Modal from '../modal/Modal';
import { RADIO_FORMAT_CSV, RADIO_FORMAT_JSON, RADIO_FORMAT_XLSX, RADIO_FORMAT_XML, RADIO_FORMAT_ZIP } from './download-modal-utils';

export interface FileFauxDownloadModalProps {
  modalHeader?: string;
  modalTagline?: string;
  allowedTypes?: FileExtAllTypes[]; // defaults to all types
  org: SalesforceOrgUi;
  header?: string[] | MapOf<any[]>; // can be omitted if every field should be included in download, otherwise pass in a list of fields to include in file
  fileNameParts?: string[];
  alternateDownloadButton?: React.ReactNode; // If provided, then caller must manage what happens on click - used for URL links
  onCancel: () => void;
  onDownload: (data: { fileName: string; fileFormat: FileExtAllTypes; mimeType: MimeType }) => void;
}

const defaultAllowedTypes = [RADIO_FORMAT_XLSX, RADIO_FORMAT_CSV, RADIO_FORMAT_JSON];

/**
 * Regular file download modal, but does not actually download any file
 * This is useful if the file takes a while to generate and we allow the user
 * to choose the filename upfront, then we can use it later
 */
export const FileFauxDownloadModal: FunctionComponent<FileFauxDownloadModalProps> = ({
  modalHeader = 'Download',
  modalTagline,
  allowedTypes = defaultAllowedTypes,
  org,
  fileNameParts = ['items'],
  alternateDownloadButton,
  onCancel,
  onDownload,
}) => {
  const [allowedTypesSet, setAllowedTypesSet] = useState<Set<string>>(() => new Set(allowedTypes));
  const [fileFormat, setFileFormat] = useState<FileExtAllTypes>(allowedTypes[0]);
  const [fileName, setFileName] = useState<string>(getFilename(org, fileNameParts));
  // If the user changes the filename, we do not want to focus/select the text again or else the user cannot type
  const [doFocusInput, setDoFocusInput] = useState<boolean>(true);
  const inputEl = useRef<HTMLInputElement>();
  const [filenameEmpty, setFilenameEmpty] = useState(false);

  useEffect(() => {
    if (!fileName && !filenameEmpty) {
      setFilenameEmpty(true);
    } else if (fileName && filenameEmpty) {
      setFilenameEmpty(false);
    }
  }, [fileName, filenameEmpty]);

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

  function handleDownload() {
    try {
      const fileNameWithExt = `${fileName}.${fileFormat}`;
      let mimeType: MimeType;
      switch (fileFormat) {
        case 'xlsx': {
          mimeType = MIME_TYPES.XLSX;
          break;
        }
        case 'csv': {
          mimeType = MIME_TYPES.CSV;
          break;
        }
        case 'json': {
          mimeType = MIME_TYPES.JSON;
          break;
        }
        case 'xml': {
          mimeType = MIME_TYPES.XML;
          break;
        }
        case 'zip': {
          mimeType = MIME_TYPES.ZIP;
          break;
        }
        default:
          throw new Error('A valid file type type has not been selected');
      }

      onDownload({ fileName: fileNameWithExt, fileFormat, mimeType });
    } catch (ex) {
      // TODO: show error message somewhere
    }
  }

  function handleKeyUp(event: KeyboardEvent<HTMLElement>) {
    if (isEnterKey(event) && !filenameEmpty) {
      handleDownload();
    }
  }

  return (
    <Fragment>
      <Modal
        header={modalHeader}
        tagline={modalTagline}
        footer={
          <Fragment>
            <button className="slds-button slds-button_neutral" onClick={() => onCancel()}>
              Cancel
            </button>
            {!alternateDownloadButton && (
              <button className="slds-button slds-button_brand" onClick={handleDownload} disabled={filenameEmpty}>
                Download
              </button>
            )}
            {alternateDownloadButton}
          </Fragment>
        }
        skipAutoFocus
        onClose={() => onCancel()}
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
            {allowedTypesSet.has('json') && (
              <Radio
                name="radio-download-file-format"
                label="JSON"
                value={RADIO_FORMAT_JSON}
                checked={fileFormat === RADIO_FORMAT_JSON}
                onChange={(value: FileExtCsv) => setFileFormat(value)}
              />
            )}
            {allowedTypesSet.has('xml') && (
              <Radio
                name="radio-download-file-format"
                label="XML"
                value={RADIO_FORMAT_XML}
                checked={fileFormat === RADIO_FORMAT_XML}
                onChange={(value: FileExtXml) => setFileFormat(value)}
              />
            )}
            {allowedTypesSet.has('zip') && (
              <Radio
                name="radio-download-file-format"
                label="ZIP"
                value={RADIO_FORMAT_ZIP}
                checked={fileFormat === RADIO_FORMAT_ZIP}
                onChange={(value: FileExtZip) => setFileFormat(value)}
              />
            )}
          </RadioGroup>
          <Input
            label="Filename"
            isRequired
            rightAddon={`.${fileFormat}`}
            hasError={filenameEmpty}
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
    </Fragment>
  );
};

export default FileFauxDownloadModal;
