import { css, SerializedStyles } from '@emotion/react';
import { JSX } from '@emotion/react/jsx-runtime';
import {
  arrow,
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  type Placement,
} from '@floating-ui/react';
import { FullWidth, sizeXLarge, SmallMediumLarge } from '@jetstream/types';
import classNames from 'classnames';
import { createElement, CSSProperties, ReactNode, RefObject, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Tooltip, TooltipProps } from '../..';
import { usePortalContext } from '../modal/PortalContext';
import { Icon } from '../widgets/Icon';

export interface PopoverRef {
  toggle: () => void;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

// TODO: add PopoverHeader and PopoverFooter components
// https://www.lightningdesignsystem.com/components/popovers
export interface PopoverProps {
  ref?: RefObject<PopoverRef | null>;
  testId?: string;
  inverseIcons?: boolean;
  classname?: string;
  containerClassName?: string;
  closeBtnClassName?: string;
  bodyClassName?: string;
  bodyStyle?: SerializedStyles;
  placement?: Placement;
  content: ReactNode;
  header?: React.ReactNode;
  footer?: JSX.Element;
  panelStyle?: CSSProperties;
  buttonProps?: React.HTMLProps<HTMLButtonElement> & { as?: string; 'data-testid'?: string };
  panelProps?: Omit<React.HTMLProps<HTMLDivElement>, 'children' | 'className' | 'as' | 'refName' | 'onKeyDown'>;
  buttonStyle?: CSSProperties;
  /**
   * If provided, there will be a tooltip on the popover trigger button.
   */
  tooltipProps?: TooltipProps;
  size?: SmallMediumLarge | sizeXLarge | FullWidth;
  /**
   * Additional content to render after the popover content.
   * This is useful for adding elements like a close button or additional actions.
   */
  triggerAfterContent?: ReactNode;
  children: ReactNode;
  onChange?: (isOpen: boolean) => void;
}

export const Popover = ({
  ref,
  testId,
  classname,
  inverseIcons,
  containerClassName,
  closeBtnClassName,
  bodyClassName = 'slds-popover__body',
  bodyStyle,
  placement,
  content,
  header,
  footer,
  panelStyle,
  buttonProps,
  panelProps,
  buttonStyle,
  tooltipProps,
  triggerAfterContent,
  children,
  size,
  onChange,
}: PopoverProps) => {
  const { isInPortal, portalRoot } = usePortalContext();
  const [isOpen, setIsOpen] = useState(false);
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null);

  const {
    refs,
    floatingStyles,
    placement: currentPlacement,
    middlewareData,
    context,
  } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      setIsOpen(open);
      if (onChange) {
        onChange(open);
      }
    },
    placement,
    middleware: [
      offset(12),
      flip(),
      shift({ padding: 8 }),
      arrow({
        element: arrowElement,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const { x: arrowX, y: arrowY } = middlewareData.arrow || {};

  const click = useClick(context);
  const dismiss = useDismiss(context, {
    outsidePressEvent: 'mousedown',
    ancestorScroll: false,
  });
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  /**
   * Allows a parent component to open or close
   */
  useImperativeHandle(ref, () => {
    return {
      toggle: () => setIsOpen((prev) => !prev),
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      isOpen: () => isOpen,
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * Popovers used in modals did not close when clicking outside of them.
   * This is a manual solution to ensure that the popover closes when clicking outside of it.
   */
  useEffect(() => {
    if (!isOpen || !isInPortal) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Element;
      const popoverElement = refs.floating.current;
      const referenceElement = refs.domReference.current;

      // If click is outside both popover and its trigger
      if (popoverElement && referenceElement && !popoverElement.contains(target) && !referenceElement.contains(target)) {
        setIsOpen(false);
      }
    };

    // Use capture phase to ensure we catch the event before modal
    document.addEventListener('mousedown', handleOutsideClick, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
    };
  }, [isOpen, refs.floating, refs.domReference, isInPortal]);

  const { as: TriggerElement = 'button', ...restButtonProps } = buttonProps || {};

  const mergedButtonProps = {
    ...getReferenceProps(),
    ...restButtonProps,
    onClick: (ev: React.MouseEvent<HTMLElement>) => {
      // Call floating-ui's onClick first
      const referenceProps = getReferenceProps();
      'onClick' in referenceProps && typeof referenceProps.onClick === 'function' && referenceProps.onClick?.(ev);
      // Then call any custom onClick from buttonProps
      'onClick' in restButtonProps && typeof restButtonProps.onClick === 'function' && restButtonProps.onClick?.(ev as any);
    },
    style: buttonStyle,
  };

  const triggerProps = TriggerElement === 'button' ? { ...mergedButtonProps, type: 'button' as const } : mergedButtonProps;

  const triggerElement = createElement(TriggerElement, { ref: refs.setReference, ...triggerProps }, children);

  return (
    <span className={classNames('slds-is-relative', classname)}>
      {tooltipProps ? <Tooltip {...tooltipProps}>{triggerElement}</Tooltip> : triggerElement}
      {triggerAfterContent}
      {isOpen && (
        <FloatingPortal root={portalRoot}>
          <section
            ref={refs.setFloating}
            data-testid={testId}
            style={{ ...floatingStyles, ...panelStyle }}
            {...getFloatingProps()}
            className={classNames('slds-popover', size ? `slds-popover_${size}` : undefined, containerClassName)}
            css={css`
              &[data-placement^='right'] {
                .popover-arrow {
                  left: -0.5rem;
                  &::after {
                    box-shadow: -1px 1px 2px 0 rgb(0 0 0 / 16%);
                  }
                }
              }

              &[data-placement^='left'] {
                .popover-arrow {
                  right: -0.5rem;
                  &::after {
                    box-shadow: 1px -1px 2px 0 rgb(0 0 0 / 16%);
                  }
                }
              }

              &[data-placement^='top'] {
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

              &[data-placement^='bottom'] {
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
            data-placement={currentPlacement}
            {...panelProps}
          >
            {/* CLOSE BUTTON */}
            <button
              className={classNames(
                'slds-button slds-button_icon slds-button_icon-small slds-float_right slds-popover__close',
                {
                  'slds-button_icon-inverse': inverseIcons,
                },
                closeBtnClassName,
              )}
              title="Close dialog"
              onClick={handleClose}
              type="button"
            >
              <Icon type="utility" icon="close" className="slds-button__icon" omitContainer />
              <span className="slds-assistive-text">Close dialog</span>
            </button>
            {/* CONTENT */}
            {header}
            <div css={bodyStyle} className={bodyClassName}>
              {content}
            </div>
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
                }
              `}
              className="popover-arrow"
              ref={setArrowElement}
              style={{
                position: 'absolute',
                left: arrowX != null ? `${arrowX}px` : '',
                top: arrowY != null ? `${arrowY}px` : '',
              }}
            ></div>
          </section>
        </FloatingPortal>
      )}
    </span>
  );
};
