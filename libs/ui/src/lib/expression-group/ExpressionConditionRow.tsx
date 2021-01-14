// eslint-disable-next-line @typescript-eslint/camelcase
import { useDebounce } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import {
  AndOr,
  ExpressionConditionRowSelectedItems,
  ExpressionRowValueType,
  ListItem,
  ListItemGroup,
  QueryFilterOperator,
} from '@jetstream/types';
import classNames from 'classnames';
import formatISO from 'date-fns/formatISO';
import isValidDate from 'date-fns/isValid';
import parseISO from 'date-fns/parseISO';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import React, { FunctionComponent, useEffect, useState } from 'react';
import FormRowButton from '../form/button/FormRowButton';
import Combobox from '../form/combobox/Combobox';
import { ComboboxListItem } from '../form/combobox/ComboboxListItem';
import { ComboboxListItemGroup } from '../form/combobox/ComboboxListItemGroup';
import DatePicker from '../form/date/DatePicker';
import Input from '../form/input/Input';
import Picklist from '../form/picklist/Picklist';
import Textarea from '../form/textarea/Textarea';

export interface ExpressionConditionRowProps {
  row: number;
  group?: number;
  AndOr?: AndOr;
  resourceLabel?: string;
  resourceHelpText?: string;
  operatorLabel?: string;
  operatorHelpText?: string;
  valueLabel?: string;
  valueLabelHelpText?: string;
  resources: ListItemGroup[];
  operators: ListItem<string, QueryFilterOperator>[];
  selected: ExpressionConditionRowSelectedItems;
  resourceTypes?: ListItem<ExpressionRowValueType>[];
  resourceType?: ExpressionRowValueType;
  resourceSelectItems?: ListItem[];
  disableValueForOperators?: QueryFilterOperator[];
  onChange: (selected: ExpressionConditionRowSelectedItems) => void;
  onDelete: () => void;
}

function getSelectionLabel(groupLabel: string, item: ListItem<string, unknown>) {
  return `${groupLabel} - ${item.label} ${item.secondaryLabel || ''}`;
}

