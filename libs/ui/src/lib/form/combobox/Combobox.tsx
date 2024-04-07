/* eslint-disable no-prototype-builtins */
import { SerializedStyles } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import {
  focusElementFromRefWhenAvailable,
  isAlphaNumericKey,
  isArrowDownKey,
  isArrowRightKey,
  isArrowUpKey,
  isEnterKey,
  isEnterOrSpace,
  isEscapeKey,
} from '@jetstream/shared/ui-utils';
import { NOOP } from '@jetstream/shared/utils';
import { DropDownItemLength, FormGroupDropdownItem } from '@jetstream/types';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import React, {
  Children,
  FocusEvent,
  Fragment,
  KeyboardEvent,
  MouseEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import PopoverContainer from '../../popover/PopoverContainer';
import OutsideClickHandler from '../../utils/OutsideClickHandler';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import Spinner from '../../widgets/Spinner';
import { FormGroupDropdown } from '../formGroupDropDown/FormGroupDropdown';
import { ComboboxListItem } from './ComboboxListItem';

export interface ComboboxPropsRef {
  clearInputText(): void;
  getRefs(): {
    inputEl: React.RefObject<HTMLInputElement>;
    divContainerEl: React.RefObject<HTMLDivElement>;
    entireContainerEl: React.RefObject<HTMLDivElement>;
    popoverRef: React.RefObject<HTMLDivElement>;
  };
  close(): void;
}

export type ComboboxSharedProps = Omit<
  ComboboxProps,
  'hasGroups' | 'selectedItemLabel' | 'selectedItemTitle' | 'isEmpty' | 'isVirtual' | 'onKeyboardNavigation' | 'children'
>;

export interface ComboboxProps {
  className?: string;
  inputCss?: SerializedStyles;
  hasGroups?: boolean;
  label: string;
  labelHelp?: string | null;
  helpText?: React.ReactNode | string;
  isRequired?: boolean;
  hideLabel?: boolean;
  placeholder?: string;
  noItemsPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  /** Set to true if there are groups */
  /**
   * Text shown for the selected item when the menu is closed.
   */
  selectedItemLabel?: string | null;
  /**
   * Text shown for the selected item title when the menu is closed.
   */
  selectedItemTitle?: string | null;
  /**
   * Shows a dropdown at beginning to choose between different types of items.
   * {@link https://www.lightningdesignsystem.com/components/combobox/?variant=deprecated-multi-entity#Grouped-Comboboxes-(Cross-entity-Polymorphic)}
   */
  leadingDropdown?: {
    label: string;
    items: FormGroupDropdownItem[];
    initialSelectedItem?: FormGroupDropdownItem;
  };
  /**
   * Depending on how Combobox is used, isEmpty may not be able to be automatically calculated.
   * if so, Set this field to true if you know there are no items in the list.
   */
  isEmpty?: boolean;
  /**
   * How many items should be visible before scrolling
   */
  itemLength?: DropDownItemLength;
  hasError?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  /**
   * If true, the selected item will be shown with a border and a close X button.
   * User must clear the input before changing selection.
   * This requires `onClear()` to be set, otherwise value cannot be cleared.
   */
  showSelectionAsButton?: boolean;
  /**
   * If using virtual list, this ensures child detection for keyboard navigation is correct.
   */
  isVirtual?: boolean;
  onInputChange?: (value: string) => void;
  /** Same as onInputChange, but does not get called when closed */
  onFilterInputChange?: (value: string) => void;
  onInputEnter?: () => void;
  onClear?: () => void;
  onClose?: () => void;
  /**
   * If there is a leading grouped dropdown, indicates if item in that list changed
   */
  onLeadingDropdownChange?: (item: FormGroupDropdownItem) => void;
  /**
   * Notify parent of keyboard navigation event
   */
  onKeyboardNavigation: (action: 'up' | 'down' | 'right' | 'enter') => void;
  children?: React.ReactNode;
}

function getContainer(hasGroup: boolean, children: React.ReactNode) {
  if (hasGroup) {
    return <div className="slds-combobox-group">{children}</div>;
  }
  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <Fragment>{children}</Fragment>;
}

const iconLoading = (
  <div className="slds-input__icon-group slds-input__icon-group_right">
    <Spinner className="slds-spinner slds-spinner_brand slds-spinner_x-small slds-input__spinner" size="x-small" />
    <Icon
      type="utility"
      icon="down"
      className="slds-icon slds-icon slds-icon_x-small slds-icon-text-default"
      containerClassname="slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right"
    />
  </div>
);

export const Combobox = forwardRef<ComboboxPropsRef, ComboboxProps>(
  (
    {
      className,
      inputCss,
      hasGroups,
      label,
      labelHelp,
      helpText,
      isRequired,
      hideLabel = false,
      placeholder = 'Select an Option',
      noItemsPlaceholder = 'There are no items for selection',
      disabled,
      loading,
      inputProps,
      selectedItemLabel,
      selectedItemTitle,
      leadingDropdown,
      isEmpty = false,
      itemLength = 7,
      hasError,
      errorMessageId,
      errorMessage,
      showSelectionAsButton,
      isVirtual,
      children,
      onInputChange,
      onFilterInputChange,
      onInputEnter,
      onLeadingDropdownChange,
      onClear,
      onClose,
      onKeyboardNavigation,
    }: ComboboxProps,
    ref
  ) => {
    // store keys user typed in so that if typing triggered open, we can ensure input is set to this value
    const inputBuffer = useRef('');
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [id] = useState<string>(uniqueId('Combobox'));
    const [listId] = useState<string>(uniqueId('Combobox-list'));
    const [value, setValue] = useState<string>(selectedItemLabel || '');
    const hasDropdownGroup = !!leadingDropdown && !!leadingDropdown.items?.length;

    const inputEl = useRef<HTMLInputElement>(null);
    const divContainerEl = useRef<HTMLDivElement>(null);
    const entireContainerEl = useRef<HTMLDivElement>(null);

    const preventOpen = !!showSelectionAsButton && !!onClear && !!selectedItemLabel;

    useImperativeHandle<unknown, ComboboxPropsRef>(
      ref,
      () => ({
        clearInputText: () => {
          isOpen && setValue('');
        },
        focusInput: () => {
          return inputEl.current?.focus();
        },
        getRefs: () => {
          return {
            inputEl,
            divContainerEl,
            entireContainerEl,
            popoverRef,
          };
        },
        close: () => {
          setTimeout(() => {
            isOpen && setIsOpen(false);
            onClose && onClose();
            focusElementFromRefWhenAvailable(inputEl);
          });
        },
      }),
      [isOpen, onClose]
    );

    // when closed, set input value in case user modified
    useEffect(() => {
      if (isOpen) {
        setValue(inputBuffer.current || '');
      } else {
        inputBuffer.current = '';
        // setFocusedItem(null);
        if (value !== (selectedItemLabel || '')) {
          setValue(selectedItemLabel || '');
        }
      }
      if (onInputChange) {
        onInputChange('');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // close on selection
    useEffect(() => {
      if (isOpen && selectedItemLabel) {
        setIsOpen(false);
        onClose && onClose();
        inputEl.current?.focus();
      }
      if (value !== (selectedItemLabel || '')) {
        setValue(selectedItemLabel || '');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedItemLabel]);

    /**
     * When on input, move focus down the first list item
     */
    function handleInputKeyUp(event: KeyboardEvent<HTMLInputElement>) {
      if (disabled || preventOpen) {
        return;
      }
      if (isArrowUpKey(event)) {
        !isOpen && setIsOpen(true);
        onKeyboardNavigation('up');
      } else if (isArrowDownKey(event)) {
        !isOpen && setIsOpen(true);
        onKeyboardNavigation('down');
      } else if (isEscapeKey(event)) {
        event.stopPropagation();
        event.preventDefault();
        setIsOpen(false);
        onClose && onClose();
      } else if (isEnterKey(event) && isOpen && onInputEnter) {
        onInputEnter();
      } else {
        if (isAlphaNumericKey(event) && !isOpen) {
          // save input so that when we open, we can set the value instead of clearing it
          inputBuffer.current = `${inputBuffer.current}${event.currentTarget.value}`;
          setIsOpen(true);
        }
        onInputChange && onInputChange(event.currentTarget.value);
        onFilterInputChange && onFilterInputChange(event.currentTarget.value);
      }
    }

    /**
     * Handle keyboard interaction when list items have focus
     * The outer div listens for the keyboard events and handles actions
     */
    function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      try {
        if (isOpen && isEscapeKey(event)) {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          onClose && onClose();
          inputEl.current?.focus();
          return;
        }
        if (isEnterOrSpace(event)) {
          event.preventDefault();
          event.stopPropagation();
          onKeyboardNavigation('enter');
          return;
        }
        if (isArrowUpKey(event)) {
          event.preventDefault();
          event.stopPropagation();
          onKeyboardNavigation('up');
        } else if (isArrowDownKey(event)) {
          event.preventDefault();
          event.stopPropagation();
          onKeyboardNavigation('down');
        } else if (isArrowRightKey(event)) {
          event.preventDefault();
          event.stopPropagation();
          onKeyboardNavigation?.('right');
        }
      } catch (ex) {
        logger.warn('Error in ComboboxList onKeyDown', ex);
      }
    }

    const handleBlur = (event: FocusEvent) => {
      if (entireContainerEl.current?.contains(event.relatedTarget as Node)) {
        return;
      }
      setIsOpen(false);
      onClose && onClose();
    };

    const handleInputClick = () => {
      if (!disabled && !preventOpen) {
        if (!isOpen && selectedItemLabel) {
          setIsOpen(!isOpen);
        } else {
          setIsOpen(true);
        }
      }
    };

    const handleRemoveItem = (event: MouseEvent | KeyboardEvent) => {
      event.stopPropagation();
      onClear && onClear();
      setIsOpen(true);
      focusElementFromRefWhenAvailable(inputEl);
    };

    const iconNotLoading =
      showSelectionAsButton && onClear && selectedItemLabel ? (
        <div className="slds-input__icon-group slds-input__icon-group_right">
          <button
            className="slds-button slds-button_icon slds-input__icon slds-input__icon_right"
            onClick={handleRemoveItem}
            title="Clear value"
          >
            <Icon type="utility" icon="clear" className="slds-button__icon" omitContainer description="Clear Selection" />
          </button>
        </div>
      ) : (
        <Icon
          type="utility"
          icon="down"
          className="slds-icon slds-icon slds-icon_x-small slds-icon-text-default"
          containerClassname="slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right"
        />
      );

    return (
      <div data-testid={`dropdown-${label || id}`} className={classNames('slds-form-element', { 'slds-has-error': hasError }, className)}>
        <label className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })} htmlFor={id}>
          {isRequired && (
            <abbr className="slds-required" title="required">
              *{' '}
            </abbr>
          )}
          {label}
        </label>
        {labelHelp && !hideLabel && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
        <div className="slds-form-element__control">
          {getContainer(
            hasDropdownGroup,
            <Fragment>
              {hasDropdownGroup && (
                <FormGroupDropdown
                  comboboxId={id}
                  label={leadingDropdown.label}
                  initialSelectedItemId={leadingDropdown.initialSelectedItem?.id}
                  items={leadingDropdown.items}
                  onSelected={onLeadingDropdownChange}
                />
              )}
              <OutsideClickHandler
                className={classNames('slds-combobox_container', { 'slds-has-selection': showSelectionAsButton && selectedItemLabel })}
                onOutsideClick={() => {
                  if (isOpen) {
                    setIsOpen(false);
                    onClose && onClose();
                  }
                }}
              >
                <div
                  ref={entireContainerEl}
                  className={classNames('slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click', { 'slds-is-open': isOpen })}
                  aria-expanded={isOpen}
                  aria-haspopup="listbox"
                  aria-controls={listId}
                  role="combobox"
                  onClick={handleInputClick}
                >
                  <div
                    className={classNames('slds-combobox__form-element', ' slds-input-has-icon', {
                      'slds-input-has-icon_right': !loading,
                      'slds-input-has-icon_group-right': loading,
                    })}
                    role="none"
                  >
                    <input
                      ref={inputEl}
                      aria-autocomplete="list"
                      type="text"
                      className={classNames('slds-input slds-combobox__input', { 'slds-text-color_error': hasError })}
                      id={id}
                      css={inputCss}
                      aria-controls={listId}
                      aria-describedby={errorMessageId}
                      autoComplete="off"
                      placeholder={placeholder}
                      disabled={disabled}
                      readOnly={preventOpen}
                      onKeyUp={handleInputKeyUp}
                      onChange={(event) => setValue(event.target.value)}
                      value={value}
                      title={selectedItemTitle || value}
                      onBlur={handleBlur}
                      {...inputProps}
                    />
                    {loading ? iconLoading : iconNotLoading}
                  </div>
                  <PopoverContainer
                    ref={popoverRef}
                    isOpen={isOpen}
                    referenceElement={inputEl.current}
                    className={`slds-dropdown_length-${itemLength} slds-dropdown_fluid`}
                    id={listId}
                    role="listbox"
                    isEager={isVirtual}
                    onKeyDown={handleListKeyDown}
                    /**
                     * This ensures that combobox does not close when scrollbar is clicked
                     * https://github.com/salesforce/design-system-react/pull/1911
                     */
                    onMouseDown={(event) => event.preventDefault()}
                    onBlur={handleBlur}
                  >
                    <div ref={divContainerEl}>
                      {hasGroups && children}
                      {!hasGroups && (
                        <ul className="slds-listbox slds-listbox_vertical" role="presentation">
                          {children}
                        </ul>
                      )}
                      {/* Show placeholder if there are no items to show - in case there are other children (e.x. a header), parent can use isEmpty */}
                      {(isEmpty || Children.count(children) === 0) && (
                        <ul className="slds-listbox slds-listbox_vertical" role="presentation">
                          <ComboboxListItem id="placeholder" placeholder label={noItemsPlaceholder} selected={false} onSelection={NOOP} />
                        </ul>
                      )}
                    </div>
                  </PopoverContainer>
                </div>
              </OutsideClickHandler>
            </Fragment>
          )}
        </div>
        {helpText && <div className="slds-form-element__help">{helpText}</div>}
        {hasError && errorMessage && (
          <div className="slds-form-element__help" id={errorMessageId}>
            {errorMessage}
          </div>
        )}
      </div>
    );
  }
);

export default Combobox;
