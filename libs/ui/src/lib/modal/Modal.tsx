import { css, SerializedStyles } from '@emotion/react';
import { isEscapeKey } from '@jetstream/shared/ui-utils';
import { Maybe, SizeSmMdLg } from '@jetstream/types';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { AriaOverlayProps, OverlayContainer, useModal, useOverlay, usePreventScroll } from '@react-aria/overlays';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import { forwardRef, KeyboardEvent, MutableRefObject, ReactNode, useRef, useState } from 'react';
import Icon from '../widgets/Icon';

export interface ModalProps {
  className?: string;
  classStyles?: SerializedStyles;
  hide?: boolean; // used to hide the modal without destroying contents
  header?: Maybe<string | JSX.Element>;
  tagline?: Maybe<string | JSX.Element>;
  footer?: JSX.Element;
  directionalFooter?: boolean;
  containerClassName?: string;
  footerClassName?: string;
  size?: SizeSmMdLg;
  closeDisabled?: boolean;
  closeOnEsc?: boolean;
  closeOnBackdropClick?: boolean;
  /** @deprecated This no longer does anything */
  skipAutoFocus?: boolean;
  overrideZIndex?: number;
  additionalOverlayProps?: AriaOverlayProps;
  sectionRef?: MutableRefObject<HTMLElement>;
  children: ReactNode;
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

export const Modal = forwardRef<any, ModalProps>(
  (
    {
      className,
      classStyles,
      hide,
      header,
      tagline,
      footer,
      directionalFooter,
      containerClassName,
      footerClassName,
      size,
      closeDisabled,
      closeOnEsc = true,
      closeOnBackdropClick = true,
      skipAutoFocus,
      overrideZIndex,
      additionalOverlayProps,
      sectionRef,
      children,
      onClose,
    },
    providedRef
  ) => {
    const _ref = useRef(providedRef);
    const ref = providedRef || _ref;
    const [modalId] = useState(uniqueId('modal-content'));
    const { overlayProps, underlayProps } = useOverlay(
      {
        isOpen: true,
        // TODO: I could not get these to work, had to implement these manually
        isDismissable: closeOnBackdropClick,
        isKeyboardDismissDisabled: closeOnEsc,
        onClose: () => {
          onClose();
        },
        ...additionalOverlayProps,
      },
      ref as any
    );

    // Prevent scrolling while the modal is open, and hide content
    // outside the modal from screen readers.
    usePreventScroll();
    const { modalProps } = useModal();

    // Get props for the dialog and its title
    const { dialogProps, titleProps } = useDialog({ role: 'dialog' }, ref as any);

    function handleKeyUp(event: KeyboardEvent<HTMLInputElement>) {
      if (!closeDisabled && closeOnEsc && isEscapeKey(event)) {
        onClose();
      }
    }

    return (
      <OverlayContainer
        // ensure children under overlay do not know this even was clicked if not handled by anything inside modal
        onContextMenu={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
        }}
      >
        <FocusScope contain restoreFocus autoFocus>
          <section
            {...overlayProps}
            {...dialogProps}
            {...modalProps}
            ref={ref}
            role="dialog"
            tabIndex={-1}
            className={classNames('slds-modal', { 'slds-slide-up-open': !hide }, getSizeClass(size))}
            aria-modal="true"
            aria-describedby={modalId}
            onKeyUp={handleKeyUp}
            css={css`
              ${overrideZIndex ? `z-index: ${overrideZIndex}` : ''}
            `}
          >
            <div className={classNames('slds-modal__container', containerClassName)}>
              <header className={classNames('slds-modal__header', { 'slds-modal__header_empty': !header })}>
                <button
                  className="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse"
                  title="Close"
                  disabled={closeDisabled}
                  onClick={() => onClose()}
                >
                  <Icon type="utility" icon="close" className="slds-button__icon slds-button__icon_large" omitContainer />
                  <span className="slds-assistive-text">Close</span>
                </button>
                <h2 className="slds-modal__title slds-hyphenate" {...titleProps}>
                  {header}
                </h2>
                {tagline && <div className="slds-m-top_x-small">{tagline}</div>}
              </header>
              <div id={modalId} className={classNames('slds-modal__content', className || 'slds-p-around_medium')} css={classStyles}>
                {children}
              </div>
              {footer && (
                <footer
                  className={classNames('slds-modal__footer', { 'slds-modal__footer_directional': directionalFooter }, footerClassName)}
                >
                  {footer}
                </footer>
              )}
            </div>
          </section>
        </FocusScope>
        {!hide && (
          <button
            className="slds-backdrop slds-backdrop_open"
            css={css`
              ${overrideZIndex ? `z-index: ${overrideZIndex - 1}` : ''}
            `}
            {...underlayProps}
          >
            <span className="sr-only">Close Modal</span>
          </button>
        )}
      </OverlayContainer>
    );
  }
);

export default Modal;
