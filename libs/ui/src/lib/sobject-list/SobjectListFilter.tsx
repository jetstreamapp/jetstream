import { css } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { REGEX } from '@jetstream/shared/utils';
import { DescribeGlobalSObjectResult } from '@jetstream/types';
import classNames from 'classnames';
import { Fragment, FunctionComponent, MouseEvent, useMemo, useRef, useState } from 'react';
import Checkbox from '../form/checkbox/Checkbox';
import RadioButton from '../form/radio/RadioButton';
import RadioGroup from '../form/radio/RadioGroup';
import Grid from '../grid/Grid';
import { Popover, PopoverRef } from '../popover/Popover';
import Icon from '../widgets/Icon';

export const TOGGLE_FILTER_TYPE_ITEMS = {
  standardCustom: [
    { value: 'all', label: 'All' },
    { value: 'custom', label: 'Custom' },
    { value: 'standard', label: 'Standard' },
  ],
  managed: [
    { value: 'all', label: 'All' },
    { value: 'unmanaged', label: 'Unmanaged' },
    { value: 'managed', label: 'Managed' },
  ],
} as const;
Object.freeze(TOGGLE_FILTER_TYPE_ITEMS);

const CHECKBOX_FILTERS: { label: string; key: CheckboxFilters }[] = [
  { label: 'Custom Metadata', key: 'CUSTOM_METADATA' },
  { label: 'Share Objects', key: 'SHARE_OBJECT' },
  { label: 'History Tracking', key: 'HISTORY' },
  { label: 'Change Events', key: 'CHANGE_EVENT' },
];
Object.freeze(CHECKBOX_FILTERS);

const DEFAULT_VALUES = {
  STANDARD_CUSTOM: 'all' as 'all' | 'custom' | 'standard',
  MANAGED: 'all' as 'all' | 'unmanaged' | 'managed',
  CUSTOM_METADATA: true as boolean,
  SHARE_OBJECT: true as boolean,
  HISTORY: true as boolean,
  CHANGE_EVENT: true as boolean,
};
Object.freeze(CHECKBOX_FILTERS);

export function getDefaultSobjectFilters() {
  return structuredClone(DEFAULT_VALUES);
}

export type ObjectFilterValues = typeof DEFAULT_VALUES;
type CheckboxFilters = keyof Omit<ObjectFilterValues, 'STANDARD_CUSTOM' | 'MANAGED'>;

export function filterSobjects(
  sobjects: DescribeGlobalSObjectResult[],
  selectedFilters: ObjectFilterValues,
): DescribeGlobalSObjectResult[] {
  return sobjects.filter((sobject) => {
    if (selectedFilters.STANDARD_CUSTOM === 'custom' && !sobject.name.endsWith('__c')) {
      return false;
    }
    if (selectedFilters.STANDARD_CUSTOM === 'standard' && sobject.name.endsWith('__c')) {
      return false;
    }

    if (selectedFilters.MANAGED === 'managed' && !REGEX.HAS_NAMESPACE.test(sobject.name)) {
      return false;
    }
    if (selectedFilters.MANAGED === 'unmanaged' && REGEX.HAS_NAMESPACE.test(sobject.name)) {
      return false;
    }

    if (!selectedFilters.CUSTOM_METADATA && sobject.name.endsWith('__mdt')) {
      return false;
    }

    if (!selectedFilters.SHARE_OBJECT && sobject.name.endsWith('Share')) {
      return false;
    }

    if (!selectedFilters.HISTORY && sobject.name.endsWith('History')) {
      return false;
    }

    if (!selectedFilters.CHANGE_EVENT && sobject.name.endsWith('ChangeEvent')) {
      return false;
    }

    return true;
  });
}

export function getHasFiltersApplied(filters: ObjectFilterValues) {
  return !!Object.entries(filters).filter(([key, value]) => DEFAULT_VALUES[key] !== value).length;
}

export interface SobjectFieldListFilterProps {
  onChange: (selectedItems: ObjectFilterValues) => void;
}

