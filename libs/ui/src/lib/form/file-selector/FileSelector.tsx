import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { readFile } from '@jetstream/shared/ui-utils';
import { InputAcceptType, InputReadFileContent } from '@jetstream/types';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { FunctionComponent, useRef, useState } from 'react';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import { useFilename } from './useFilename';

export interface FileSelectorProps {
  className?: string;
  id: string;
  label: string;
  buttonLabel?: string;
  labelHelp?: string;
  /** @deprecated I guess? is not used in code, use `userHelpText` instead */
  helpText?: React.ReactNode | string; // FIXME: does not appear to be used, userHelpText is used
  isRequired?: boolean;
  filename?: string; // optional, will be managed if not provided
  hideLabel?: boolean;
  disabled?: boolean;
  accept?: InputAcceptType[];
  userHelpText?: React.ReactNode | string;
  hasError?: boolean;
  errorMessage?: React.ReactNode | string;
  maxAllowedSizeMB?: number;
  onReadFile: (fileContent: InputReadFileContent) => void;
}

export const FileSelector: FunctionComponent<FileSelectorProps> = ({
  className,
  id,
  label,
  buttonLabel = 'Upload File',
  labelHelp,
  filename,
  isRequired,
  hideLabel,
  disabled,
  accept,
  userHelpText,
  hasError,
  errorMessage,
  maxAllowedSizeMB,
  onReadFile,
}) => {
  const [labelPrimaryId] = useState(() => `${id}-label-primary`);
  const [labelSecondaryId] = useState(() => `${id}-label`);
  const [systemErrorMessage, setSystemErrorMessage] = useState<string>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>();
  const [{ managedFilename, filenameTruncated }, setManagedFilename] = useFilename(filename);

  function preventEventDefaults(event: React.DragEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    preventEventDefaults(event);
    setIsDraggingOver(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    preventEventDefaults(event);
    setIsDraggingOver(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    preventEventDefaults(event);
    handleFiles(event.dataTransfer?.files);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    preventEventDefaults(event);
    handleFiles(event.target?.files);
  }

  async function handleFiles(files: FileList) {
    try {
      setSystemErrorMessage(null);
      setManagedFilename(null);
      if (!files || files.length === 0) {
        return;
      } else if (files.length > 1) {
        throw new Error('Only 1 file is supported');
      }
      const file = files.item(0);
      logger.info(file);
      const fileSizeMb = file.size / 1000 / 1000;

      const extension = (file.name.substring(file.name.lastIndexOf('.')) || '').toLowerCase() as InputAcceptType;

      if (accept && !accept.includes(extension)) {
        throw new Error(`File type ${extension} is not supported`);
      }

      if (maxAllowedSizeMB && fileSizeMb > maxAllowedSizeMB) {
        throw new Error(`Maximum allowed file size is ${maxAllowedSizeMB}MB`);
      }

      setManagedFilename(file.name);

      // TODO: we might want to do something else here in the future
      const readAsArrayBuffer = extension !== '.csv' && extension !== '.xml';
      const content = await (readAsArrayBuffer ? readFile(file, 'array_buffer') : readFile(file, 'text'));

      onReadFile({ filename: file.name, extension, content });
    } catch (ex) {
      setSystemErrorMessage(ex.message);
      setManagedFilename(null);
    } finally {
      if (inputRef?.current) {
        inputRef.current.value = '';
      }
    }
  }

  function hasErrorState() {
    return systemErrorMessage || (hasError && errorMessage);
  }

  return (
    <div className={classNames('slds-form-element', { 'slds-has-error': hasErrorState() }, className)}>
      <span className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })} id={labelPrimaryId}>
        {isRequired && (
          <abbr className="slds-required" title="required">
            *{' '}
          </abbr>
        )}
        {label}
      </span>
      {labelHelp && label && !hideLabel && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
      <div className="slds-form-element__control">
        <div className="slds-file-selector slds-file-selector_files">
          <div
            className={classNames('slds-file-selector__dropzone', { 'slds-has-drag-over': isDraggingOver && !hasErrorState() })}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              className="slds-file-selector__input slds-assistive-text"
              accept={accept ? accept.join(', ') : undefined}
              id={id}
              aria-describedby={`${id}-file-input-help ${id}-file-input-system-error ${id}-file-input-error ${id}-file-input-name`}
              aria-labelledby={`${labelPrimaryId} ${labelSecondaryId}`}
              disabled={disabled}
              onChange={handleInputChange}
            />
            <label className="slds-file-selector__body" htmlFor={id} id={labelSecondaryId}>
              <span className="slds-file-selector__button slds-button slds-button_neutral">
                <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
                {buttonLabel}
              </span>
              <span className="slds-file-selector__text slds-medium-show">or Drop File</span>
            </label>
          </div>
        </div>
      </div>
      <div
        css={css`
          min-height: 20px;
        `}
      >
        {userHelpText && !managedFilename && (
          <div
            className="slds-form-element__help slds-truncate"
            id={`${id}-file-input-help`}
            title={isString(userHelpText) ? userHelpText : ''}
          >
            {userHelpText}
          </div>
        )}
        {managedFilename && (
          <div className="slds-form-element__help slds-truncate" id={`${id}-file-input-name`} title={managedFilename}>
            {filenameTruncated}
          </div>
        )}
        {systemErrorMessage && (
          <div className="slds-form-element__help slds-truncate" id={`${id}-file-input-system-error`}>
            {systemErrorMessage}
          </div>
        )}
        {hasError && errorMessage && (
          <div className="slds-form-element__help slds-truncate" id={`${id}-file-input-error`}>
            {systemErrorMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileSelector;
