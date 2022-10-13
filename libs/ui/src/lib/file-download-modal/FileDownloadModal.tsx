/* eslint-disable @typescript-eslint/no-explicit-any */

import { MIME_TYPES } from '@jetstream/shared/constants';
import { getFilename, isEnterKey, prepareCsvFile, prepareExcelFile, saveFile } from '@jetstream/shared/ui-utils';
import {
  AsyncJobNew,
  FileExtAllTypes,
  FileExtCsv,
  FileExtCsvXLSX,
  FileExtGDrive,
  FileExtXLSX,
  FileExtXml,
  FileExtZip,
  JetstreamEvents,
  MapOf,
  MimeType,
  SalesforceOrgUi,
  UploadToGoogleJob,
} from '@jetstream/types';
import FileDownloadGoogle from './options/FileDownloadGoogle';
import { isString } from 'lodash';
import { Fragment, FunctionComponent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import Input from '../form/input/Input';
import Radio from '../form/radio/Radio';
import RadioGroup from '../form/radio/RadioGroup';
import Modal from '../modal/Modal';
import {
  RADIO_FORMAT_CSV,
  RADIO_FORMAT_GDRIVE,
  RADIO_FORMAT_JSON,
  RADIO_FORMAT_XLSX,
  RADIO_FORMAT_XML,
  RADIO_FORMAT_ZIP,
} from './download-modal-utils';
import { logger } from '@jetstream/shared/client-logger';

export interface FileDownloadModalProps {
  google_apiKey?: string;
  google_appId?: string;
  google_clientId?: string;
  modalHeader?: string;
  modalTagline?: string;
  allowedTypes?: FileExtAllTypes[]; // defaults to all types
  org: SalesforceOrgUi;
  // if data is MapOf<any[]> | ArrayBuffer then only excel is a supported option and header, if provided, should be the same type
  data: any[] | MapOf<any[]> | ArrayBuffer | string;
  header?: string[] | MapOf<any[]>; // can be omitted if every field should be included in download, otherwise pass in a list of fields to include in file
  fileNameParts?: string[];
  alternateDownloadButton?: React.ReactNode; // If provided, then caller must manage what happens on click - used for URL links
  onModalClose: (cancelled?: boolean) => void;
  // TODO: we may want to provide a hook "onPrepareDownload" to override default file generation process
  // this may be useful if alternateDownloadButton is provided, otherwise this usually is not required
  onChange?: (data: { fileName: string; fileFormat: FileExtAllTypes }) => void;
  emitUploadToGoogleEvent?: (event: JetstreamEvents) => void;
  onError?: (error: Error) => void;
}

const defaultAllowedTypes = [RADIO_FORMAT_XLSX, RADIO_FORMAT_CSV, RADIO_FORMAT_JSON];

export const FileDownloadModal: FunctionComponent<FileDownloadModalProps> = ({
  google_apiKey,
  google_appId,
  google_clientId,
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
  emitUploadToGoogleEvent,
  onError,
}) => {
  const hasGoogleInputConfigured = !!google_apiKey && !!google_appId && !!google_clientId && !!emitUploadToGoogleEvent;
  const [allowedTypesSet, setAllowedTypesSet] = useState<Set<string>>(() => new Set(allowedTypes));
  const [fileFormat, setFileFormat] = useState<FileExtAllTypes>(allowedTypes[0]);
  const [fileName, setFileName] = useState<string>(getFilename(org, fileNameParts));
  // If the user changes the filename, we do not want to focus/select the text again or else the user cannot type
  const [doFocusInput, setDoFocusInput] = useState<boolean>(true);
  const inputEl = useRef<HTMLInputElement>();
  const [filenameEmpty, setFilenameEmpty] = useState(false);

  const [googleFolder, setGoogleFolder] = useState<string>();

  useEffect(() => {
    if (!fileName && !filenameEmpty) {
      setFilenameEmpty(true);
    } else if (fileName && filenameEmpty) {
      setFilenameEmpty(false);
    }
  }, [fileName, filenameEmpty]);

  // throw error if invalid data is passed in
  useEffect(() => {
    if (allowedTypes && data) {
      if (!Array.isArray(data)) {
        if (allowedTypes.length !== 1) {
          throw new Error('An improper configuration of data was provided');
        } else if (!isString(data) && allowedTypes[0] !== 'xlsx' && allowedTypes[0] !== 'zip') {
          throw new Error('An improper configuration of data was provided');
        } else if (isString(data) && allowedTypes[0] !== 'xml' && allowedTypes[0] !== 'zip') {
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

  function handleDownload() {
    try {
      const fileNameWithExt = `${fileName}.${fileFormat}`;
      let mimeType: MimeType;
      let fileData;
      if (fileFormat === 'gdrive') {
        handleUploadToGoogle();
      } else {
        switch (fileFormat) {
          case 'xlsx': {
            if (data instanceof ArrayBuffer) {
              fileData = data;
            } else if (Array.isArray(data)) {
              const headerFields = (header ? header : Object.keys(data[0])) as string[];
              fileData = prepareExcelFile(data, headerFields);
            } else {
              fileData = prepareExcelFile(data as any, header as MapOf<string[]>);
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
          case 'json': {
            fileData = JSON.stringify(data, null, 2);
            mimeType = MIME_TYPES.JSON;
            break;
          }
          case 'xml': {
            fileData = data as string;
            mimeType = MIME_TYPES.XML;
            fileData = data;
            break;
          }
          case 'zip': {
            fileData = data as string | ArrayBuffer;
            mimeType = MIME_TYPES.ZIP;
            fileData = data;
            break;
          }
          default:
            throw new Error('A valid file type type has not been selected');
        }

        saveFile(fileData, fileNameWithExt, mimeType);

        onModalClose();
      }
    } catch (ex) {
      logger.error('[FILE DOWNLOAD][ERROR]', ex);
      onError && onError(ex);
    }
  }

  function handleUploadToGoogle() {
    let fileData: any;
    let fileType: FileExtCsvXLSX | FileExtZip;
    // Get fileData based on allowable formats.
    if (allowedTypesSet.has('csv')) {
      fileType = 'csv';
      const headerFields = (header ? header : Object.keys(data[0])) as string[];
      fileData = prepareCsvFile(data as any[], headerFields);
    } else if (allowedTypesSet.has('xlsx')) {
      fileType = 'xlsx';
      if (data instanceof ArrayBuffer) {
        fileData = data;
      } else if (Array.isArray(data)) {
        const headerFields = (header ? header : Object.keys(data[0])) as string[];
        fileData = prepareExcelFile(data, headerFields);
      } else {
        fileData = prepareExcelFile(data as any, header as MapOf<string[]>);
      }
    } else {
      fileType = 'zip';
      fileData = data;
    }
    const jobs: AsyncJobNew<UploadToGoogleJob>[] = [
      {
        type: 'UploadToGoogle',
        title: `Upload to Google`,
        org,
        meta: { fileName, fileData, fileType, googleFolder: googleFolder },
      },
    ];
    emitUploadToGoogleEvent({ type: 'newJob', payload: jobs });
    onModalClose();
  }

  function handleKeyUp(event: KeyboardEvent<HTMLElement>) {
    if (isEnterKey(event) && !filenameEmpty) {
      handleDownload();
    }
  }

  function handleFolderSelected(folderId: string) {
    setGoogleFolder(folderId);
  }

  return (
    <Modal
      header={modalHeader}
      tagline={modalTagline}
      overrideZIndex={1001}
      footer={
        <Fragment>
          {!alternateDownloadButton && (
            <Fragment>
              <button className="slds-button slds-button_neutral" onClick={() => onModalClose(true)}>
                Cancel
              </button>
              <button className="slds-button slds-button_brand" onClick={handleDownload} disabled={filenameEmpty}>
                Download
              </button>
            </Fragment>
          )}
          {alternateDownloadButton}
        </Fragment>
      }
      skipAutoFocus
      onClose={() => onModalClose(true)}
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
          {hasGoogleInputConfigured && (allowedTypesSet.has('csv') || allowedTypesSet.has('xlsx') || allowedTypesSet.has('zip')) && (
            <Radio
              name="radio-download-file-format"
              label="Google Drive"
              value={RADIO_FORMAT_GDRIVE}
              checked={fileFormat === RADIO_FORMAT_GDRIVE}
              onChange={(value: FileExtGDrive) => setFileFormat(value)}
            />
          )}
        </RadioGroup>
        {fileFormat === 'gdrive' && (
          <FileDownloadGoogle
            google_apiKey={google_apiKey}
            google_appId={google_appId}
            google_clientId={google_clientId}
            onFolderSelected={handleFolderSelected}
          />
        )}
        <Input
          label="Filename"
          isRequired
          rightAddon={fileFormat !== RADIO_FORMAT_GDRIVE ? `.${fileFormat}` : undefined}
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
  );
};

export default FileDownloadModal;
