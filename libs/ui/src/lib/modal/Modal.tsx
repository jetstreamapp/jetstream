import React, { Fragment, FunctionComponent, useRef, useEffect } from 'react';
import Icon from '../widgets/Icon';
import { SizeSmMdLg } from '@jetstream/types';
import classNames from 'classnames';
import { useHotkeys } from 'react-hotkeys-hook';
import { createPortal } from 'react-dom';

/* eslint-disable-next-line */
export interface ModalProps {
  className?: string;
  header?: string | JSX.Element;
  tagline?: string | JSX.Element;
  footer?: JSX.Element;
  directionalFooter?: boolean;
  size?: SizeSmMdLg;
  containerClassName?: string;
  closeOnBackdropClick?: boolean;
  skipAutoFocus?: boolean;
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

// https://reactjs.org/docs/portals.html
const modalRoot = document.getElementById('modal-root');
export class Modal extends React.Component<ModalProps> {
  el: HTMLDivElement;
  constructor(props) {
    super(props);
    this.el = document.createElement('div');
  }

  componentDidMount() {
    // The portal element is inserted in the DOM tree after
    // the Modal's children are mounted, meaning that children
    // will be mounted on a detached DOM node. If a child
    // component requires to be attached to the DOM tree
    // immediately when mounted, for example to measure a
    // DOM node, or uses 'autoFocus' in a descendant, add
    // state to Modal and only render the children when Modal
    // is inserted in the DOM tree.
    if (modalRoot) {
      modalRoot.appendChild(this.el);
    }
  }

  componentWillUnmount() {
    if (modalRoot) {
      modalRoot.removeChild(this.el);
    }
  }

  render() {
    if (modalRoot) {
      return createPortal(<ModalContent {...this.props} />, this.el);
    } else {
      return <ModalContent {...this.props} />;
    }
  }
}

export const ModalContent: FunctionComponent<ModalProps> = ({
  header,
  tagline,
  footer,
  directionalFooter,
  size,
  containerClassName,
  closeOnBackdropClick,
  skipAutoFocus,
  children,
  onClose,
}) => {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!skipAutoFocus) {
      closeButtonRef.current.focus();
    }
  }, []);

  return (
    <Fragment>
      <section
        role="dialog"
        tabIndex={-1}
        className={classNames(containerClassName || 'slds-modal slds-slide-up-open', getSizeClass(size))}
        aria-labelledby="modal"
        aria-modal="true"
        aria-describedby="modal-content"
      >
        <div className="slds-modal__container">
          <header className={classNames('slds-modal__header', { 'slds-modal__header_empty': !header })}>
            <button
              className="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse"
              title="Close"
              ref={closeButtonRef}
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
      {<div className="slds-backdrop slds-backdrop_open"></div>}
    </Fragment>
  );
};

export default Modal;
