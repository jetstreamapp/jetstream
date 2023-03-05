import { css } from '@emotion/react';
import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePopper } from 'react-popper';

interface PopoverContainerBaseProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  className?: string;
  isOpen: boolean;
  referenceElement: HTMLElement | null;
  usePortal?: boolean;
}

interface PopoverContainerFnAsChildrenProps extends PopoverContainerBaseProps {
  fnAsChildren: true;
  children: (props: { containerRef: HTMLDivElement | null }) => ReactNode;
}

interface PopoverContainerProps extends PopoverContainerBaseProps {
  fnAsChildren?: never;
  children: ReactNode;
}

/**
 * Generic popover container used for dropdown menus, date pickers, etc.
 */
export const PopoverContainer = forwardRef<HTMLDivElement, PopoverContainerFnAsChildrenProps | PopoverContainerProps>(
  ({ className, isOpen, referenceElement, usePortal = false, fnAsChildren, children, ...rest }, ref) => {
    const { styles, attributes } = usePopper(referenceElement, (ref as any)?.current, {
      placement: 'bottom-start',
      modifiers: [{ name: 'offset', options: { offset: [0, 1.75] } }],
    });

    // The popover is always rendered to ensure that the ref is set for other dependent components (e.x. virtualized list)
    let childrenToRender = fnAsChildren ? children({ containerRef: (ref as any)?.current }) : children;
    if (!isOpen) {
      childrenToRender = null;
    }

    const content = (
      <div
        {...rest}
        ref={ref}
        className={className}
        // Selectively picked from `slds-dropdown` - removed margin as that must be set via popper offset
        css={css`
          z-index: 7000;
          ${className?.includes('_fluid') ? 'min-width: 15rem;' : 'min-width: 15rem; max-width: 20rem;'}
          border: 1px solid #e5e5e5;
          border-radius: 0.25rem;
          padding: 0.25rem 0;
          background: #fff;
          box-shadow: 0 2px 3px 0 rgb(0 0 0 / 16%);
          color: #181818;
          visibility: ${isOpen ? 'visible' : 'hidden'};
        `}
        style={{ ...styles.popper }}
        {...attributes.popper}
      >
        {childrenToRender}
      </div>
    );

    return usePortal ? createPortal(content, document.body) : content;
  }
);

export default PopoverContainer;
