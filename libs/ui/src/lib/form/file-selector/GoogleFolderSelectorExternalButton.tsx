import { GooglePickerResultSuccess } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { useDriveExternalPicker } from '@jetstream/shared/ui-utils';
import { applicationCookieState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import Spinner from '../../widgets/Spinner';
import { useFilename } from './useFilename';

export interface GoogleFolderSelection {
  id: string;
  name: string;
}

export interface GoogleFolderSelectorExternalButtonProps {
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
  onSelected: (data: GoogleFolderSelection) => void;
  onError?: (error: string) => void;
}

export const GoogleFolderSelectorExternalButton: FunctionComponent<GoogleFolderSelectorExternalButtonProps> = ({
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
}) => {
  const [labelId] = useState(() => `${id}-label`);
  const errorId = `${id}-error`;
  const { serverUrl } = useAtomValue(applicationCookieState);
  const { openPicker, result: pickerResult, loading: pickerLoading, error: pickerError } = useDriveExternalPicker(serverUrl);
  const [selectedFolder, setSelectedFolder] = useState<GoogleFolderSelection | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [{ managedFilename: managedName, filenameTruncated }, setManagedName] = useFilename(folderName);

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

  // When picker returns a folder result, update state and notify parent
  useEffect(() => {
    if (pickerResult) {
      handlePickerResult(pickerResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerResult]);

  const handlePickerResult = useCallback(
    (result: GooglePickerResultSuccess) => {
      const { folderId, folderName: resultFolderName } = result;
      if (!folderId || !resultFolderName) {
        setErrorMessage('Selected folder is missing required metadata.');
        return;
      }

      try {
        setErrorMessage(null);

        const folderSelection: GoogleFolderSelection = { id: folderId, name: resultFolderName };

        setSelectedFolder(folderSelection);
        setManagedName(resultFolderName);
        onSelected(folderSelection);
      } catch (ex) {
        logger.error('Error processing Google Drive folder selection', ex);
        setErrorMessage('Error processing selected folder.');
        onError?.('Error processing selected folder.');
        setManagedName(null);
        setSelectedFolder(undefined);
      }
    },
    [onSelected, setManagedName, onError],
  );

  const handleOpenPicker = useCallback(() => {
    openPicker('folder');
  }, [openPicker]);

  // Compose aria-describedby for button
  const ariaDescribedByIds =
    [helpText && !selectedFolder?.name ? `${id}-help` : null, errorMessage ? errorId : null].filter(Boolean).join(' ') || undefined;

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
            disabled={pickerLoading || disabled}
            aria-labelledby={`${labelId}`}
            aria-describedby={ariaDescribedByIds}
          >
            <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
            {buttonLabel}
            {pickerLoading && !errorMessage && <Spinner size="small" />}
          </button>
        </label>
      </div>
      {helpText && !selectedFolder?.name && (
        <div className="slds-form-element__help slds-truncate" id={`${id}-help`} title={helpText}>
          {helpText}
        </div>
      )}
      {managedName && (
        <div className="slds-form-element__help" id={`${id}-name`} title={managedName}>
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
        <div className="slds-form-element__help slds-truncate" id={errorId}>
          {errorMessage}
        </div>
      )}
    </div>
  );
};
