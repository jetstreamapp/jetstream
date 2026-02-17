/* eslint-disable react-hooks/set-state-in-effect */
import { GoogleApiClientConfig, useDrivePicker } from '@jetstream/shared/ui-utils';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useCallback, useEffect, useEffectEvent, useState } from 'react';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import Spinner from '../../widgets/Spinner';
import { SCRIPT_LOAD_ERR_MESSAGE } from './file-selector-utils';
import { useFilename } from './useFilename';

export interface GoogleFolderSelectorProps {
  apiConfig: GoogleApiClientConfig;
  id?: string;
  className?: string;
  folderName?: string;
  label?: string;
  buttonLabel?: string;
  helpText?: string;
  labelHelp?: string | null;
  hideLabel?: boolean;
  isRequired?: boolean;
  disabled?: boolean;
  onSelectorVisible?: (isVisible: boolean) => void;
  onSelected: (data: google.picker.DocumentObject) => void;
  onError?: (error: string) => void;
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
  onSelectorVisible,
  onSelected,
  onError,
}) => {
  const [labelId] = useState(() => `${id}-label`);
  const { data, error: scriptLoadError, loading: googleApiLoading, isVisible, openPicker } = useDrivePicker(apiConfig);
  const [selectedFolder, setSelectedFolder] = useState<google.picker.DocumentObject>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [{ managedFilename: managedName, filenameTruncated }, setManagedName] = useFilename(folderName);

  const onSelectedEvent = useEffectEvent((item: google.picker.DocumentObject) => {
    onSelected(item);
  });

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

  useEffect(() => {
    if (data && Array.isArray(data.docs) && data.docs.length > 0) {
      const selectedItem = data.docs[0];

      setSelectedFolder(selectedItem);
      setManagedName(selectedItem.name ?? 'Selected folder');

      onSelectedEvent(selectedItem);
    }
  }, [data, setManagedName]);

  const handleOpenPicker = useCallback(() => {
    openPicker({
      title: 'Select a folder',
      views: [
        // .setParent('root')
        {
          view: new google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
            .setSelectFolderEnabled(true)
            .setMode(window.google.picker.DocsViewMode.LIST)
            .setOwnedByMe(true),
          label: 'My folders',
        },
        {
          view: new google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
            .setSelectFolderEnabled(true)
            .setMode(window.google.picker.DocsViewMode.LIST)
            .setStarred(true),
          label: 'Starred folders',
        },
        {
          view: new google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
            .setSelectFolderEnabled(true)
            .setMode(window.google.picker.DocsViewMode.LIST)
            .setOwnedByMe(false),
          label: 'Shared with me',
        },
        {
          view: new google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
            .setSelectFolderEnabled(true)
            .setMode(window.google.picker.DocsViewMode.LIST)
            .setEnableDrives(true),
        },
      ],
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
            aria-describedby="folder-input-help"
          >
            <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
            {buttonLabel}
            {googleApiLoading && !errorMessage && <Spinner size="small" />}
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
      {errorMessage && (
        <div className="slds-form-element__help slds-truncate" id="file-input-error">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default GoogleFolderSelector;
