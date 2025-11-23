import { css } from '@emotion/react';
import classNames from 'classnames';
import { FunctionComponent, MouseEvent } from 'react';
import Icon from '../../widgets/Icon';
import Spinner from '../../widgets/Spinner';

export interface ImageFileProps {
  className?: string;
  width?: string;
  previewUrl?: string;
  filename: string;
  extension: string;
  content: string;
  loading?: boolean;
  uploadError?: string;
  onDelete?: (image: { filename: string; extension: string; content: string }) => void;
}

export const ImageFile: FunctionComponent<ImageFileProps> = ({
  className,
  width = '15rem',
  previewUrl,
  filename,
  extension,
  content,
  loading,
  uploadError,
  onDelete,
}) => {
  function handlePreview(event: MouseEvent<HTMLAnchorElement>) {
    if (!previewUrl) {
      event.preventDefault();
    }
  }

  return (
    <div
      className={classNames('slds-file slds-file_card slds-has-title', { 'slds-file_loading': loading || !previewUrl }, className)}
      css={css`
        width: ${width};
      `}
    >
      <figure>
        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="slds-file__crop" onClick={handlePreview}>
          <span className="slds-assistive-text">Preview:</span>
          {loading && <Spinner className="slds-spinner slds-spinner_medium" />}
          <img src={content} alt={`Preview of ${filename}`} />
        </a>
        <figcaption className="slds-file__title slds-file__title_card slds-file-has-actions">
          <div className="slds-media slds-media_small slds-media_center">
            <div className="slds-media slds-media_small slds-media_center">
              <div className="slds-media__figure slds-line-height_reset">
                {!uploadError && <Icon type="doctype" icon="image" className="slds-icon slds-icon_x-small" />}
                {uploadError && (
                  <Icon type="utility" icon="error" description="Error uploading file" className="slds-icon slds-icon_x-small" />
                )}
              </div>
            </div>
            <div className="slds-media__body">
              <span
                className={classNames('slds-file__text slds-truncate', { 'slds-text-color_error': uploadError })}
                title={uploadError || filename}
              >
                {uploadError || filename}
              </span>
            </div>
          </div>
        </figcaption>
      </figure>
      <div className="slds-file__actions-menu">
        <div className="slds-button-group" role="group">
          <a
            href={content}
            target="_self"
            download={filename}
            className="slds-button slds-button_icon slds-button_icon slds-button_icon-x-small"
            title="Download"
          >
            <Icon type="utility" icon="download" className="slds-button__icon" description="Download" omitContainer />
            <span className="slds-assistive-text">Download</span>
          </a>
          {onDelete && (
            <button
              className="slds-button slds-button_icon slds-button_icon slds-button_icon-x-small"
              title="Delete"
              onClick={() => onDelete({ filename, extension, content })}
            >
              <Icon type="utility" icon="delete" className="slds-button__icon" description="Delete" omitContainer />
              <span className="slds-assistive-text">Delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageFile;
