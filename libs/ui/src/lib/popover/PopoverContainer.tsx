import { css } from '@emotion/react';
import type { Placement } from '@popperjs/core';
import { HTMLAttributes, ReactNode, forwardRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePopper } from 'react-popper';

interface PopoverContainerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  className?: string;
  isOpen: boolean;
  /** Used to know where to place popover */
  referenceElement: HTMLElement | null;
  usePortal?: boolean;
  /** Load content into dom even if not open */
  isEager?: boolean;
  /** Popper.js offset {@link https://popper.js.org/docs/v2/tutorial/#offset} */
  offset?: number[];
  /** Popper.js offset {@link https://popper.js.org/docs/v2/utils/detect-overflow/#placement} */
  placement?: Placement;
  /** Min width in CSS unit */
  minWidth?: string;
  /** Max width in CSS unit. If provided classname includes "_fluid", no max width wil be set */
  maxWidth?: string;
  children: ReactNode;
}

/**
 * Generic popover container used for dropdown menus, date pickers, etc.
 */
export const PopoverContainer = forwardRef<HTMLDivElement, PopoverContainerProps>(
  (
    {
      className,
      isOpen,
      referenceElement,
      usePortal = false,
      isEager = false,
      placement = 'bottom-start',
      offset = [0, 1.75],
      minWidth = '15rem',
      maxWidth = '20rem',
      children,
      ...rest
    },
    ref
  ) => {
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
    const { styles, attributes, update } = usePopper(referenceElement, popperElement, {
      placement,
      modifiers: [{ name: 'offset', options: { offset: offset as any } }],
    });

    useEffect(() => {
      if (!ref) {
        return;
      }
      if (popperElement && typeof ref === 'function') {
        ref(popperElement);
      } else if (popperElement && typeof ref !== 'function') {
        ref.current = popperElement;
      }
    }, [popperElement, ref]);

    // Ensure positioning is updated when the popover is opened - mostly impacts isEager popovers
    useEffect(() => {
      isOpen && update && update();
    }, [update, isOpen]);

    if (!isEager && !isOpen) {
      return null;
    }

    // if isEager and not open, render the container and not any children (so ref exists)
    const childrenToRender = isOpen ? children : null;

    const content = (
      <div
        {...rest}
        ref={setPopperElement}
        className={className}
        // Selectively picked from `slds-dropdown` - removed margin as that must be set via popper offset
        css={css`
          z-index: 7000;
          ${className?.includes('_fluid') ? `min-width: ${minWidth};` : `min-width: ${minWidth}; max-width: ${maxWidth};`}
          border: 1px solid #e5e5e5;
          border-radius: 0.25rem;
          padding: 0.25rem 0;
          background: #fff;
          box-shadow: 0 2px 3px 0 rgb(0 0 0 / 16%);
          color: #181818;
          display: ${isOpen ? 'block' : 'none'};
        `}
        style={{ ...styles.popper }}
        {...attributes.popper}
      >
        {childrenToRender}
      </div>
    );

    return usePortal ? (createPortal(content, document.body) as ReactNode) : content;
  }
);

export default PopoverContainer;
