// https://www.lightningdesignsystem.com/components/dueling-picklist/
import { UpDown } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, ReactNode, useId, useMemo, useRef } from 'react';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import DuelingPicklistColumn from './DuelingPicklistColumn';
import { DuelingPicklistColumnRef, DuelingPicklistItem } from './DuelingPicklistTypes';

export interface DuelingPicklistProps {
  id?: string;
  className?: string;
  label?: string;
  labelHelp?: string | null;
  hideLabel?: boolean;
  labelLeft: string;
  labelRight: string;
  isRequired?: boolean;
  /** Hide the up/down buttons, for when the order of the selected items has no meaning */
  omitReorder?: boolean;
  disabled?: boolean;
  /** Columns grow with the available width instead of the fixed SLDS width */
  isResponsive?: boolean;
  /** Show a text filter above the available items, useful for long lists */
  allowFilter?: boolean;
  filterPlaceholder?: string;
  /** Shown in the right column while nothing is selected */
  emptySelectionMessage?: string;
  helpText?: ReactNode;
  hasError?: boolean;
  errorMessage?: ReactNode;
  /** Every item that can be selected, the left column lists the ones that are not selected in this order */
  items: DuelingPicklistItem[];
  /** Values of the selected items, the right column lists them in this order */
  selectedItems: string[];
  onChange: (selectedItems: string[]) => void;
}

/**
 * Move the given values one position up or down within the list.
 * Values that are already at the edge they are moving towards stay where they are.
 */
function reorderValues(values: string[], valuesToMove: Set<string>, direction: UpDown): string[] {
  const output = direction === 'UP' ? [...values] : [...values].reverse();
  for (let i = 1; i < output.length; i++) {
    if (valuesToMove.has(output[i]) && !valuesToMove.has(output[i - 1])) {
      [output[i - 1], output[i]] = [output[i], output[i - 1]];
    }
  }
  return direction === 'UP' ? output : output.reverse();
}

/**
 * Two lists side by side, items are moved from the available list to the selected list.
 * Controlled: the parent owns `selectedItems` and decides the order of the selected list.
 */
export const DuelingPicklist: FunctionComponent<DuelingPicklistProps> = ({
  id: idProp,
  className,
  label,
  labelHelp,
  hideLabel = false,
  labelLeft,
  labelRight,
  isRequired = false,
  omitReorder = false,
  disabled = false,
  isResponsive = false,
  allowFilter = false,
  filterPlaceholder,
  emptySelectionMessage,
  helpText,
  hasError = false,
  errorMessage,
  items,
  selectedItems,
  onChange,
}) => {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const columnLeftRef = useRef<DuelingPicklistColumnRef>(null);
  const columnRightRef = useRef<DuelingPicklistColumnRef>(null);

  const { itemsLeft, itemsRight } = useMemo(() => {
    const itemsByValue = new Map(items.map((item) => [item.value, item]));
    const selectedValues = new Set(selectedItems);
    return {
      itemsLeft: items.filter(({ value }) => !selectedValues.has(value)),
      itemsRight: selectedItems.flatMap((value) => itemsByValue.get(value) ?? []),
    };
  }, [items, selectedItems]);

  // After a keyboard move, focus follows the items into the other column so the user can keep going from there
  function handleSelect(itemsToSelect: DuelingPicklistItem[], viaKeyboard: boolean) {
    const values = itemsToSelect.map(({ value }) => value);
    onChange([...selectedItems, ...values]);
    if (viaKeyboard) {
      columnRightRef.current?.focusItems(values);
    }
  }

  function handleDeselect(itemsToDeselect: DuelingPicklistItem[], viaKeyboard: boolean) {
    const valuesToRemove = new Set(itemsToDeselect.map(({ value }) => value));
    onChange(selectedItems.filter((value) => !valuesToRemove.has(value)));
    if (viaKeyboard) {
      columnLeftRef.current?.focusItems(Array.from(valuesToRemove));
    }
  }

  function handleReorder(itemsToMove: DuelingPicklistItem[], direction: UpDown) {
    onChange(reorderValues(selectedItems, new Set(itemsToMove.map(({ value }) => value)), direction));
  }

  return (
    <div
      className={classNames('slds-form-element', { 'slds-has-error': hasError }, className)}
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={hasError && errorMessage ? `${id}-error` : undefined}
    >
      <span
        id={`${id}-label`}
        className={classNames('slds-form-element__label slds-form-element__legend', { 'slds-assistive-text': hideLabel })}
      >
        {isRequired && (
          <abbr className="slds-required" title="required">
            *{' '}
          </abbr>
        )}
        {label}
      </span>
      {labelHelp && !hideLabel && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
      <div className="slds-form-element__control">
        <div className="slds-dueling-list">
          <DuelingPicklistColumn
            ref={columnLeftRef}
            id={`${id}-left`}
            items={itemsLeft}
            label={labelLeft}
            disabled={disabled}
            isResponsive={isResponsive}
            allowFilter={allowFilter}
            filterPlaceholder={filterPlaceholder}
            emptyMessage="No more items"
            allowMoveDirection="RIGHT"
            onMove={handleSelect}
          />
          <div className="slds-dueling-list__column">
            <button
              type="button"
              className="slds-button slds-button_icon slds-button_icon-container"
              title={`Move selection to ${labelRight}`}
              disabled={disabled}
              onClick={() => columnLeftRef.current?.moveSelection()}
            >
              <Icon
                type="utility"
                icon="right"
                className="slds-button__icon"
                omitContainer
                description={`Move selection to ${labelRight}`}
              />
            </button>
            <button
              type="button"
              className="slds-button slds-button_icon slds-button_icon-container"
              title={`Move selection to ${labelLeft}`}
              disabled={disabled}
              onClick={() => columnRightRef.current?.moveSelection()}
            >
              <Icon type="utility" icon="left" className="slds-button__icon" omitContainer description={`Move selection to ${labelLeft}`} />
            </button>
          </div>
          <DuelingPicklistColumn
            ref={columnRightRef}
            id={`${id}-right`}
            items={itemsRight}
            label={labelRight}
            disabled={disabled}
            isResponsive={isResponsive}
            emptyMessage={emptySelectionMessage}
            allowMoveDirection="LEFT"
            onMove={handleDeselect}
            onMoveWithinList={omitReorder ? undefined : handleReorder}
          />
          {!omitReorder && (
            <div className="slds-dueling-list__column">
              <button
                type="button"
                className="slds-button slds-button_icon slds-button_icon-container"
                title="Move selection up"
                disabled={disabled}
                onClick={() => columnRightRef.current?.moveWithinList('UP')}
              >
                <Icon type="utility" icon="up" className="slds-button__icon" omitContainer description="Move selection up" />
              </button>
              <button
                type="button"
                className="slds-button slds-button_icon slds-button_icon-container"
                title="Move selection down"
                disabled={disabled}
                onClick={() => columnRightRef.current?.moveWithinList('DOWN')}
              >
                <Icon type="utility" icon="down" className="slds-button__icon" omitContainer description="Move selection down" />
              </button>
            </div>
          )}
        </div>
      </div>
      {helpText && <div className="slds-form-element__help">{helpText}</div>}
      {hasError && errorMessage && (
        <div className="slds-form-element__help" id={`${id}-error`}>
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default DuelingPicklist;
