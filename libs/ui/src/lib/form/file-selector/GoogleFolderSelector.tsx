import { GoogleApiClientConfig, GoogleApiData, useDrivePicker } from '@jetstream/shared/ui-utils';
import classNames from 'classnames';
import { SCRIPT_LOAD_ERR_MESSAGE } from 'libs/ui/src/lib/form/file-selector/file-selector-utils';
import HelpText from 'libs/ui/src/lib/widgets/HelpText';
import { uniqueId } from 'lodash';
import { FunctionComponent, useEffect, useState } from 'react';
import Icon from '../../widgets/Icon';
import Spinner from '../../widgets/Spinner';
import { useFilename } from './useFilename';

export interface GoogleFolderSelectorProps {
  apiConfig: GoogleApiClientConfig;
  id?: string;
  className?: string;
  folderName?: string;
  label?: string;
  buttonLabel?: string;
  helpText?: string;
  labelHelp?: string;
  hideLabel?: boolean;
  isRequired?: boolean;
  disabled?: boolean;
  onSelected?: (data: google.picker.DocumentObject) => void;
  onError?: (error: string) => void;
  onLoaded?: (apiData: GoogleApiData) => void;
}

export const GoogleFolderSelector: FunctionComponent<GoogleFolderSelectorProps> = ({
  apiConfig,
  id = uniqueId('google-folder-input'),
  className,
  folderName,
  label,
  buttonLabel = 'Choose Folder',
  hideLabel,
  labelHelp,
  helpText,
  isRequired,
  disabled,
  onSelected,
  onError,
  onLoaded,
}) => {
  const [labelId] = useState(() => `${id}-label`);
  const [openPicker, { apiData, data, auth, apiLoaded, scriptLoadError }] = useDrivePicker(apiConfig);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<google.picker.DocumentObject>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [{ managedFilename: managedName, filenameTruncated }, setManagedName] = useFilename(folderName);

  useEffect(() => {
    if (!apiLoaded && !scriptLoadError && errorMessage) {
      setLoading(true);
    }
  }, [apiLoaded, scriptLoadError, auth, errorMessage]);

  useEffect(() => {
    if (onLoaded && apiLoaded && apiData.hasApisLoaded) {
      onLoaded(apiData);
    }
  }, [apiLoaded, apiData.hasApisLoaded, apiData.signedIn]);

  useEffect(() => {
    if (data) {
      handleFolderSelected(data);
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

  const handleFolderSelected = async (data: google.picker.ResponseObject) => {
    if (Array.isArray(data.docs) && data.docs.length > 0) {
      const selectedItem = data.docs[0];
      setSelectedFolder(selectedItem);
      onSelected(selectedItem);
      setManagedName(selectedItem.name);
    }
  };

  const handleOpenPicker = () => {
    openPicker({
      title: 'Select a folder',
      views: [
        { view: new google.picker.DocsView(window.google.picker.ViewId.FOLDERS).setSelectFolderEnabled(true).setParent('root') },
        {
          view: new google.picker.DocsView(window.google.picker.ViewId.FOLDERS).setSelectFolderEnabled(true).setStarred(true),
          label: 'Starred folders',
        },
        { view: new google.picker.DocsView(window.google.picker.ViewId.FOLDERS).setSelectFolderEnabled(true).setEnableDrives(true) },
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
            aria-describedby="folder-input-help"
            title={apiData?.signedIn ? `Signed in as ${apiData.gapiAuthInstance.currentUser.get().getBasicProfile().getEmail()}` : ''}
          >
            <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
            {buttonLabel}
            {(loading || (!apiLoaded && !errorMessage)) && <Spinner size="small" />}
          </button>
        </label>
      </div>
      {helpText && !selectedFolder?.name && (
        <div className="slds-form-element__help slds-truncate" id="folder-input-help" title={helpText}>
          {helpText}
        </div>
      )}
      {managedName && (
        <div className="slds-form-element__help" id="folder-input-help" title={managedName}>
          <Icon
            type="utility"
            icon="open_folder"
            containerClassname="slds-icon-utility-open-folder slds-m-right_xx-small"
            className="slds-icon slds-icon-text-default slds-icon_xx-small"
          />
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

export default GoogleFolderSelector;
