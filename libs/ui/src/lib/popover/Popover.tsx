import { css } from '@emotion/react';
import { Popover as HeadlessPopover } from '@headlessui/react';
import { SmallMediumLarge } from '@jetstream/types';
import { Rect } from '@popperjs/core';
import classNames from 'classnames';
import { nextTick } from 'process';
import { CSSProperties, forwardRef, Fragment, ReactNode, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePopper } from 'react-popper';
import { Placement } from 'tippy.js';
import { Icon } from '../widgets/Icon';

const ConditionalPortal = ({ omitPortal, portalRef, children }: { omitPortal: boolean; portalRef: Element; children: ReactNode }) => (
  // eslint-disable-next-line react/jsx-no-useless-fragment
  <Fragment>{omitPortal ? children : createPortal(children, portalRef || document.body)}</Fragment>
);

export interface PopoverRef {
  toggle: () => void;
  open: () => void;
  close: () => void;
  isOpen: () => void;
}

// TODO: add PopoverHeader and PopoverFooter components
// https://www.lightningdesignsystem.com/components/popovers
export interface PopoverProps {
  inverseIcons?: boolean;
  containerClassName?: string;
  bodyClassName?: string;
  placement?: Placement;
  content: JSX.Element;
  header?: JSX.Element;
  footer?: JSX.Element;
  panelStyle?: CSSProperties;
  buttonProps: React.HTMLProps<HTMLButtonElement> & { as?: string };
  size?: SmallMediumLarge;
  /** By default, the popover is displayed in a portal, but this can be skipped by setting this to true */
  omitPortal?: boolean;
  portalRef?: Element;
  children: ReactNode;
  onChange?: (isOpen: boolean) => void;
}

