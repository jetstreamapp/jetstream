/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { readFile, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { InputAcceptType, InputReadFileContent } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import Icon from '../../widgets/Icon';

export interface FileSelectorProps {
  className?: string;
  id: string;
  label: string;
  labelHelp?: string;
  helpText?: React.ReactNode | string;
  filename?: string; // optional, will be managed if not provided
  hideLabel?: boolean;
  disabled?: boolean;
  accept?: InputAcceptType[];
  userHelpText?: string;
  hasError?: boolean;
  errorMessage?: React.ReactNode | string;
  onReadFile: (fileContent: InputReadFileContent) => void;
}

export const FileSelector: FunctionComponent<FileSelectorProps> = ({
  className,
  id,
  label,
  filename,
  hideLabel,
  disabled,
  accept,
  userHelpText,
  hasError,
  errorMessage,
  onReadFile,
}) => {
  const [labelPrimaryId] = useState(() => `${id}-label-primary`);
  const [labelSecondaryId] = useState(() => `${id}-label`);
  const [systemErrorMessage, setSystemErrorMessage] = useState<string>(null);
  const [managedFilename, setManagedFilename] = useState<string>(filename);
  const [filenameTruncated, setFilenameTruncated] = useState<string>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>();

  useEffect(() => {
    if (!filename) {
      setFilenameTruncated(null);
    } else {
      if (filename.length > 40) {
        setFilenameTruncated(`${filename.substring(0, 25)}...${filename.substring(filename.length - 10)}`);
      } else {
        setFilenameTruncated(filename);
      }
    }
  }, [filename]);

  useNonInitialEffect(() => {
    setManagedFilename(filename);
  }, [filename]);

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

      const extension = (file.name.substring(file.name.lastIndexOf('.')) || '').toLowerCase() as InputAcceptType;

      if (accept && !accept.includes(extension)) {
        throw new Error(`File type ${extension} is not supported`);
      }

      setManagedFilename(file.name);

      // TODO: we might want to do something else here in the future
      const readAsArrayBuffer = extension !== '.csv' && extension !== '.xml';
      const content = await readFile(file, readAsArrayBuffer);

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
    <div className={classNames('"slds-form-element"', { 'slds-has-error': hasErrorState() }, className)}>
      <span className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })} id={labelPrimaryId}>
        {label}
      </span>
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
              aria-describedby="file-input-help file-input-system-error file-input-error file-input-name"
              aria-labelledby={`${labelPrimaryId} ${labelSecondaryId}`}
              disabled={disabled}
              onChange={handleInputChange}
            />
            <label className="slds-file-selector__body" htmlFor={id} id={labelSecondaryId}>
              <span className="slds-file-selector__button slds-button slds-button_neutral">
                <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
                Upload Files
              </span>
              <span className="slds-file-selector__text slds-medium-show">or Drop Files</span>
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
          <div className="slds-form-element__help slds-truncate" id="file-input-help" title={userHelpText}>
            {userHelpText}
          </div>
        )}
        {managedFilename && (
          <div className="slds-form-element__help slds-truncate" id="file-input-name" title={managedFilename}>
            {filenameTruncated}
          </div>
        )}
        {systemErrorMessage && (
          <div className="slds-form-element__help slds-truncate" id="file-input-system-error">
            {systemErrorMessage}
          </div>
        )}
        {hasError && errorMessage && (
          <div className="slds-form-element__help slds-truncate" id="file-input-error">
            {systemErrorMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileSelector;
