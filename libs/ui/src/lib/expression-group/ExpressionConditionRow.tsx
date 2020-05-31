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

export interface ExpressionConditionRowProps {
  row: number;
  group?: number;
  AndOr?: AndOr;
  resourceLabel?: string;
  operatorLabel?: string;
  valueLabel?: string;
  resources: ListItemGroup[];
  operators: ListItem<string, QueryFilterOperator>[];
  selected: ExpressionConditionRowSelectedItems;
  onChange: (selected: ExpressionConditionRowSelectedItems) => void;
  onDelete: () => void;
}

export const ExpressionConditionRow: FunctionComponent<ExpressionConditionRowProps> = ({
  row,
  group,
  AndOr,
  resourceLabel = 'Resource',
  operatorLabel = 'Operator',
  valueLabel = 'Value',
  resources,
  operators,
  selected,
  onChange,
  onDelete,
}) => {
  const [visibleResources, setVisibleResources] = useState<ListItemGroup[]>(resources);
  const [resourcesFilter, setResourcesFilter] = useState<string>(null);
  const [selectedResourceLabel, setSelectedResourceLabel] = useState<string>(null);
  const [selectedResourceTitle, setSelectedResourceTitle] = useState<string>(null);

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
              onInputChange={(filter) => setResourcesFilter(filter)}
              selectedItemLabel={selectedResourceLabel}
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
                        selected={item.id === selected.resource}
                        onSelection={(id) => {
                          setSelectedResourceLabel(`${group.label} - ${item.label}`);
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
              items={operators}
              selectedItems={[operators[0]]}
              allowDeselection={false}
              onChange={(items) => onChange({ ...selected, operator: items[0].value as QueryFilterOperator })}
            />
          </div>
          {/* Value */}
          {/* TODO: this needs to dynamically change based on the resource that is selected (e.x. date picker, combobox, etc..) */}
          <div className="slds-col">
            <Input id={`value-${row}`} label={valueLabel} hasError={false} onClear={() => onChange({ ...selected, value: '' })}>
              <input
                id={`value-${row}`}
                className="slds-input"
                value={selected.value}
                onChange={(event) => onChange({ ...selected, value: event.currentTarget.value })}
              />
            </Input>
          </div>
          {/* Delete */}
          <div className="slds-col slds-grow-none">
            <div className="slds-form-element">
              <span className="slds-form-element__label" style={{ marginTop: `15px` }} />
              <div className="slds-form-element__control">
                <button
                  className="slds-button slds-button_icon slds-button_icon-border-filled"
                  title="Delete Condition"
                  onClick={() => onDelete()}
                >
                  <Icon type="utility" icon="delete" description="Delete condition" className="slds-button__icon" omitContainer={true} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </fieldset>
    </li>
  );
};

export default ExpressionConditionRow;
