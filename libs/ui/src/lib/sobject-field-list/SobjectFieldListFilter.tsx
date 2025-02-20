import { css } from '@emotion/react';
import classNames from 'classnames';
import { Fragment, FunctionComponent, MouseEvent, useEffect, useId, useRef, useState } from 'react';
import RadioButton from '../form/radio/RadioButton';
import RadioGroup from '../form/radio/RadioGroup';
import Popover, { PopoverRef } from '../popover/Popover';
import Icon from '../widgets/Icon';

export type All = 'all';
export type SelectedFilter = All | 'selected';
export type EditableFilter = All | 'editable' | 'creatable' | 'read-only';
export type RequiredFilter = All | 'allows-nulls' | 'does-not-allow-nulls';
export type DefaultFilter = All | 'has-default' | 'no-default';
export type StandardCustomFilter = All | 'standard' | 'custom';
export type ManagedFilter = All | 'unmanaged' | 'managed';

export interface FilterTypes {
  selected: SelectedFilter;
  editable: EditableFilter;
  required: RequiredFilter;
  default: DefaultFilter;
  standardCustom: StandardCustomFilter;
  managed: ManagedFilter;
}

export const DEFAULT_FILTER_TYPES: FilterTypes = {
  selected: 'all',
  editable: 'all',
  required: 'all',
  default: 'all',
  standardCustom: 'all',
  managed: 'all',
};
Object.freeze(DEFAULT_FILTER_TYPES);

export const DEFAULT_FILTER_TYPE_ITEMS = {
  selected: [
    { key: 'all', label: 'All' },
    { key: 'selected', label: 'Selected' },
  ],
  editable: [
    { key: 'all', label: 'All' },
    { key: 'editable', label: 'Editable' },
    { key: 'creatable', label: 'Creatable' },
    { key: 'read-only', label: 'Read-Only' },
  ],
  required: [
    { key: 'all', label: 'All' },
    { key: 'does-not-allow-nulls', label: 'Does Not Allow Null' },
    { key: 'allows-nulls', label: 'Allows Null' },
  ],
  default: [
    { key: 'all', label: 'All' },
    { key: 'no-default', label: 'No Default Value' },
    { key: 'has-default', label: 'Has Default Value' },
  ],
  standardCustom: [
    { key: 'all', label: 'All' },
    { key: 'custom', label: 'Custom' },
    { key: 'standard', label: 'Standard' },
  ],
  managed: [
    { key: 'all', label: 'All' },
    { key: 'unmanaged', label: 'Unmanaged' },
    { key: 'managed', label: 'Managed' },
  ],
};
Object.freeze(DEFAULT_FILTER_TYPE_ITEMS);

export interface SobjectFieldListFilterProps {
  selectedItems: FilterTypes;
  onChange: (selectedItems: FilterTypes) => void;
}

