import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import uniqueId from 'lodash/uniqueId';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePopper } from 'react-popper';

// This is used to close menus when another is opened
export const ContextMenuContext = createContext<Map<string, (isOpen: boolean) => void>>(new Map());

export interface ContextMenuItem<T = string> {
  label: string;
  value: T;
  /** Show heading before item */
  heading?: string;
  /** Show divider after item */
  divider?: boolean;
  /** omit item from list */
  disabled?: boolean;
}

// Hook to manage state of context menu and close other unrelated context menus when opened
const useContextMenu = (id: string) => {
  const openMenus = useContext(ContextMenuContext);
  const [open, setOpen] = useState(false);

  // register outside click to close menu
  useEffect(() => {
    const handleClick = () => setOpen(false);
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
      setOpen(false);
      openMenus.delete(id);
    };
  }, [id, openMenus]);

  function setOpenState(state: boolean) {
    // close any other open menus
    for (const [key, setOpenFn] of openMenus) {
      setOpenFn(false);
    }
    openMenus.clear();
    openMenus.set(id, setOpen);
    setOpen(state);
  }

  return {
    open,
    setOpen: setOpenState,
  };
};

function Item({ item, onItemSelected }: { item: ContextMenuItem; onItemSelected: (item: ContextMenuItem) => void }) {
  return (
    <>
      {item.heading && (
        <li
          className="slds-dropdown__header"
          role="separator"
          css={css`
            font-size: 0.875rem;
            font-weight: 700;
            padding: 0.5rem 0.75rem;
          `}
        >
          {item.heading}
        </li>
      )}
      <li className="slds-dropdown__item" role="presentation" onClick={() => onItemSelected(item)}>
        <span
          css={css`
            position: relative;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0.75rem;
            color: #181818;
            white-space: nowrap;
            cursor: pointer;
            &:hover {
              outline: 0;
              text-decoration: none;
              background-color: #f3f3f3;
            }
          `}
          role="menuitem"
        >
          {item.label}
        </span>
      </li>
      {item.divider && <li className="slds-has-divider_top-space" role="separator"></li>}
    </>
  );
}

interface ContextMenuProps {
  containerId?: string;
  menu: ContextMenuItem[];
  onItemSelected: (item: ContextMenuItem) => void;
  children: ReactNode;
}

/**
 * This is required to be wrapped in ContextMenuContext.Provider
 *
 * Shows a menu on right click
 */
export function ContextMenu({ containerId, menu, onItemSelected, children }: ContextMenuProps) {
  const idRef = useRef(uniqueId());
  const { open, setOpen } = useContextMenu(idRef.current);

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
    modifiers: [{ name: 'offset', options: { offset: [0, 0] } }],
  });

  return (
    <>
      <div
        css={css`
          display: contents;
        `}
        onContextMenu={(event) => {
          if (containerId) {
            try {
              const itemId =
                event.currentTarget.getAttribute('data-id') ||
                event.currentTarget?.parentElement?.getAttribute('data-id') ||
                event.currentTarget?.firstElementChild?.getAttribute('data-id') ||
                null;
              if (itemId !== containerId) {
                return;
              }
            } catch (ex) {
              logger.warn('Error determining click target for context menu', ex);
            }
          }
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
          setReferenceElement(document.elementFromPoint(event.pageX, event.pageY) as HTMLElement);
        }}
      >
        {children}
      </div>
      {open &&
        createPortal(
          <div
            ref={setPopperElement}
            // Selectively picked from `slds-dropdown slds-dropdown_small`
            css={css`
              z-index: 7000;
              min-width: 15rem;
              max-width: 20rem;
              border: 1px solid #e5e5e5;
              border-radius: 0.25rem;
              padding: 0.25rem 0;
              font-size: 0.75rem;
              background: #fff;
              box-shadow: 0 2px 3px 0 rgb(0 0 0 / 16%);
              color: #181818;
            `}
            style={{ ...styles.popper }}
            {...attributes.popper}
          >
            <ul className="slds-dropdown__list" role="menu">
              {menu
                .filter((item) => !item.disabled)
                .map((item) => (
                  <Item key={item.value} item={item} onItemSelected={onItemSelected} />
                ))}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}

export default ContextMenu;
