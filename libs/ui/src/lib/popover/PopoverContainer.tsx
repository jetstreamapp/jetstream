import { css } from '@emotion/react';
import { FloatingPortal, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { HTMLAttributes, ReactNode, forwardRef, useEffect } from 'react';
import { usePortalContext } from '../modal/PortalContext';

export interface PopoverContainerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  className?: string;
  isOpen: boolean;
  /** Used to know where to place popover */
  referenceElement: HTMLElement | null;
  usePortal?: boolean;
  /** Load content into dom even if not open */
  isEager?: boolean;
  /** Min width in CSS unit */
  minWidth?: string;
  /** Max width in CSS unit. If provided classname includes "_fluid", no max width wil be set */
  maxWidth?: string;
  children: ReactNode;
}

/**
 * Generic popover container used for dropdown menus, date pickers, etc.
 */
export const PopoverContainer = forwardRef<HTMLElement, PopoverContainerProps>(
  (
    { className, isOpen, referenceElement, usePortal = false, isEager = false, minWidth = '15rem', maxWidth = '20rem', children, ...rest },
    ref,
  ) => {
    const { portalRoot } = usePortalContext();
    const { refs, floatingStyles, update } = useFloating({
      open: isOpen,
      placement: 'bottom-start',
      middleware: [offset(1.75), flip(), shift({ padding: 8 })],
      whileElementsMounted: autoUpdate,
      elements: {
        reference: referenceElement,
      },
    });

    useEffect(() => {
      if (!ref) {
        return;
      }
      const floatingElement = refs.floating.current;
      if (floatingElement && typeof ref === 'function') {
        ref(floatingElement);
      } else if (floatingElement && typeof ref !== 'function') {
        ref.current = floatingElement;
      }
    }, [refs.floating, ref]);

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
        ref={refs.setFloating}
        className={className}
        // Selectively picked from `slds-dropdown` - removed margin as that must be set via popover offset
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
        style={floatingStyles}
      >
        {childrenToRender}
      </div>
    );

    return usePortal ? <FloatingPortal root={portalRoot}>{content}</FloatingPortal> : content;
  },
);

export default PopoverContainer;
