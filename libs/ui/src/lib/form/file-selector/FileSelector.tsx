import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { readFile, useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import { InputAcceptType, InputReadFileContent, Maybe } from '@jetstream/types';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { FunctionComponent, useCallback, useRef, useState } from 'react';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import { useFilename } from './useFilename';

export interface FileSelectorProps {
  className?: string;
  id: string;
  label: string;
  buttonLabel?: string;
  labelHelp?: string | null;
  /** @deprecated I guess? is not used in code, use `userHelpText` instead */
  helpText?: React.ReactNode | string; // FIXME: does not appear to be used, userHelpText is used
  isRequired?: boolean;
  filename?: Maybe<string>; // optional, will be managed if not provided
  omitFilename?: boolean;
  hideLabel?: boolean;
  disabled?: boolean;
  accept?: InputAcceptType[];
  allowFromClipboard?: boolean;
  userHelpText?: React.ReactNode | string;
  hasError?: boolean;
  errorMessage?: React.ReactNode | string;
  maxAllowedSizeMB?: number;
  allowMultipleFiles?: boolean;
  onReadFile: (fileContent: InputReadFileContent) => void;
}

export const FileSelector: FunctionComponent<FileSelectorProps> = ({
  className,
  id,
  label,
  buttonLabel = 'Upload File',
  labelHelp,
  filename,
  omitFilename = false,
  isRequired,
  hideLabel,
  disabled,
  accept,
  allowFromClipboard,
  userHelpText,
  hasError,
  errorMessage,
  maxAllowedSizeMB,
  allowMultipleFiles = false,
  onReadFile,
}) => {
  const [labelPrimaryId] = useState(() => `${id}-label-primary`);
  const [labelSecondaryId] = useState(() => `${id}-label`);
  const [systemErrorMessage, setSystemErrorMessage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
    event.target?.files && handleFiles(event.target.files);
  }

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      try {
        if (!allowFromClipboard || !event.clipboardData || !event.clipboardData?.items?.length) {
          return;
        }
        const item = event.clipboardData.items[0];
        if (item.kind === 'file') {
          setSystemErrorMessage(null);
          setManagedFilename(null);
          handleFile(item.getAsFile());
        } else if (item.kind === 'string') {
          item.getAsString((content) => {
            if (content && content.split('\n').length > 1) {
              setManagedFilename('Clipboard-Paste.csv');
              onReadFile({ filename: 'Clipboard-Paste.csv', extension: '.csv', content, isPasteFromClipboard: true });
            }
          });
        }
      } catch (ex) {
        logger.warn('[CLIPBOARD] Failed to handle clipboard paste', ex);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowFromClipboard, setManagedFilename]
  );

  useGlobalEventHandler('paste', handlePaste);

  async function handleFiles(files: FileList) {
    try {
      setSystemErrorMessage(null);
      setManagedFilename(null);
      if (!files || files.length === 0) {
        return;
      } else if (!allowMultipleFiles && files.length > 1) {
        throw new Error('Only 1 file is supported');
      }
      handleFile(files.item(0));
    } catch (ex) {
      setSystemErrorMessage(ex.message);
      setManagedFilename(null);
    }
  }

  async function handleFile(file: File | null) {
    try {
      if (!file) {
        return;
      }
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

      const readAsArrayBuffer = extension !== '.csv' && extension !== '.tsv' && extension !== '.xml';
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
              multiple={allowMultipleFiles}
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
              <span className="slds-file-selector__text slds-medium-show">Drop File</span>
            </label>
            {allowFromClipboard && <div className="slds-file-selector__text slds-m-top_xx-small">Or paste from clipboard</div>}
          </div>
        </div>
      </div>
      <div
        css={css`
          min-height: 20px;
        `}
      >
        {!!userHelpText && !managedFilename && (
          <div
            className="slds-form-element__help slds-truncate"
            id={`${id}-file-input-help`}
            title={isString(userHelpText) ? userHelpText : ''}
          >
            {userHelpText}
          </div>
        )}
        {!omitFilename && filenameTruncated && (
          <div className="slds-form-element__help slds-truncate" id={`${id}-file-input-name`} title={managedFilename || ''}>
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
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileSelector;
