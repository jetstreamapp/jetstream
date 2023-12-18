/* eslint-disable jsx-a11y/anchor-is-valid */
import { IconName, IconObj, IconType } from '@jetstream/icon-factory';
import {
  KeyBuffer,
  isArrowDownKey,
  isArrowUpKey,
  isEnterKey,
  isEscapeKey,
  menuItemSelectScroll,
  selectMenuItemFromKeyboard,
} from '@jetstream/shared/ui-utils';
import { DropDownItem, DropDownItemLength } from '@jetstream/types';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import React, {
  Fragment,
  FunctionComponent,
  KeyboardEvent,
  ReactNode,
  RefObject,
  createRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import OutsideClickHandler from '../../utils/OutsideClickHandler';
import Icon from '../../widgets/Icon';

export interface DropDownProps {
  className?: string;
  disabled?: boolean;
  position?: 'left' | 'right';
  leadingIcon?: IconObj; // ignored if buttonContent is provided
  buttonClassName?: string;
  buttonContent?: ReactNode; // if omitted, then a regular dropdown icon will be shown
  dropDownClassName?: string;
  actionText?: string;
  scrollLength?: DropDownItemLength;
  description?: string; // assistive text, ignored if buttonContent is provided
  initialSelectedId?: string;
  items: DropDownItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelected: (id: string, metadata?: any) => void;
}

export const DropDown: FunctionComponent<DropDownProps> = ({
  className,
  disabled,
  position = 'left',
  leadingIcon,
  buttonClassName,
  buttonContent,
  dropDownClassName,
  actionText = 'action',
  scrollLength,
  initialSelectedId,
  items,
  description,
  onSelected,
}) => {
  const keyBuffer = useRef(new KeyBuffer());
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const scrollLengthClass = useMemo<string | undefined>(
    () => (scrollLength ? `slds-dropdown_length-${scrollLength}` : undefined),
    [scrollLength]
  );
  const [focusedItem, setFocusedItem] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | undefined>(initialSelectedId);
  const ulContainerEl = useRef<HTMLUListElement>(null);
  const elRefs = useRef<RefObject<HTMLAnchorElement>[]>([]);

  // init array to hold element refs for each item in list
  if (elRefs.current.length !== items.length) {
    const refs: RefObject<HTMLAnchorElement>[] = [];
    items.forEach((item, i) => {
      refs[i] = elRefs[i] || createRef();
    });
    // add or remove refs
    elRefs.current = refs;
  }

  useEffect(() => {
    if (elRefs.current && isNumber(focusedItem) && elRefs.current[focusedItem] && elRefs.current[focusedItem]) {
      try {
        elRefs.current?.[focusedItem]?.current?.focus();

        if (ulContainerEl.current) {
          menuItemSelectScroll({
            container: ulContainerEl.current,
            focusedIndex: focusedItem,
          });
        }
      } catch (ex) {
        // silent error on keyboard navigation
      }
    }
  }, [focusedItem]);

  useEffect(() => {
    if (isOpen && !isNumber(focusedItem)) {
      if (selectedItem) {
        let idx = items.findIndex((item) => item.id === selectedItem);
        idx = idx >= 0 ? idx : 0;
        setFocusedItem(idx);
      } else {
        setFocusedItem(0);
      }
    } else if (!isOpen) {
      setFocusedItem(null);
    }
  }, [isOpen]);

  function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();
    let newFocusedItem;

    if (isEscapeKey(event)) {
      setIsOpen(false);
      return;
    }

    if (isArrowUpKey(event)) {
      if (!isNumber(focusedItem) || focusedItem === 0) {
        newFocusedItem = items.length - 1;
      } else {
        newFocusedItem = focusedItem - 1;
      }
    } else if (isArrowDownKey(event)) {
      if (!isNumber(focusedItem) || focusedItem === items.length - 1) {
        newFocusedItem = 0;
      } else {
        newFocusedItem = focusedItem + 1;
      }
    } else if (isEnterKey(event) && isNumber(focusedItem)) {
      const item = items[focusedItem];
      if (!item.disabled) {
        setSelectedItem(item.id);
        onSelected(item.id, item.metadata);
        setIsOpen(false);
      }
    } else {
      // allow user to use keyboard to navigate to a specific item in the list by typing words
      newFocusedItem = selectMenuItemFromKeyboard<DropDownItem>({
        key: event.key,
        keyCode: event.keyCode,
        keyBuffer: keyBuffer.current,
        items: items,
        labelProp: 'value',
      });
    }

    if (isNumber(newFocusedItem)) {
      setFocusedItem(newFocusedItem);
    }
  }

  function handleSelection(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>, id: string, metadata?: any) {
    event.preventDefault();
    setIsOpen(false);
    onSelected(id, metadata);
    setSelectedItem(id);
  }

  return (
    <OutsideClickHandler onOutsideClick={() => setIsOpen(false)}>
      <div className={classNames('slds-dropdown-trigger slds-dropdown-trigger_click', className, { 'slds-is-open': isOpen })}>
        <button
          className={buttonClassName || 'slds-button slds-button_icon slds-button_icon-border-filled'}
          aria-haspopup="true"
          aria-expanded={isOpen}
          title={actionText}
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
        >
          {buttonContent ? (
            buttonContent
          ) : (
            <Fragment>
              {leadingIcon && <Icon type={leadingIcon.type} icon={leadingIcon.icon} className="slds-button__icon" omitContainer />}
              <Icon
                type="utility"
                icon="down"
                className={classNames('slds-button__icon', {
                  'slds-button__icon_hint slds-button__icon_small': !leadingIcon,
                  'slds-button__icon_x-small': !!leadingIcon,
                })}
                omitContainer={!!leadingIcon}
                description={actionText}
              />
              {description && <span className="slds-assistive-text">{description}</span>}
            </Fragment>
          )}
        </button>
        {isOpen && (
          <div
            className={classNames(
              'slds-dropdown',
              {
                'slds-dropdown_left': position === 'left',
                'slds-dropdown_right': position === 'right',
              },
              scrollLengthClass,
              dropDownClassName
            )}
          >
            <ul className="slds-dropdown__list" role="menu" aria-label={actionText} ref={ulContainerEl}>
              {items.map(({ id, subheader, value, icon, disabled, title, trailingDivider, metadata }, i) => (
                <Fragment key={id}>
                  {subheader && (
                    <li className="slds-dropdown__header slds-truncate" title={subheader} role="separator">
                      <span>{subheader}</span>
                    </li>
                  )}
                  <li className="slds-dropdown__item" role="presentation">
                    <a
                      ref={elRefs.current[i]}
                      role="menuitem"
                      tabIndex={0}
                      onKeyDown={handleKeyDown}
                      onClick={(event) => !disabled && handleSelection(event, id, metadata)}
                      aria-disabled={disabled}
                    >
                      {isString(value) ? (
                        <span className="slds-truncate" title={title || value}>
                          {icon && (
                            <Icon
                              type={icon.type as IconType}
                              icon={icon.icon as IconName}
                              description={icon.description}
                              omitContainer
                              className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_x-small"
                            />
                          )}
                          {value}
                        </span>
                      ) : (
                        value
                      )}
                    </a>
                  </li>
                  {trailingDivider && <li className="slds-has-divider_top-space" role="separator"></li>}
                </Fragment>
              ))}
            </ul>
          </div>
        )}
      </div>
    </OutsideClickHandler>
  );
};

export default DropDown;