export const SobjectFieldListFilter: FunctionComponent<SobjectFieldListFilterProps> = ({ selectedItems, onChange }) => {
  const popoverRef = useRef<PopoverRef>(null);
  const idPrefix = useId();
  const [filterSelectedCount, setFilterSelectedCount] = useState<number>(
    () => Object.values(selectedItems).filter((item) => item !== 'all').length
  );

  useEffect(() => {
    setFilterSelectedCount(Object.values(selectedItems).filter((item) => item !== 'all').length);
  }, [selectedItems]);

  function handleChange(field: keyof FilterTypes, value: string) {
    onChange({ ...selectedItems, [field]: value });
  }

  function handleReset(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    onChange({ ...DEFAULT_FILTER_TYPES });
    popoverRef.current?.close();
  }

  return (
    <Popover
      ref={popoverRef}
      size="large"
      placement="right"
      content={
        <Fragment>
          <SobjectFieldListFilterSection
            field="selected"
            label="Selected Fields"
            labelHelp="Only show fields that are currently selected."
            idPrefix={idPrefix}
            items={DEFAULT_FILTER_TYPE_ITEMS.selected}
            value={selectedItems.selected}
            onChange={handleChange}
          />
          <SobjectFieldListFilterSection
            field="editable"
            label="Editable Fields"
            labelHelp="Creatable fields are fields that can be set on record creation, but cannot be updated after creation."
            idPrefix={idPrefix}
            items={DEFAULT_FILTER_TYPE_ITEMS.editable}
            value={selectedItems.editable}
            onChange={handleChange}
          />
          <SobjectFieldListFilterSection
            field="required"
            label="Required Fields"
            labelHelp="This only applies to fields that allow null or not, but does not take into consideration many other factors that may make a field required, like validation rules."
            idPrefix={idPrefix}
            items={DEFAULT_FILTER_TYPE_ITEMS.required}
            value={selectedItems.required}
            onChange={handleChange}
          />
          <SobjectFieldListFilterSection
            field="default"
            label="Fields with Default Value"
            labelHelp="Some fields have a default value so may not be required to be set on record creation even if they don't allow null. Checkbox fields always have a default value."
            idPrefix={idPrefix}
            items={DEFAULT_FILTER_TYPE_ITEMS.default}
            value={selectedItems.default}
            onChange={handleChange}
          />
          <SobjectFieldListFilterSection
            field="standardCustom"
            label="Standard or Custom Fields"
            idPrefix={idPrefix}
            items={DEFAULT_FILTER_TYPE_ITEMS.standardCustom}
            value={selectedItems.standardCustom}
            onChange={handleChange}
          />
          <SobjectFieldListFilterSection
            field="managed"
            label="Managed Package Fields"
            idPrefix={idPrefix}
            items={DEFAULT_FILTER_TYPE_ITEMS.managed}
            value={selectedItems.managed}
            onChange={handleChange}
          />
          <hr className="slds-m-vertical_small" />
          <button className="slds-button slds-button_neutral" onClick={handleReset} disabled={!filterSelectedCount}>
            Reset Filters
          </button>
        </Fragment>
      }
      buttonProps={{
        className: classNames('slds-button slds-button_icon', {
          'slds-text-color_brand': !!filterSelectedCount,
        }),
        title: 'open filters menu',
      }}
    >
      <Icon
        type="utility"
        icon="filter"
        description="Open filters menu"
        className="slds-button__icon slds-button__icon_large"
        omitContainer
      />
      {!!filterSelectedCount && (
        <div
          title="Reset all filters"
          css={css`
            position: absolute;
            background-color: #ba0517;
            top: -0.8rem;
            right: -0.5rem;
            border-radius: 50%;
            width: 1.25rem;
            height: 1.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: bold;
            border-width: 2px;
            border-color: white;
            &:hover {
              cursor: pointer;
              &:after {
                content: 'X';
              }
            }
            &:after {
              content: '${filterSelectedCount}';
            }
          `}
          onClick={handleReset}
        ></div>
      )}
    </Popover>
  );
};

export default SobjectFieldListFilter;

interface SobjectFieldListFilterSectionProps {
  field: keyof FilterTypes;
  label: string;
  labelHelp?: string | null;
  idPrefix: string;
  items: { key: string; label: string }[];
  value: string;
  onChange: (field: keyof FilterTypes, value: string) => void;
}

function SobjectFieldListFilterSection({ field, label, labelHelp, idPrefix, items, value, onChange }: SobjectFieldListFilterSectionProps) {
  return (
    <RadioGroup label={label} labelHelp={labelHelp} isButtonGroup>
      {items.map(({ key, label: radioLabel }) => (
        <RadioButton
          key={key}
          id={`${idPrefix}-${field}-${key}`}
          name={field}
          label={radioLabel}
          value={key}
          checked={key === value}
          onChange={(value) => onChange(field, key)}
        />
      ))}
    </RadioGroup>
  );
}