export const Popover = forwardRef<PopoverRef, PopoverProps>(
  (
    {
      inverseIcons,
      containerClassName,
      bodyClassName = 'slds-popover__body',
      placement = 'auto',
      content,
      header,
      footer,
      panelStyle,
      buttonProps,
      children,
      size,
      omitPortal = false,
      portalRef = document.body,
      onChange,
    }: PopoverProps,
    ref
  ) => {
    const isOpen = useRef<boolean>(false);
    const [referenceElement, setReferenceElement] = useState<HTMLElement>(null);
    const [popperElement, setPopperElement] = useState<HTMLElement>(null);
    const [arrowElement, setArrowElement] = useState<HTMLElement>(null);
    const [closeElement, setCloseElement] = useState<HTMLElement>(null);

    const offsetModifier = useCallback(
      ({ popper, reference, placement }: { popper: Rect; reference: Rect; placement: Placement }): [number, number] => {
        // for some reason storybook works correctly, but everything else is janky
        // ideally I would have a way to detect if janky or not, but not sure how
        if (placement === 'left') {
          return [0, reference.width + 15];
          // return [0, 12];
        } else if (placement === 'top') {
          // TODO: we need to dial this in
          // return [0, reference.height * 0.75];
          return [0, 12];
        } else {
          return [0, 12];
        }
      },
      []
    );

    const { styles, attributes } = usePopper(referenceElement, popperElement, {
      placement: placement,
      modifiers: [
        { name: 'arrow', options: { element: arrowElement } },
        { name: 'offset', options: { offset: offsetModifier } },
        // { name: 'offset', options: { offset: [0, 15] } },
      ],
    });

    /**
     * Allows a parent component to open or close
     */
    useImperativeHandle<unknown, PopoverRef>(
      ref,
      () => {
        return {
          toggle: () => referenceElement && referenceElement.click(),
          open: () => !popperElement && referenceElement && referenceElement.click(),
          close: () => closeElement && closeElement.click(),
          isOpen: () => !!popperElement,
        };
      },
      [referenceElement, popperElement, closeElement]
    );

    const checkIfStateChanged = useCallback(
      (open: boolean) => {
        if (open !== isOpen.current) {
          isOpen.current = open;
          if (onChange) {
            nextTick(() => onChange(open));
          }
        }
      },
      [onChange]
    );

    return (
      <HeadlessPopover className="slds-is-relative" as="span">
        {({ open }) => {
          checkIfStateChanged(open);
          return (
            <Fragment>
              {open && (
                <ConditionalPortal omitPortal={omitPortal} portalRef={portalRef}>
                  <HeadlessPopover.Panel
                    ref={setPopperElement}
                    style={{ ...styles.popper, ...panelStyle }}
                    {...attributes.popper}
                    className={classNames('slds-popover', size ? `slds-popover_${size}` : undefined, containerClassName)}
                    as="section"
                    static
                    css={css`
                      &[data-popper-placement^='right'] {
                        .popover-arrow {
                          left: -0.5rem;
                          &::after {
                            box-shadow: -1px 1px 2px 0 rgb(0 0 0 / 16%);
                          }
                        }
                      }

                      &[data-popper-placement^='left'] {
                        .popover-arrow {
                          right: -0.5rem;
                          &::after {
                            box-shadow: 1px -1px 2px 0 rgb(0 0 0 / 16%);
                          }
                        }
                      }

                      &[data-popper-placement^='top'] {
                        .popover-arrow {
                          bottom: -0.5rem;
                          &::after {
                            box-shadow: 2px 2px 4px 0 rgb(0 0 0 / 16%);
                          }
                          ${footer?.props?.className?.includes('slds-popover__footer') &&
                          !containerClassName?.includes('_error') &&
                          !containerClassName?.includes('_warning') &&
                          !containerClassName?.includes('_walkthrough') &&
                          `&::before {
                            background-color: #f3f2f2;
                          }`}
                        }
                      }

                      &[data-popper-placement^='bottom'] {
                        .popover-arrow {
                          top: -0.5rem;
                          &::after {
                            box-shadow: -1px -1px 0 0 rgb(0 0 0 / 16%);
                          }
                          ${containerClassName?.includes('_error') &&
                          `&::before {
                            background-color: #ba0517;
                          }`}
                          ${containerClassName?.includes('_warning') &&
                          `&::before {
                            background-color: #fe9339;
                          }`}
                          ${containerClassName?.includes('_walkthrough') &&
                          `&::before {
                            background-color: #032d60;
                          }`}
                        }
                      }
                    `}
                  >
                    {/* CLOSE BUTTON */}
                    <HeadlessPopover.Button
                      ref={setCloseElement}
                      className={classNames('slds-button slds-button_icon slds-button_icon-small slds-float_right slds-popover__close', {
                        'slds-button_icon-inverse': inverseIcons,
                      })}
                      title="Close dialog"
                    >
                      <Icon type="utility" icon="close" className="slds-button__icon" omitContainer />
                      <span className="slds-assistive-text">Close dialog</span>
                    </HeadlessPopover.Button>
                    {/* CONTENT */}
                    {header}
                    <div className={bodyClassName}>{content}</div>
                    {footer}
                    {/* ARROW */}
                    <div
                      css={css`
                        position: absolute;
                        width: 1rem;
                        height: 1rem;
                        background: inherit;
                        visibility: hidden;
                        &::before {
                          visibility: visible;
                          content: '';
                          transform: rotate(45deg);
                          position: absolute;
                          width: 1rem;
                          height: 1rem;
                          background: inherit;
                        }
                        &::after {
                          visibility: visible;
                          content: '';
                          transform: rotate(45deg);
                          position: absolute;
                          width: 1rem;
                          height: 1rem;
                          /* background-color: inherit; */
                        }
                      `}
                      className="popover-arrow"
                      ref={setArrowElement}
                      style={styles.arrow}
                    ></div>
                  </HeadlessPopover.Panel>
                </ConditionalPortal>
              )}

              <HeadlessPopover.Button ref={setReferenceElement} {...(buttonProps as typeof HeadlessPopover.Button)}>
                {children}
              </HeadlessPopover.Button>
            </Fragment>
          );
        }}
      </HeadlessPopover>
    );
  }
);

export default Popover;
