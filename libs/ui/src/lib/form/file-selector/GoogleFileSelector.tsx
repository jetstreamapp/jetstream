/** @jsx jsx */
import { jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { GoogleApiClientConfig, GoogleApiData, useDrivePicker } from '@jetstream/shared/ui-utils';
import { InputReadGoogleSheet } from '@jetstream/types';
import classNames from 'classnames';
import { SCRIPT_LOAD_ERR_MESSAGE } from 'libs/ui/src/lib/form/file-selector/file-selector-utils';
import HelpText from 'libs/ui/src/lib/widgets/HelpText';
import { uniqueId } from 'lodash';
import { FunctionComponent, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import Icon from '../../widgets/Icon';
import Spinner from '../../widgets/Spinner';
import { useFilename } from './useFilename';

export interface GoogleFileSelectorProps {
  apiConfig: GoogleApiClientConfig;
  id?: string;
  className?: string;
  filename?: string;
  label?: string;
  buttonLabel?: string;
  helpText?: string;
  labelHelp?: string;
  hideLabel?: boolean;
  isRequired?: boolean;
  disabled?: boolean;
  onSelected?: (data: google.picker.ResponseObject) => void;
  onReadFile: (fileContent: InputReadGoogleSheet) => void;
  onError?: (error: string) => void;
  onLoaded?: (apiData: GoogleApiData) => void;
}

export const GoogleFileSelector: FunctionComponent<GoogleFileSelectorProps> = ({
  apiConfig,
  id = uniqueId('google-file-input'),
  className,
  filename,
  label,
  buttonLabel = 'Choose Google Sheet',
  hideLabel,
  labelHelp,
  helpText,
  isRequired,
  disabled,
  onSelected,
  onReadFile,
  onError,
  onLoaded,
}) => {
  const [labelId] = useState(() => `${id}-label`);
  const [openPicker, { apiData, data, auth, apiLoaded, scriptLoadError }] = useDrivePicker(apiConfig);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<google.picker.DocumentObject>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [{ managedFilename, filenameTruncated }, setManagedFilename] = useFilename(filename);

  useEffect(() => {
    if (!apiLoaded && !scriptLoadError && errorMessage) {
      setLoading(true);
    }
  }, [apiLoaded, scriptLoadError, auth, errorMessage]);

  useEffect(() => {
    if (onLoaded && apiLoaded && apiData.hasApisLoaded) {
      onLoaded(apiData);
    }
  }, [apiLoaded, apiData.hasApisLoaded]);

  useEffect(() => {
    if (data) {
      onSelected && onSelected(data);
      handleDownloadFile(data);
    }
  }, [data]);

  useEffect(() => {
    if (errorMessage && onError) {
      onError(errorMessage);
    }
  }, [errorMessage, onError]);

  useEffect(() => {
    if (scriptLoadError) {
      setErrorMessage(SCRIPT_LOAD_ERR_MESSAGE);
    } else if (errorMessage === SCRIPT_LOAD_ERR_MESSAGE) {
      setErrorMessage(undefined);
    }
  }, [scriptLoadError, errorMessage]);

  const handleDownloadFile = async (data: google.picker.ResponseObject) => {
    try {
      if (Array.isArray(data.docs) && data.docs.length > 0) {
        const selectedItem = data.docs[0];
        setLoading(true);
        let resultBody: string;
        if (selectedItem.type === google.picker.Type.DOCUMENT) {
          const results = await gapi.client.drive.files.export({
            fileId: selectedItem.id,
            // https://developers.google.com/drive/api/v3/ref-export-formats
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          resultBody = results.body;
        } else {
          const results = await gapi.client.drive.files.get({
            fileId: selectedItem.id,
            alt: 'media',
          });
          resultBody = results.body;
        }
        try {
          const workbook = XLSX.read(resultBody, { cellText: false, cellDates: true, type: 'binary' });
          setSelectedFile(selectedItem);
          setManagedFilename(selectedItem.name);
          onReadFile({ workbook, selectedFile: selectedItem });
        } catch (ex) {
          logger.error('Error processing file', ex);
          const errorMessage = ex?.result?.error?.message || ex.message || '';
          onError && onError(`Error parsing file. ${errorMessage}`);
          setErrorMessage(`Error loading selected file. ${errorMessage}`);
        }
      }
    } catch (ex) {
      logger.error('Error exporting file', ex);
      const errorMessage = ex?.result?.error?.message || ex.message || '';
      onError && onError(`Error loading selected file. ${errorMessage}`);
      setErrorMessage(`Error loading selected file. ${errorMessage}`);
      setManagedFilename(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPicker = () => {
    openPicker({
      views: [
        new google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS).setParent('root').setIncludeFolders(true),
        new google.picker.DocsView().setMimeTypes('application/vnd.google-apps.spreadsheet'),
        new google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS).setEnableDrives(true).setIncludeFolders(true),
      ],
      features: [window.google.picker.Feature.SUPPORT_DRIVES],
    });
  };

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
            disabled={!apiLoaded || disabled}
            aria-labelledby={`${labelId}`}
            title={apiData?.signedIn ? `Signed in as ${apiData.gapiAuthInstance.currentUser.get().getBasicProfile().getEmail()}` : ''}
          >
            <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
            {buttonLabel}
            {loading && !errorMessage && <Spinner size="small" />}
          </button>
        </label>
      </div>
      {helpText && !selectedFile?.name && (
        <div className="slds-form-element__help slds-truncate" id="file-input-help" title={helpText}>
          {helpText}
        </div>
      )}
      {managedFilename && (
        <div className="slds-form-element__help slds-truncate" id="file-input-help" title={managedFilename}>
          {filenameTruncated}
        </div>
      )}
      {apiData && apiData.signedIn && !apiData.authorized && (
        <div className="slds-form-element__help slds-truncate" id="file-input-error">
          Google Drive API not authorized
        </div>
      )}
      {errorMessage && (
        <div className="slds-form-element__help slds-truncate" id="file-input-error">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default GoogleFileSelector;
