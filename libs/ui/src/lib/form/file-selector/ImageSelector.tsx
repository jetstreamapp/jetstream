import { logger } from '@jetstream/shared/client-logger';
import { deleteImage, uploadImage } from '@jetstream/shared/data';
import { readFile, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { NOOP } from '@jetstream/shared/utils';
import { ImageWithUpload, InputAcceptType } from '@jetstream/types';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import Grid from '../../grid/Grid';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import ImageFile from './ImageFile';

const ACCEPTED_IMAGE_EXTENSIONS = /\.(gif|png|webp|bmp|jpg|jpe?g|svg)$/i;

export interface ImageSelectorProps {
  className?: string;
  /** Provided if there is a parent component that should be a draggable boundary */
  draggableRef?: HTMLElement;
  label?: string;
  buttonLabel?: string;
  labelHelp?: string | null;
  hideLabel?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  errorMessage?: React.ReactNode | string;
  showPreview?;
  autoUploadImages?: boolean;
  onImages: (fileContent: ImageWithUpload[]) => void;
}

export const ImageSelector: FunctionComponent<ImageSelectorProps> = ({
  className,
  draggableRef,
  label = 'Image Attachments',
  buttonLabel = 'Upload Image',
  labelHelp,
  hideLabel,
  disabled,
  hasError,
  errorMessage,
  showPreview = true,
  autoUploadImages = true,
  onImages,
}) => {
  const isMounted = useRef(true);
  const [systemErrorMessage, setSystemErrorMessage] = useState<string | null>(null);
  const [id] = useState(uniqueId('image-selector'));
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>();

  const [loadedImages, setLoadedImages] = useState<ImageWithUpload[]>([]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (draggableRef) {
      draggableRef.addEventListener('dragenter', handleDragEnter as any);
      draggableRef.addEventListener('dragover', handleDragEnter as any);
      draggableRef.addEventListener('dragleave', handleDragLeave as any);
      draggableRef.addEventListener('drop', handleDrop as any);

      return () => {
        draggableRef.removeEventListener('dragenter', handleDragEnter as any);
        draggableRef.removeEventListener('dragover', handleDragEnter as any);
        draggableRef.removeEventListener('dragleave', handleDragLeave as any);
        draggableRef.removeEventListener('drop', handleDrop as any);
      };
    }
  }, [draggableRef]);

  useNonInitialEffect(() => {
    onImages(loadedImages);
  }, [loadedImages, onImages]);

  function preventEventDefaults(event: React.DragEvent<HTMLElement> | React.ChangeEvent<HTMLInputElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragEnter(event: React.DragEvent<HTMLElement>) {
    preventEventDefaults(event);
    setIsDraggingOver(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLElement>) {
    preventEventDefaults(event);
    setIsDraggingOver(false);
  }

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    preventEventDefaults(event);
    setIsDraggingOver(false);
    if (!disabled) {
      handleFiles(event.dataTransfer?.files);
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    preventEventDefaults(event);
    event.target?.files && handleFiles(event.target.files);
  }

  async function handleFiles(files: FileList) {
    try {
      setSystemErrorMessage(null);
      if (!files || files.length === 0) {
        return;
      }

      const images: ImageWithUpload[] = [];

      for (const file of Array.from(files)) {
        logger.info(file);
        const extension = (file.name.substring(file.name.lastIndexOf('.')) || '').toLowerCase() as InputAcceptType;

        if (ACCEPTED_IMAGE_EXTENSIONS.test(file.name)) {
          const content = await readFile(file, 'data_url');
          const image: ImageWithUpload = {
            id: uniqueId('image-'),
            filename: file.name,
            extension,
            content,
            uploading: autoUploadImages,
          };
          images.push(image);
        } else {
          // TODO: we have at least one error!
        }
      }

      if (images.length) {
        // upload images
        setLoadedImages((priorImages) => priorImages.concat(images));
        if (autoUploadImages) {
          for (const image of images) {
            try {
              // see if we have valid signature, else get one
              const response = await uploadImage(image);
              if (!isMounted.current) {
                return;
              }
              setLoadedImages((priorImages) =>
                priorImages.map((currImage) =>
                  currImage.id !== image.id
                    ? currImage
                    : {
                        ...currImage,
                        uploading: false,
                        url: response.url,
                        deleteToken: response.delete_token,
                      }
                )
              );
            } catch (ex) {
              logger.error('[IMAGE UPLOAD] Failed to load image to cloudinary', ex);
              setLoadedImages((priorImages) =>
                priorImages.map((currImage) =>
                  currImage.id !== image.id
                    ? currImage
                    : {
                        ...currImage,
                        uploading: false,
                        error: 'Image upload failed',
                      }
                )
              );
            }
          }
        }
      }
    } catch (ex) {
      setSystemErrorMessage(ex.message);
    } finally {
      if (inputRef?.current) {
        inputRef.current.value = '';
      }
    }
  }

  function handleRemoveImage(idToRemove: string) {
    const indexToRemove = loadedImages.findIndex(({ id }) => id === idToRemove);
    if (indexToRemove >= 0) {
      if (loadedImages[indexToRemove].deleteToken) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        deleteImage(loadedImages[indexToRemove].deleteToken!)
          .then(NOOP)
          .catch((err) => {
            logger.warn('[IMAGE UPLOAD] Failed to delete image', err);
          });
      }
      setLoadedImages(loadedImages.filter(({ id }) => id !== idToRemove));
    }
  }

  const hasErrorState = !!(systemErrorMessage || (hasError && errorMessage));

  return (
    <Fragment>
      <div className={classNames('slds-form-element', { 'slds-has-error': hasErrorState }, className)}>
        <span className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })} id={`${id}-primary-label`}>
          {label}
        </span>
        {labelHelp && label && !hideLabel && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
        <div className="slds-form-element__control">
          <div className="slds-file-selector slds-file-selector_images">
            <div
              className={classNames('slds-file-selector__dropzone', { 'slds-has-drag-over': !disabled && isDraggingOver })}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                className="slds-file-selector__input slds-assistive-text"
                accept="image/*"
                id={id}
                aria-describedby={hasErrorState ? `${id}-error` : undefined}
                aria-labelledby={`${id}-primary-label ${id}-secondary-label`}
                disabled={disabled}
                onChange={handleInputChange}
              />
              <label className="slds-file-selector__body" htmlFor={id} id={`${id}-label`}>
                <span className="slds-file-selector__button slds-button slds-button_neutral">
                  <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
                  {buttonLabel}
                </span>
                <span className="slds-file-selector__text slds-medium-show">or Drop Image</span>
              </label>
            </div>
          </div>
          {hasErrorState && (
            <div className="slds-form-element__help" id={`${id}-error`}>
              {systemErrorMessage || errorMessage}
            </div>
          )}
        </div>
      </div>
      {showPreview && (
        <Grid className="slds-m-top_small" wrap>
          {loadedImages.map(({ id, content, extension, filename, uploading, url, error }) => (
            <div key={id} className="slds-p-around_xx-small">
              <ImageFile
                content={content}
                extension={extension}
                filename={filename}
                loading={uploading}
                previewUrl={url}
                uploadError={error}
                onDelete={() => handleRemoveImage(id)}
              />
            </div>
          ))}
        </Grid>
      )}
    </Fragment>
  );
};

export default ImageSelector;
