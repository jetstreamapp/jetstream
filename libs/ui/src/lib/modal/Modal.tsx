import { css, SerializedStyles } from '@emotion/react';
import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useId,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { isEscapeKey } from '@jetstream/shared/ui-utils';
import { Maybe, SizeSmMdLg } from '@jetstream/types';
import classNames from 'classnames';
import { forwardRef, KeyboardEvent, MutableRefObject, ReactNode, useEffect, useRef, useState } from 'react';
import Icon from '../widgets/Icon';
import { PortalProvider } from './PortalContext';

export interface ModalProps {
  className?: string;
  classStyles?: SerializedStyles;
  hide?: boolean; // used to hide the modal without destroying contents
  header?: Maybe<string | React.ReactNode>;
  tagline?: Maybe<string | React.ReactNode>;
  footer?: React.ReactNode;
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
      sectionRef,
      children,
      onClose,
    },
    providedRef
  ) => {
    const _ref = useRef(providedRef);
    const ref = providedRef || _ref;
    const [isOpen] = useState(true);
    const modalId = useId();
    const titleId = useId();

    const { refs, context } = useFloating({
      open: isOpen && !hide,
      onOpenChange: (open) => {
        if (!open && !closeDisabled) {
          onClose();
        }
      },
    });

    const dismiss = useDismiss(context, {
      enabled: !closeDisabled,
      escapeKey: closeOnEsc,
      outsidePress: closeOnBackdropClick,
    });

    const role = useRole(context, { role: 'dialog' });

    const { getFloatingProps } = useInteractions([dismiss, role]);

    // Prevent body scroll when modal is open
    useEffect(() => {
      if (!hide) {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = originalOverflow;
        };
      }
    }, [hide]);

    function handleKeyUp(event: KeyboardEvent<HTMLElement>) {
      if (!closeDisabled && closeOnEsc && isEscapeKey(event)) {
        onClose();
      }
    }

    function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
      if (!closeDisabled && closeOnBackdropClick && event.target === event.currentTarget) {
        onClose();
      }
    }

    if (hide) {
      return null;
    }

    return (
      <PortalProvider portalRoot={providedRef && 'current' in providedRef && providedRef.current}>
        <FloatingPortal>
          <FloatingOverlay
            className="slds-backdrop slds-backdrop_open"
            lockScroll
            style={{
              zIndex: overrideZIndex ? overrideZIndex - 1 : undefined,
            }}
            onClick={handleBackdropClick}
          >
            <FloatingFocusManager context={context} modal returnFocus>
              <section
                ref={(node) => {
                  refs.setFloating(node);
                  if (typeof ref === 'function') {
                    ref(node);
                  } else if (ref && 'current' in ref) {
                    ref.current = node;
                  }
                }}
                {...getFloatingProps()}
                role="dialog"
                tabIndex={-1}
                className={classNames('slds-modal slds-slide-up-open', getSizeClass(size))}
                aria-modal="true"
                aria-describedby={modalId}
                aria-labelledby={titleId}
                onKeyUp={handleKeyUp}
                onContextMenu={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                }}
                css={css`
                  ${overrideZIndex ? `z-index: ${overrideZIndex}` : ''}
                `}
              >
                <div className={classNames('slds-modal__container', containerClassName)}>
                  <header className={classNames('slds-modal__header', { 'slds-modal__header_empty': !header })}>
                    <button
                      className="slds-button slds-button_icon slds-modal__close"
                      title="Close"
                      disabled={closeDisabled}
                      onClick={() => onClose()}
                    >
                      <Icon type="utility" icon="close" className="slds-button__icon slds-button__icon_large" omitContainer />
                      <span className="slds-assistive-text">Close</span>
                    </button>
                    <h2 id={titleId} className="slds-modal__title slds-hyphenate">
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
            </FloatingFocusManager>
          </FloatingOverlay>
        </FloatingPortal>
      </PortalProvider>
    );
  }
);

export default Modal;