export const SobjectFieldListFilter: FunctionComponent<SobjectFieldListFilterProps> = ({ onChange }) => {
  const popoverRef = useRef<PopoverRef>(null);
  const [selectedFilters, setSelectedFilters] = useState<ObjectFilterValues>(() => getDefaultSobjectFilters());

  const hasFiltersApplied = useMemo(() => getHasFiltersApplied(selectedFilters), [selectedFilters]);

  useNonInitialEffect(() => onChange(selectedFilters), [selectedFilters]);

  function handleRadioChange({
    type,
    value,
  }:
    | { type: 'STANDARD_CUSTOM'; value: (typeof DEFAULT_VALUES)['STANDARD_CUSTOM'] }
    | { type: 'MANAGED'; value: (typeof DEFAULT_VALUES)['MANAGED'] }) {
    setSelectedFilters((prevValue) => ({
      ...prevValue,
      [type]: value,
    }));
  }

  function handleCheckboxChange(type: CheckboxFilters, value: boolean) {
    setSelectedFilters((prevValue) => ({
      ...prevValue,
      [type]: value,
    }));
  }

  function uncheckAllCheckboxes() {
    setSelectedFilters((prevValue) => ({
      ...prevValue,
      CUSTOM_METADATA: false,
      SHARE_OBJECT: false,
      HISTORY: false,
      CHANGE_EVENT: false,
    }));
  }

  function handleReset(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const newValues = structuredClone(DEFAULT_VALUES);
    setSelectedFilters(newValues);
    onChange(newValues);
    popoverRef.current?.close();
  }

  return (
    <Popover
      ref={popoverRef}
      placement="right"
      tooltipProps={{ content: 'Open filters menu', openDelay: 300 }}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title="Filter Objects">
            Filter Objects
          </h2>
        </header>
      }
      content={
        <Fragment>
          <RadioGroup label="Standard or Custom Objects" isButtonGroup>
            {TOGGLE_FILTER_TYPE_ITEMS.standardCustom.map(({ value, label }) => (
              <RadioButton
                key={value}
                id={`standardCustom-${value}`}
                name="standard-or-custom-objects"
                label={label}
                value={value}
                checked={selectedFilters.STANDARD_CUSTOM === value}
                onChange={(value: (typeof DEFAULT_VALUES)['STANDARD_CUSTOM']) => handleRadioChange({ type: 'STANDARD_CUSTOM', value })}
              />
            ))}
          </RadioGroup>

          <RadioGroup label="Managed Objects" isButtonGroup>
            {TOGGLE_FILTER_TYPE_ITEMS.managed.map(({ value, label }) => (
              <RadioButton
                key={value}
                id={`managed-${value}`}
                name={`managed-objects`}
                label={label}
                value={value}
                checked={selectedFilters.MANAGED === value}
                onChange={(value: (typeof DEFAULT_VALUES)['MANAGED']) => handleRadioChange({ type: 'MANAGED', value: value })}
              />
            ))}
          </RadioGroup>
          <fieldset className="slds-form-element">
            <legend
              className="slds-form-element__label slds-truncate"
              css={css`
                font-weight: 700;
              `}
            >
              Other Filters
            </legend>
            {CHECKBOX_FILTERS.map(({ label, key }) => (
              <Checkbox
                key={key}
                id={`sobject-filter_${key}`}
                label={label}
                checked={selectedFilters[key]}
                onChange={(value) => handleCheckboxChange(key, value)}
              />
            ))}
            <button className="slds-button slds-m-top_xx-small" onClick={() => uncheckAllCheckboxes()}>
              Uncheck all
            </button>
          </fieldset>
          <hr className="slds-m-vertical_small" />
          <Grid align="spread">
            <button className="slds-button slds-button_neutral" onClick={handleReset}>
              Reset Filters
            </button>
          </Grid>
        </Fragment>
      }
      buttonProps={{
        className: classNames('slds-m-left_xx-small slds-button slds-button_icon', {
          'slds-text-color_brand': hasFiltersApplied,
        }),
      }}
    >
      <Icon
        type="utility"
        icon="filterList"
        description="Open filters menu"
        className="slds-button__icon slds-button__icon_medium"
        omitContainer
      />
      {!!hasFiltersApplied && (
        <div
          title="Reset all filters"
          css={css`
            position: absolute;
            background-color: var(--slds-g-color-error-base-30, #ba0517);
            top: -0.4rem;
            right: -0.4rem;
            border-radius: 50%;
            width: 0.75rem;
            height: 0.75rem;
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
          `}
          onClick={handleReset}
        ></div>
      )}
    </Popover>
  );
};