export const ExpressionConditionRow: FunctionComponent<ExpressionConditionRowProps> = React.memo(
  ({
    row,
    group,
    AndOr,
    resourceLabel = 'Resource',
    resourceHelpText,
    operatorLabel = 'Operator',
    operatorHelpText,
    valueLabel = 'Value',
    valueLabelHelpText,
    resources,
    operators,
    selected,
    resourceTypes,
    resourceType = 'TEXT',
    resourceSelectItems,
    disableValueForOperators = [],
    onChange,
    onDelete,
  }) => {
    const [disableValueInput, setDisableValueInput] = useState(false);
    const [visibleResources, setVisibleResources] = useState<ListItemGroup[]>(resources);
    const [selectedResourceType, setSelectedResourceType] = useState<ListItem<ExpressionRowValueType>[]>();
    const [resourcesFilter, setResourcesFilter] = useState<string>(null);
    const [selectedValue, setSelectValue] = useState(selected.value);
    const [initialSelectedOperator] = useState(() => operators.find((item) => item.id === selected.operator) || operators[0]);
    const [selectedResourceComboboxLabel, setSelectedResourceComboboxLabel] = useState<string>(() => {
      if (selected.resource) {
        const group = resources.find((currResource) => currResource.id === selected.resourceGroup);
        if (group) {
          const item = group.items.find((item) => item.id === selected.resource);
          return getSelectionLabel(group.label, item);
        }
      }
      return null;
    });
    const [selectedResourceTitle] = useState<string>(null);
    // used to force re-render and re-init for picklist values - since array turns to string and takes multiple renders
    // the default picklist value does not get picked up in time - so this forces the picklist to re-render
    const [picklistKey, setPicklistKey] = useState<string>(`${new Date().getTime()}`);
    const debouncedSelectedValue = useDebounce(selectedValue, 150);

    useEffect(() => {
      onChange({ ...selected, value: debouncedSelectedValue });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSelectedValue]);

    useEffect(() => {
      if (selected.value !== selectedValue) {
        setSelectValue(selected.value);
        setPicklistKey(`${new Date().getTime()}`);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected.value]);

    useEffect(() => {
      setDisableValueInput(disableValueForOperators.includes(selected.operator));
    }, [disableValueForOperators, selected.operator]);

    useEffect(() => {
      let selectedType: ListItem<ExpressionRowValueType>;
      if (resourceTypes?.length) {
        selectedType = resourceTypes.find((type) => type.value === resourceType) || resourceTypes[0];
        setSelectedResourceType([selectedType]);
      }
      if (!selectedType) {
        setSelectedResourceType(undefined);
      }

      if (selected.resourceType !== selectedType?.value) {
        onChange({ ...selected, resourceType: selectedType?.value });
      }

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resourceTypes, resourceType]);

    useEffect(() => {
      if (!resourcesFilter) {
        setVisibleResources(resources);
      } else {
        const filter = resourcesFilter.toLowerCase().trim();
        const tempResources = [];
        resources.forEach((resource) => {
          tempResources.push({
            ...resource,
            items: resource.items.filter(multiWordObjectFilter(['label', 'value'], filter)),
          });
        });
        setVisibleResources(tempResources);
      }
    }, [resources, resourcesFilter]);

    function handleSelectedResource(type: ListItem<ExpressionRowValueType>[]) {
      setSelectedResourceType(type);
      if (type && type[0] && selected.resourceType !== type[0].value) {
        onChange({ ...selected, resourceType: type[0].value });
      }
    }

    function parseDate(value: string | string[]) {
      if (isString(value)) {
        try {
          const newValue = parseISO(value);
          return isValidDate(newValue) ? newValue : undefined;
        } catch (ex) {
          return undefined;
        }
      }
    }

    return (
      <li className={classNames('slds-expression__row', { 'slds-expression__row_group': isNumber(group) })}>
        <fieldset>
          <legend className="slds-expression__legend">
            {row !== 1 && AndOr && <span>{AndOr}</span>}
            <span className="slds-assistive-text">{`Condition ${row} ${group ? `Of Group ${group}` : ''}`}</span>
          </legend>
          <div className="slds-grid slds-gutters_xx-small">
            {/* Resource */}
            <div className="slds-col">
              <Combobox
                label={resourceLabel}
                labelHelp={resourceHelpText}
                onInputChange={(filter) => setResourcesFilter(filter)}
                selectedItemLabel={selectedResourceComboboxLabel}
                selectedItemTitle={selectedResourceTitle}
              >
                {visibleResources
                  .filter((group) => group.items.length > 0)
                  .map((group) => (
                    <ComboboxListItemGroup key={group.id} label={group.label}>
                      {group.items.map((item) => (
                        <ComboboxListItem
                          key={item.id}
                          id={item.id}
                          label={item.label}
                          secondaryLabel={item.secondaryLabel}
                          selected={item.id === selected.resource}
                          onSelection={(id) => {
                            setSelectedResourceComboboxLabel(getSelectionLabel(group.label, item));
                            onChange({ ...selected, resource: id, resourceGroup: group.id, resourceMeta: item.meta });
                          }}
                        />
                      ))}
                    </ComboboxListItemGroup>
                  ))}
              </Combobox>
            </div>
            {/* Operator */}
            <div className="slds-col slds-grow-none">
              <Picklist
                label={operatorLabel}
                labelHelp={operatorHelpText}
                items={operators}
                selectedItems={[initialSelectedOperator]}
                allowDeselection={false}
                scrollLength={10}
                onChange={(items) => onChange({ ...selected, operator: items[0].value as QueryFilterOperator })}
              />
            </div>
            {/* Type (*Optional*) */}
            {resourceTypes?.length > 0 && selectedResourceType && (
              <div className="slds-col slds-grow-none">
                <Picklist
                  label="Type"
                  items={resourceTypes}
                  selectedItems={selectedResourceType}
                  allowDeselection={false}
                  scrollLength={10}
                  onChange={handleSelectedResource}
                />
              </div>
            )}
            {/* Value */}
            <div className="slds-col">
              {(!resourceType || resourceType === 'TEXT') && (
                <Input
                  id={`value-${row}`}
                  label={valueLabel}
                  helpText={valueLabelHelpText}
                  hasError={false}
                  onClear={() => onChange({ ...selected, value: '' })}
                >
                  <input
                    id={`value-${row}`}
                    className="slds-input"
                    value={selectedValue}
                    onChange={(event) => setSelectValue(event.currentTarget.value)}
                    disabled={disableValueInput}
                  />
                </Input>
              )}
              {resourceType === 'TEXTAREA' && (
                <Textarea id={`value-${row}`} label={valueLabel} helpText="Put each value on a new line" hasError={false}>
                  <textarea
                    id={`value-${row}`}
                    className="slds-textarea"
                    rows={5}
                    value={selectedValue}
                    onChange={(event) => setSelectValue(event.currentTarget.value)}
                    disabled={disableValueInput}
                  />
                </Textarea>
              )}
              {resourceType === 'DATE' && (
                <DatePicker
                  className="width-100"
                  initialSelectedDate={selectedValue ? parseDate(selectedValue) : undefined}
                  label={valueLabel}
                  dropDownPosition="right"
                  onChange={(value) => setSelectValue(formatISO(value, { representation: 'date' }))}
                  disabled={disableValueInput}
                />
              )}
              {resourceType === 'DATETIME' && (
                <DatePicker
                  className="width-100"
                  initialSelectedDate={selectedValue ? parseDate(selectedValue) : undefined}
                  label={valueLabel}
                  dropDownPosition="right"
                  onChange={(value) => setSelectValue(formatISO(value))}
                  disabled={disableValueForOperators.includes(selectedValue as QueryFilterOperator)}
                />
              )}
              {resourceType === 'SELECT' && (
                <Picklist
                  key={picklistKey}
                  label={valueLabel}
                  items={resourceSelectItems || []}
                  selectedItemIds={selectedValue ? [selectedValue as string] : []}
                  allowDeselection={false}
                  onChange={(item) => {
                    if (item && item[0]) {
                      setSelectValue(item[0].id);
                    }
                  }}
                  disabled={disableValueForOperators.includes(selectedValue as QueryFilterOperator)}
                />
              )}
              {resourceType === 'SELECT-MULTI' && (
                <Picklist
                  key={picklistKey}
                  label={valueLabel}
                  items={resourceSelectItems || []}
                  selectedItemIds={isString(selectedValue) ? [selectedValue] : (selectedValue as string[]) || []}
                  multiSelection
                  omitMultiSelectPills
                  onChange={(items) => {
                    if (items) {
                      setSelectValue(items.map((item) => item.id));
                    }
                  }}
                  disabled={disableValueForOperators.includes(selectedValue as QueryFilterOperator)}
                />
              )}
            </div>
            {/* Delete */}
            <div className="slds-col slds-grow-none">
              <FormRowButton
                title="Delete Condition"
                icon={{ type: 'utility', icon: 'delete', description: 'Delete condition' }}
                onClick={onDelete}
              />
            </div>
          </div>
        </fieldset>
      </li>
    );
  }
);

export default ExpressionConditionRow;
