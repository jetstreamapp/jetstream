import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { InputAcceptType, InputReadFileContent } from '@jetstream/types';
import { FunctionComponent, useCallback, useRef, useState } from 'react';
import { fireToast } from '../../toast/AppToast';
import Icon from '../../widgets/Icon';
import { getFileExtension, readFileForUpload } from './file-selector-utils';

export interface FileDropTargetProps {
  accept?: InputAcceptType[];
  /** A function receives the dropped file's extension, for pages where the limit differs per file type */
  maxAllowedSizeMB?: number | ((extension: InputAcceptType) => number | undefined);
  disabled?: boolean;
  /** Headline shown on the overlay while a file is dragged over the page */
  label?: string;
  onReadFile: (fileContent: InputReadFileContent) => void;
}

function isFileDrag(event: DragEvent) {
  return !!event.dataTransfer?.types?.includes('Files');
}

/**
 * Makes the whole page a drop target for the file input on it, so a file can be dropped anywhere instead of
 * only on the file selector itself. The file is validated and read exactly as the file input does, and problems
 * surface as a toast since there is no field to attach an error to.
 *
 * Listeners are global rather than wrapping the page content, which keeps this out of the layout entirely.
 * A drop onto the file selector stops propagation, so it is handled there and never twice.
 */
export const FileDropTarget: FunctionComponent<FileDropTargetProps> = ({
  accept,
  maxAllowedSizeMB,
  disabled,
  label = 'Drop your file to upload',
  onReadFile,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // dragenter/dragleave fire for every element the pointer crosses, so track depth instead of a boolean
  const dragDepth = useRef(0);

  /**
   * Cancelling the browser default is NOT conditional on `disabled`: an un-cancelled dragover means the browser
   * opens the dropped file itself, unloading the app and taking any in-progress work with it. While disabled the
   * drag is swallowed and nothing is read.
   */
  const handleDragEnter = useCallback(
    (event: DragEvent) => {
      if (!isFileDrag(event)) {
        return;
      }
      event.preventDefault();
      if (disabled) {
        return;
      }
      dragDepth.current += 1;
      setIsDraggingOver(true);
    },
    [disabled],
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    if (!isFileDrag(event)) {
      return;
    }
    event.preventDefault();
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    if (!isFileDrag(event)) {
      return;
    }
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent) => {
      dragDepth.current = 0;
      setIsDraggingOver(false);
      if (!isFileDrag(event)) {
        return;
      }
      event.preventDefault();
      if (disabled) {
        return;
      }

      const [file] = Array.from(event.dataTransfer?.files || []);
      if (!file) {
        return;
      }
      try {
        const sizeLimit = typeof maxAllowedSizeMB === 'function' ? maxAllowedSizeMB(getFileExtension(file.name)) : maxAllowedSizeMB;
        onReadFile(await readFileForUpload(file, { accept, maxAllowedSizeMB: sizeLimit }));
      } catch (ex) {
        logger.warn('[FILE DROP] Unable to read dropped file', ex);
        fireToast({ type: 'error', message: getErrorMessage(ex) });
      }
    },
    [accept, disabled, maxAllowedSizeMB, onReadFile],
  );

  useGlobalEventHandler('dragenter', handleDragEnter);
  useGlobalEventHandler('dragover', handleDragOver);
  useGlobalEventHandler('dragleave', handleDragLeave);
  useGlobalEventHandler('drop', handleDrop);

  if (!isDraggingOver) {
    return null;
  }

  return (
    <div
      data-testid="file-drop-overlay"
      css={css`
        position: fixed;
        inset: 0;
        z-index: 9000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        /* The drop is handled on window, so the overlay never needs to receive the event itself */
        pointer-events: none;
        background-color: color-mix(in srgb, var(--slds-g-color-neutral-base-100, #fff) 82%, transparent);
        box-shadow: inset 0 0 0 3px var(--slds-g-color-brand-base-50, #0176d3);
      `}
    >
      <Icon type="utility" icon="upload" className="slds-icon slds-icon_large slds-icon-text-default" omitContainer />
      <span className="slds-text-heading_medium">{label}</span>
      {!!accept?.length && <span className="slds-text-body_regular slds-text-color_weak">{accept.join(', ')}</span>}
    </div>
  );
};

export default FileDropTarget;
