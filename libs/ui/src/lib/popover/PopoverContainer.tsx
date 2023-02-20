import { css } from '@emotion/react';
import { HTMLAttributes, ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePopper } from 'react-popper';

interface PopoverContainerProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  isOpen: boolean;
  referenceElement: HTMLElement;
  usePortal?: boolean;
  children: ReactNode;
}

/**
 * Generic popover container used for dropdown menus, date pickers, etc.
 */
export function PopoverContainer({ className, isOpen, referenceElement, usePortal = false, children, ...rest }: PopoverContainerProps) {
  const [popperElement, setPopperElement] = useState<HTMLElement>(null);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
    modifiers: [{ name: 'offset', options: { offset: [0, 1.75] } }],
  });

  if (!isOpen) {
    return null;
  }

  const content = (
    <div
      {...rest}
      ref={setPopperElement}
      className={className}
      // Selectively picked from `slds-dropdown` - removed margin as that must be set via popper offset
      css={css`
        z-index: 7000;
        ${className?.includes('_fluid') ? '' : 'min-width: 15rem; max-width: 20rem;'}
        border: 1px solid #e5e5e5;
        border-radius: 0.25rem;
        padding: 0.25rem 0;
        background: #fff;
        box-shadow: 0 2px 3px 0 rgb(0 0 0 / 16%);
        color: #181818;
      `}
      style={{ ...styles.popper }}
      {...attributes.popper}
    >
      {children}
    </div>
  );

  return usePortal ? createPortal(content, document.body) : content;
}

export default PopoverContainer;
