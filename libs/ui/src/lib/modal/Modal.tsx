import React, { Fragment, FunctionComponent } from 'react';
import Icon from '../widgets/Icon';
import { SizeSmMdLg } from '@jetstream/types';
import classNames from 'classnames';

/* eslint-disable-next-line */
export interface ModalProps {
  header?: string | JSX.Element;
  tagline?: string | JSX.Element;
  footer?: JSX.Element;
  directionalFooter?: boolean;
  size?: SizeSmMdLg;
  containerClassName?: string;
  closeOnBackdropClick?: boolean;
  onClose: () => void;
}

function getSizeClass(size?: SizeSmMdLg) {
  switch (size) {
    case 'sm':
      return 'slds-modal_small';
    case 'md':
      return 'slds-modal_medium';
    case 'lg':
      return 'slds-modal_large';
    default:
      return '';
  }
}

export const Modal: FunctionComponent<ModalProps> = ({
  header,
  tagline,
  footer,
  directionalFooter,
  size,
  containerClassName,
  closeOnBackdropClick,
  children,
  onClose,
}) => {
  return (
    <Fragment>
      <section
        role="dialog"
        tabIndex={-1}
        className={classNames(containerClassName || 'slds-modal slds-fade-in-open slds-slide-up-saving', getSizeClass(size))}
        aria-labelledby="modal"
        aria-modal="true"
        aria-describedby="modal-content"
      >
        <div className="slds-modal__container">
          <header className={classNames('slds-modal__header', { 'slds-modal__header_empty': !header })}>
            <button
              className="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse"
              title="Close"
              onClick={() => onClose()}
            >
              <Icon type="utility" icon="close" className="slds-button__icon slds-button__icon_large" omitContainer />
              <span className="slds-assistive-text">Close</span>
            </button>
            <h2 id="modal" className="slds-modal__title slds-hyphenate">
              {header}
            </h2>
            {tagline && <p className="slds-m-top_x-small">{tagline}</p>}
          </header>
          <div className="slds-modal__content slds-p-around_medium" id="modal-content">
            {children}
          </div>
          {footer && (
            <footer className={classNames('slds-modal__footer', { 'slds-modal__footer_directional': directionalFooter })}>{footer}</footer>
          )}
        </div>
      </section>
      {<div className="slds-backdrop slds-backdrop_open" onClick={() => closeOnBackdropClick && onClose()}></div>}
    </Fragment>
  );
};

export default Modal;
