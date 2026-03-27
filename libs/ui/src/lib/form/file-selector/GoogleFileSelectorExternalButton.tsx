import { GooglePickerResultSuccess } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { GoogleApiClientConfig, initXlsx, useDriveExternalPicker } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { InputReadGoogleSheet, Maybe } from '@jetstream/types';
import { applicationCookieState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import Spinner from '../../widgets/Spinner';
import Tooltip from '../../widgets/Tooltip';
import { useFilename } from './useFilename';

initXlsx(XLSX);

const GOOGLE_APPS_MIME_PREFIX = 'application/vnd.google-apps.';
const XLSX_EXPORT_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Downloads a file from Google Drive using the REST API.
 * For Google native documents (Sheets), exports as xlsx.
 * For uploaded files (xlsx, csv), downloads directly.
 */
async function downloadGoogleDriveFile(fileId: string, mimeType: string, googleAccessToken: string): Promise<ArrayBuffer> {
  const isGoogleNativeDoc = mimeType.startsWith(GOOGLE_APPS_MIME_PREFIX);

  const url = isGoogleNativeDoc
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(XLSX_EXPORT_MIME_TYPE)}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${googleAccessToken}` },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Google token has expired. Please select the file again.');
    }
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  return response.arrayBuffer();
}

export interface GoogleFileSelectorExternalButtonProps {
  // Accepted for prop compatibility with GoogleFileSelectorProps spread, but unused in desktop flow
  apiConfig: GoogleApiClientConfig;
  id?: string;
  className?: string;
  filename?: Maybe<string>;
  inputGoogleFile?: Maybe<google.picker.DocumentObject>;
  label?: string;
  buttonLabel?: string;
  helpText?: string;
  labelHelp?: string | null;
  hideLabel?: boolean;
  isRequired?: boolean;
  disabled?: boolean;
  onSelectorVisible?: (isVisible: boolean) => void;
  onSelected?: (data: google.picker.ResponseObject) => void;
  onReadFile: (fileContent: InputReadGoogleSheet) => void;
  onError?: (error: string) => void;
}

export const GoogleFileSelectorExternalButton: FunctionComponent<GoogleFileSelectorExternalButtonProps> = ({
  id = uniqueId('google-file-input'),
  className,
  filename,
  inputGoogleFile,
  label,
  buttonLabel = 'Choose Google Sheet',
  hideLabel,
  labelHelp,
  helpText,
  isRequired,
  disabled,
  onReadFile,
  onError,
}) => {
  const [labelId] = useState(() => `${id}-label`);
  const helpId = `${id}-file-input-help`;
  const errorId = `${id}-file-input-error`;
  const { serverUrl } = useAtomValue(applicationCookieState);
  const { openPicker, result: pickerResult, loading: pickerLoading, error: pickerError } = useDriveExternalPicker(serverUrl);
  const [downloading, setDownloading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<Maybe<google.picker.DocumentObject>>(inputGoogleFile);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [{ managedFilename, filenameTruncated }, setManagedFilename] = useFilename(filename);
  const lastPickerResult = useRef<GooglePickerResultSuccess | null>(null);
  const callbackRefs = useRef({ onReadFile, onError });
  callbackRefs.current = { onReadFile, onError };

  useEffect(() => {
    callbackRefs.current = { onReadFile, onError };
  }, [onReadFile, onError]);

  const loading = downloading || pickerLoading;

  useEffect(() => {
    if (errorMessage && onError) {
      onError(errorMessage);
    }
  }, [errorMessage, onError]);

  useEffect(() => {
    if (pickerError) {
      setErrorMessage(pickerError);
    }
  }, [pickerError]);

  const handleDownloadAndParse = useCallback(
    async (result: GooglePickerResultSuccess) => {
      const { fileId, fileName, mimeType, googleAccessToken } = result;
      if (!fileId || !fileName || !mimeType) {
        setErrorMessage('Selected file is missing required metadata.');
        return;
      }

      try {
        setDownloading(true);
        setErrorMessage(null);

        const arrayBuffer = await downloadGoogleDriveFile(fileId, mimeType, googleAccessToken);
        const workbook = XLSX.read(arrayBuffer, { cellText: false, cellDates: true, type: 'array' });

        const syntheticDoc = { id: fileId, name: fileName, mimeType } as google.picker.DocumentObject;

        setSelectedFile(syntheticDoc);
        setManagedFilename(fileName);
        callbackRefs.current.onReadFile && callbackRefs.current.onReadFile({ workbook, selectedFile: syntheticDoc });
      } catch (ex) {
        logger.error('Error downloading or parsing Google Drive file', ex);
        const message = getErrorMessage(ex);
        setErrorMessage(`Error loading selected file. ${message}`);
        callbackRefs.current.onError && callbackRefs.current.onError(`Error loading selected file. ${message}`);
        setManagedFilename(null);
        setSelectedFile(undefined);
      } finally {
        setDownloading(false);
      }
    },
    [setManagedFilename],
  );

  // When picker returns a result, download and parse the file
  useEffect(() => {
    if (pickerResult) {
      lastPickerResult.current = pickerResult;
      handleDownloadAndParse(pickerResult);
    }
  }, [pickerResult, handleDownloadAndParse]);

  const handleOpenPicker = useCallback(() => {
    openPicker('file');
  }, [openPicker]);

  const handleRefresh = useCallback(() => {
    if (lastPickerResult.current) {
      handleDownloadAndParse(lastPickerResult.current);
    }
  }, [handleDownloadAndParse]);

  // Compose aria-describedby
  const ariaDescribedByIds = [] as string[];
  if (helpText && !selectedFile?.name) {
    ariaDescribedByIds.push(helpId);
  }
  if (managedFilename) {
    ariaDescribedByIds.push(helpId);
  }
  if (errorMessage) {
    ariaDescribedByIds.push(errorId);
  }

  return (
    <div className={classNames('slds-form-element', { 'slds-has-error': !!errorMessage }, className)}>
      <span className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel || !label })} id={labelId}>
        {isRequired && (
          <abbr className="slds-required" title="required">
            *{' '}
          </abbr>
        )}
        {label}
      </span>
      {labelHelp && label && !hideLabel && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
      <div className="slds-form-element__control">
        <label className="slds-file-selector__body" htmlFor={id}>
          <button
            className="slds-is-relative slds-button slds-button_neutral"
            onClick={handleOpenPicker}
            disabled={loading || disabled}
            aria-labelledby={`${labelId}`}
            aria-describedby={ariaDescribedByIds.length ? ariaDescribedByIds.join(' ') : undefined}
          >
            <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
            {buttonLabel}
            {loading && !errorMessage && <Spinner size="small" />}
          </button>
        </label>
        {selectedFile && (
          <Tooltip content={'Refresh file from Google'}>
            <button className="slds-button slds-button_icon slds-button_icon-container" disabled={loading} onClick={handleRefresh}>
              <Icon type="utility" icon="refresh" className="slds-button__icon" omitContainer />
            </button>
          </Tooltip>
        )}
      </div>
      {helpText && !selectedFile?.name && (
        <div className="slds-form-element__help slds-truncate" id={helpId} title={helpText}>
          {helpText}
        </div>
      )}
      {managedFilename && (
        <div className="slds-form-element__help slds-truncate" id={helpId} title={managedFilename}>
          {filenameTruncated}
        </div>
      )}
      {errorMessage && (
        <div className="slds-form-element__help slds-truncate" id={errorId}>
          {errorMessage}
        </div>
      )}
    </div>
  );
};
