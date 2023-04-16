import { logger } from '@jetstream/shared/client-logger';
import { GoogleApiClientConfig, initXlsx, useDrivePicker } from '@jetstream/shared/ui-utils';
import { InputReadGoogleSheet, Maybe } from '@jetstream/types';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import Spinner from '../../widgets/Spinner';
import Tooltip from '../../widgets/Tooltip';
import { SCRIPT_LOAD_ERR_MESSAGE } from './file-selector-utils';
import { useFilename } from './useFilename';

initXlsx(XLSX);

export interface GoogleFileSelectorProps {
  apiConfig: GoogleApiClientConfig;
  id?: string;
  className?: string;
  filename?: Maybe<string>;
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
  onSelectorVisible,
  onSelected,
  onReadFile,
  onError,
}) => {
  const [labelId] = useState(() => `${id}-label`);
  const { data, error: scriptLoadError, loading: googleApiLoading, isVisible, openPicker } = useDrivePicker(apiConfig);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<google.picker.DocumentObject>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [{ managedFilename, filenameTruncated }, setManagedFilename] = useFilename(filename);

  useEffect(() => {
    if (errorMessage && onError) {
      onError(errorMessage);
    }
  }, [errorMessage, onError]);

  useEffect(() => {
    onSelectorVisible && onSelectorVisible(isVisible);
  }, [onSelectorVisible, isVisible]);

  useEffect(() => {
    if (scriptLoadError) {
      setErrorMessage(SCRIPT_LOAD_ERR_MESSAGE);
    } else if (errorMessage === SCRIPT_LOAD_ERR_MESSAGE) {
      setErrorMessage(null);
    }
  }, [scriptLoadError, errorMessage]);

  const handleDownloadFile = useCallback(
    async (selectedItem: google.picker.DocumentObject) => {
      try {
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
      } catch (ex) {
        logger.error('Error exporting file', ex);
        const errorMessage = ex?.result?.error?.message || ex.message || '';
        onError && onError(`Error loading selected file. ${errorMessage}`);
        setErrorMessage(`Error loading selected file. ${errorMessage}`);
        setManagedFilename(null);
        setSelectedFile(undefined);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleFileSelected = useCallback(
    (data: google.picker.ResponseObject) => {
      try {
        if (Array.isArray(data.docs) && data.docs.length > 0) {
          const selectedItem = data.docs[0];
          handleDownloadFile(selectedItem);
        }
      } catch (ex) {
        logger.error('Error exporting file', ex);
        const errorMessage = ex?.result?.error?.message || ex.message || '';
        onError && onError(`Error loading selected file. ${errorMessage}`);
        setErrorMessage(`Error loading selected file. ${errorMessage}`);
        setManagedFilename(null);
        setSelectedFile(undefined);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (data) {
      onSelected && onSelected(data);
      handleFileSelected(data);
    }
  }, [data, handleFileSelected, onSelected]);

  const handleOpenPicker = useCallback(() => {
    openPicker({
      views: [
        { view: new google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS).setParent('root').setIncludeFolders(true) },
        { view: new google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS), label: 'All spreadsheets' },
        { view: new google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS).setStarred(true), label: 'Starred spreadsheets' },
        { view: new google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS).setEnableDrives(true).setIncludeFolders(true) },
      ],
      features: [window.google.picker.Feature.SUPPORT_DRIVES],
    });
  }, [openPicker]);

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
            disabled={googleApiLoading || disabled}
            aria-labelledby={`${labelId}`}
          >
            <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
            {buttonLabel}
            {(loading || googleApiLoading) && !errorMessage && <Spinner size="small" />}
          </button>
        </label>
        {selectedFile && (
          <Tooltip content={'Refresh file from Google'}>
            <button
              className="slds-button slds-button_icon slds-button_icon-container"
              disabled={loading}
              onClick={() => handleDownloadFile(selectedFile)}
            >
              <Icon type="utility" icon="refresh" className="slds-button__icon" omitContainer />
            </button>
          </Tooltip>
        )}
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
      {errorMessage && (
        <div className="slds-form-element__help slds-truncate" id="file-input-error">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default GoogleFileSelector;
