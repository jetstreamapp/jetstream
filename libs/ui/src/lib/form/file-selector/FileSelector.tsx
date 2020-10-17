import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import Icon from '../../widgets/Icon';
import { logger } from '@jetstream/shared/client-logger';
import { readFile } from '@jetstream/shared/ui-utils';
import { InputAcceptType, InputReadFileContent } from '@jetstream/types';

export interface FileSelectorProps {
  id: string;
  label: string;
  initialFilename?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  accept?: InputAcceptType[];
  readAs?: 'string' | '';
  userHelpText?: string;
  onReadFile: (fileContent: InputReadFileContent) => void;
}

export const FileSelector: FunctionComponent<FileSelectorProps> = ({
  id,
  label,
  initialFilename,
  hideLabel,
  disabled,
  accept,
  userHelpText,
  onReadFile,
}) => {
  const [labelPrimaryId] = useState(() => `${id}-label-primary`);
  const [labelSecondaryId] = useState(() => `${id}-label`);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [filename, setFilename] = useState<string>(initialFilename);
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
      setErrorMessage(null);
      setFilename(null);
      if (!files || files.length === 0) {
        return;
      } else if (files.length > 1) {
        throw new Error('Only 1 file is supported');
      }
      const file = files.item(0);

      // TODO: There is probably a way to improve this, but extension vs mime is a bit tricky
      if (accept && !accept.includes(file.type as any)) {
        throw new Error(`File type ${file.type} is not supported`);
      }

      logger.info(file);
      setFilename(file.name);
      const extension = file.name.substring(file.name.lastIndexOf('.')) || '';

      // TODO: we might want to do something else here in the future
      const readAsArrayBuffer = extension.toLowerCase() !== '.csv';
      const content = await readFile(file, readAsArrayBuffer);

      onReadFile({ filename: file.name, extension, content });
    } catch (ex) {
      setErrorMessage(ex.message);
      setFilename(null);
    } finally {
      if (inputRef?.current) {
        inputRef.current.value = '';
      }
    }
  }

  return (
    <div className={classNames('"slds-form-element"', { 'slds-has-error': errorMessage })}>
      <span className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })} id={labelPrimaryId}>
        {label}
      </span>
      <div className="slds-form-element__control">
        <div className="slds-file-selector slds-file-selector_files">
          <div
            className={classNames('slds-file-selector__dropzone', { 'slds-has-drag-over': isDraggingOver && !errorMessage })}
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
              aria-describedby="file-input-help file-input-error file-input-name"
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
      {userHelpText && !filename && (
        <div className="slds-form-element__help slds-truncate" id="file-input-help" title={userHelpText}>
          {userHelpText}
        </div>
      )}
      {filename && (
        <div className="slds-form-element__help slds-truncate" id="file-input-name" title={filename}>
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

export default FileSelector;
