import { SerializedStyles } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import {
  isArrowDownKey,
  isArrowUpKey,
  isEnterKey,
  isEnterOrSpace,
  isEscapeKey,
  menuItemSelectScroll,
  useNonInitialEffect,
} from '@jetstream/shared/ui-utils';
import { NOOP } from '@jetstream/shared/utils';
import { DropDownItemLength, FormGroupDropdownItem } from '@jetstream/types';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import uniqueId from 'lodash/uniqueId';
import React, {
  Children,
  cloneElement,
  createRef,
  FocusEvent,
  forwardRef,
  Fragment,
  isValidElement,
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import OutsideClickHandler from '../../utils/OutsideClickHandler';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import Spinner from '../../widgets/Spinner';
import { FormGroupDropdown } from '../formGroupDropDown/FormGroupDropdown';
import { ComboboxListItem, ComboboxListItemProps } from './ComboboxListItem';
import { ComboboxListItemGroup, ComboboxListItemGroupProps } from './ComboboxListItemGroup';

type ChildListItem = ComboboxListItemProps & React.RefAttributes<HTMLLIElement>;
type ChildListGroup = ComboboxListItemGroupProps & { children: React.ReactNode };

export interface ComboboxPropsRef {
  close(): void;
}

export interface ComboboxProps {
  className?: string;
  inputCss?: SerializedStyles;
  label: string;
  labelHelp?: string;
  helpText?: React.ReactNode | string;
  isRequired?: boolean;
  hideLabel?: boolean;
  placeholder?: string;
  noItemsPlaceholder?: string;
  disabled?: boolean;
  loading?: boolean;
  selectedItemLabel?: string; // used for text
  selectedItemTitle?: string; // used for text
  leadingDropdown?: {
    label: string;
    items: FormGroupDropdownItem[];
    initialSelectedItem?: FormGroupDropdownItem;
  };
  itemLength?: DropDownItemLength;
  hasError?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  showSelectionAsButton?: boolean;
  onInputChange?: (value: string) => void;
  /** Same as onInputChange, but does not get called when closed */
  onFilterInputChange?: (value: string) => void;
  onInputEnter?: () => void;
  onClear?: () => void;
  onLeadingDropdownChange?: (item: FormGroupDropdownItem) => void;
  children?: React.ReactNode;
}

function getContainer(hasGroup: boolean, children: React.ReactNode) {
  if (hasGroup) {
    return <div className="slds-combobox-group">{children}</div>;
  }
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

const iconNotLoading = (
  <Icon
    type="utility"
    icon="down"
    className="slds-icon slds-icon slds-icon_x-small slds-icon-text-default"
    containerClassname="slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right"
  />
);

/**
 * Optimization to skip re-renders of parts of component
 */
// export const Combobox = forwardRef((props: ComboboxProps, ref) => (
//   <ComboboxElement ref={ref} {...props} icon={props.loading ? iconLoading : iconNotLoading} />
// ));

export const Combobox = forwardRef(
  (
    {
      className,
      inputCss,
      label,
      labelHelp,
      helpText,
      isRequired,
      hideLabel = false,
      placeholder = 'Select an Option',
      noItemsPlaceholder = 'There are no items for selection',
      disabled,
      loading,
      selectedItemLabel,
      selectedItemTitle,
      leadingDropdown,
      itemLength = 7,
      hasError,
      errorMessageId,
      errorMessage,
      showSelectionAsButton,
      children,
      onInputChange,
      onFilterInputChange,
      onInputEnter,
      onLeadingDropdownChange,
      onClear,
    }: ComboboxProps,
    ref
  ) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [id] = useState<string>(uniqueId('Combobox'));
    const [listId] = useState<string>(uniqueId('Combobox-list'));
    const [value, setValue] = useState<string>(selectedItemLabel || '');
    const [hasGroups, setHasGroups] = useState(false);
    const hasDropdownGroup = !!leadingDropdown && !!leadingDropdown.items?.length;

    const [focusedItem, setFocusedItem] = useState<number>(null);
    const inputEl = useRef<HTMLInputElement>(null);
    const divContainerEl = useRef<HTMLDivElement>(null);
    const entireContainerEl = useRef<HTMLDivElement>(null);
    const elRefs = useRef<HTMLLIElement[]>([]);

    useImperativeHandle<unknown, ComboboxPropsRef>(
      ref,
      () => ({
        close: () => {
          setTimeout(() => {
            setIsOpen(false);
            inputEl.current?.focus();
          });
        },
      }),
      []
    );

    useNonInitialEffect(() => {
      try {
        if (elRefs.current && isNumber(focusedItem) && elRefs.current[focusedItem] && elRefs.current[focusedItem]) {
          elRefs.current[focusedItem].focus();
        }
        menuItemSelectScroll({
          container: divContainerEl.current,
          focusedIndex: focusedItem,
        });
      } catch (ex) {
        logger.log('Error with keyboard navigation', ex);
      }
    }, [focusedItem]);

    // when closed, set input value in case user modified
    useEffect(() => {
      if (isOpen) {
        setValue('');
      } else {
        setFocusedItem(null);
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
        inputEl.current?.focus();
      }
      if (value !== (selectedItemLabel || '')) {
        setValue(selectedItemLabel || '');
      }
    }, [selectedItemLabel]);

    // Determine if children are groups instead of items
    let childrenSize = Children.count(children);
    // if (!checkedForGroups) {
    // setCheckedForGroups(true);
    Children.forEach(children, (child) => {
      if (isValidElement(child)) {
        if (child.type === ComboboxListItemGroup) {
          childrenSize += Children.count(child.props.children);
          if (!hasGroups) {
            setHasGroups(true);
          }
        }
      }
    });
    // }

    // remove double counted children size - since we really just want to know grandchildren size
    if (hasGroups) {
      childrenSize -= Children.count(children);
    }

    // init refs for children for keyboard navigation
    if (elRefs.current.length !== childrenSize) {
      const refs: HTMLLIElement[] = [];
      let counter = 0;
      Children.forEach(children, (child, i) => {
        // if groups, use grandchildren
        if (hasGroups) {
          if (isValidElement(child)) {
            Children.forEach(child.props.children, (grandChild) => {
              refs[counter] = elRefs[counter] || createRef();
              counter++;
            });
          }
        } else {
          refs[counter] = elRefs[counter] || createRef();
          counter++;
        }
      });
      // add or remove refs
      elRefs.current = refs;
    }

    /**
     * Create a ref on all children or grandchildren (for groups)
     * This allows moving between elements with keyboard
     */
    let counter = 0;
    const childrenWithRef = Children.map(children, (child: ReactElement<ChildListItem | ChildListGroup>, i) => {
      if (!isValidElement<ChildListItem | ChildListGroup>(child)) {
        return child;
      }
      // set refs on all grandchildren list items
      if (hasGroups && isValidElement<ChildListGroup>(child)) {
        return cloneElement(child as ReactElement<ChildListGroup>, {
          children: Children.map(child.props.children, (grandChild: ReactElement<ChildListItem>) => {
            if (!isValidElement<ChildListItem>(grandChild)) {
              return grandChild;
            }
            const clonedEl = cloneElement(grandChild, {
              ref: ((currCounter: number) => (node) => {
                elRefs.current[currCounter] = node;
                // Call the original ref, if any
                const { ref } = child as any;
                if (typeof ref === 'function') {
                  ref(node);
                } else if (ref !== null) {
                  ref.current = node;
                }
              })(counter),
            });
            counter++;
            return clonedEl;
          }),
        });
      } else {
        return cloneElement(child, {
          ref: (node) => {
            elRefs.current[i] = node;
            // Call the original ref, if any
            const { ref } = child as any;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref !== null) {
              ref.current = node;
            }
          },
        });
      }
    });

    /**
     * When on input, move focus down the first list item
     */
    function handleInputKeyUp(event: KeyboardEvent<HTMLInputElement>) {
      if (disabled) {
        return;
      }
      if (isArrowUpKey(event)) {
        setFocusedItem(elRefs.current.length - 1);
        if (!isOpen) {
          setIsOpen(true);
        }
      } else if (isArrowDownKey(event)) {
        setFocusedItem(0);
        if (!isOpen) {
          setIsOpen(true);
        }
      } else if (isEnterKey(event) && isOpen && onInputEnter) {
        onInputEnter();
      } else {
        onInputChange && onInputChange(event.currentTarget.value);
        onFilterInputChange && onFilterInputChange(event.currentTarget.value);
      }
    }

    /**
     * Handle keyboard interaction when list items have focus
     * The outer div listens for the keyboard events and handles actions
     */
    function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      let newFocusedItem = focusedItem;
      if (isOpen && isEscapeKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        inputEl.current?.focus();
        return;
      }
      if (isNumber(focusedItem) && isEnterOrSpace(event)) {
        event.preventDefault();
        event.stopPropagation();
        try {
          elRefs.current[focusedItem].click();
          setIsOpen(false);
          inputEl.current?.focus();
        } catch (ex) {
          // error
        }
        return;
      }
      if (isArrowUpKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        if (!isNumber(focusedItem) || focusedItem === 0) {
          newFocusedItem = elRefs.current.length - 1;
        } else {
          newFocusedItem = newFocusedItem - 1;
        }
      } else if (isArrowDownKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        if (!isNumber(focusedItem) || focusedItem === elRefs.current.length - 1) {
          newFocusedItem = 0;
        } else {
          newFocusedItem = newFocusedItem + 1;
        }
      }

      if (isNumber(newFocusedItem) && newFocusedItem !== focusedItem) {
        setFocusedItem(newFocusedItem);
      }
    }

    const handleBlur = (event: FocusEvent) => {
      if (entireContainerEl.current?.contains(event.relatedTarget as Node)) {
        return;
      }
      setIsOpen(false);
    };

    const handleInputClick = () => {
      if (!disabled) {
        if (!isOpen && selectedItemLabel) {
          setIsOpen(!isOpen);
        } else {
          setIsOpen(true);
        }
      }
    };

    const handleRemoveItem = (event: MouseEvent) => {
      event.stopPropagation();
      onClear && onClear();
      setIsOpen(true);
      inputEl.current?.focus();
      // Hacky, but make sure that input exists so it can be focused
      setTimeout(() => {
        inputEl.current?.focus();
      }, 50);
    };

    return (
      <div className={classNames('slds-form-element', { 'slds-has-error': hasError }, className)}>
        <label className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })} htmlFor={id}>
          {isRequired && (
            <abbr className="slds-required" title="required">
              *{' '}
            </abbr>
          )}
          {label}
        </label>
        {labelHelp && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
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
                onOutsideClick={() => setIsOpen(false)}
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
                    {showSelectionAsButton && selectedItemLabel ? (
                      <>
                        <button
                          type="button"
                          className="slds-input_faux slds-combobox__input slds-combobox__input-value"
                          aria-controls="listbox-id-18"
                          aria-expanded="false"
                          aria-haspopup="listbox"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                          }}
                          title={selectedItemTitle || value}
                        >
                          <span className="slds-truncate" id={id}>
                            {value}
                          </span>
                        </button>

                        <button
                          className="slds-button slds-button_icon slds-input__icon slds-input__icon_right"
                          title="Remove selected option"
                          onClick={handleRemoveItem}
                        >
                          <Icon
                            type="utility"
                            icon="close"
                            description="Remove selected option"
                            className="slds-button__icon"
                            omitContainer
                          />
                        </button>
                      </>
                    ) : (
                      <>
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
                          onKeyUp={handleInputKeyUp}
                          onChange={(event) => setValue(event.target.value)}
                          value={value}
                          title={selectedItemTitle || value}
                          onBlur={handleBlur}
                        />
                        {loading ? iconLoading : iconNotLoading}
                      </>
                    )}
                  </div>
                  {isOpen && (
                    <div
                      id={listId}
                      className={classNames(`slds-dropdown slds-dropdown_length-${itemLength} slds-dropdown_fluid`)}
                      role="listbox"
                      onKeyDown={handleListKeyDown}
                      ref={divContainerEl}
                      onBlur={handleBlur}
                    >
                      {Children.count(children) === 0 && (
                        <ul className="slds-listbox slds-listbox_vertical" role="presentation">
                          <ComboboxListItem id="placeholder" label={noItemsPlaceholder} selected={false} onSelection={NOOP} />
                        </ul>
                      )}
                      {hasGroups && childrenWithRef}
                      {!hasGroups && (
                        <ul className="slds-listbox slds-listbox_vertical" role="presentation">
                          {childrenWithRef}
                        </ul>
                      )}
                    </div>
                  )}
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
