import { AndOr, ExpressionConditionRowSelectedItems, ListItem, ListItemGroup, QueryFilterOperator } from '@jetstream/types';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import React, { FunctionComponent, useState, useEffect } from 'react';
import Input from '../form/input/Input';
import Picklist from '../form/picklist/Picklist';
import Icon from '../widgets/Icon';
import Combobox from '../form/combobox/Combobox';
import { ComboboxListItem } from '../form/combobox/ComboboxListItem';
import { ComboboxListItemGroup } from '../form/combobox/ComboboxListItemGroup';
import { useDebounce } from '@jetstream/shared/ui-utils';
import FormRowButton from '../form/button/FormRowButton';

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
  onChange: (selected: ExpressionConditionRowSelectedItems) => void;
  onDelete: () => void;
}

function getSelectionLabel(groupLabel: string, item: ListItem<string, unknown>) {
  return `${groupLabel} - ${item.label} ${item.secondaryLabel || ''}`;
}

export const ExpressionConditionRow: FunctionComponent<ExpressionConditionRowProps> = ({
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
  onChange,
  onDelete,
}) => {
  const [visibleResources, setVisibleResources] = useState<ListItemGroup[]>(resources);
  const [resourcesFilter, setResourcesFilter] = useState<string>(null);
  const [selectedValue, setSelectValue] = useState(selected.value);
  const [initialSelectedOperator] = useState(operators.find((item) => item.id === selected.operator) || operators[0]);
  const [selectedResourceComboboxLabel, setSelectedResourceComboboxLabel] = useState<string>(
    selected.resource
      ? getSelectionLabel(
          // FIXME: resources[0] only works for base object!
          resources[0].label,
          resources[0].items.find((item) => item.id === selected.resource)
        )
      : null
  );
  const [selectedResourceTitle, setSelectedResourceTitle] = useState<string>(null);

  useEffect(() => {
    onChange({ ...selected, value: selectedValue });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValue]);

  useEffect(() => {
    if (!resourcesFilter) {
      setVisibleResources(resources);
    } else {
      const filter = resourcesFilter.toLowerCase().trim();
      const tempResources = [];
      resources.forEach((resource) => {
        tempResources.push({
          ...resource,
          items: resource.items.filter((item) => `${item.label.toLowerCase()}${item.value.toLowerCase()}`.includes(filter)),
        });
      });
      setVisibleResources(tempResources);
    }
  }, [resources, resourcesFilter]);

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
              helpText={resourceHelpText}
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
                          onChange({ ...selected, resource: id });
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
              helpText={operatorHelpText}
              items={operators}
              selectedItems={[initialSelectedOperator]}
              allowDeselection={false}
              onChange={(items) => onChange({ ...selected, operator: items[0].value as QueryFilterOperator })}
            />
          </div>
          {/* Value */}
          {/* TODO: this needs to dynamically change based on the resource that is selected (e.x. date picker, combobox, etc..) */}
          <div className="slds-col">
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
              />
            </Input>
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
};

export default ExpressionConditionRow;
