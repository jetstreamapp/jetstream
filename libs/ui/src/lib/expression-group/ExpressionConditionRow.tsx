import {
  AndOr,
  ExpressionConditionRowSelectedItems,
  ListItem,
  ListItemGroup,
  QueryFilterOperator,
  SelectTextTextAreaDateDateTime,
} from '@jetstream/types';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import React, { FunctionComponent, useState, useEffect } from 'react';
import Input from '../form/input/Input';
import Textarea from '../form/textarea/Textarea';
import Picklist from '../form/picklist/Picklist';
import Combobox from '../form/combobox/Combobox';
import { ComboboxListItem } from '../form/combobox/ComboboxListItem';
import { ComboboxListItemGroup } from '../form/combobox/ComboboxListItemGroup';
import FormRowButton from '../form/button/FormRowButton';
import DatePicker from '../form/date/DatePicker';
import moment from 'moment-mini';
import { YYYY_MM_DD } from '@jetstream/shared/constants';

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
  resourceTypes?: ListItem<SelectTextTextAreaDateDateTime>[];
  resourceType?: SelectTextTextAreaDateDateTime;
  resourceSelectItems?: ListItem[];
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
    onChange,
    onDelete,
  }) => {
    const [visibleResources, setVisibleResources] = useState<ListItemGroup[]>(resources);
    const [selectedResourceType, setSelectedResourceType] = useState<ListItem<SelectTextTextAreaDateDateTime>[]>([]);
    const [resourcesFilter, setResourcesFilter] = useState<string>(null);
    const [selectedValue, setSelectValue] = useState(selected.value);
    const [initialSelectedOperator] = useState(operators.find((item) => item.id === selected.operator) || operators[0]);
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

    useEffect(() => {
      onChange({ ...selected, value: selectedValue });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedValue]);

    useEffect(() => {
      let selectedType: ListItem<SelectTextTextAreaDateDateTime>;
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
            items: resource.items.filter((item) => `${item.label.toLowerCase()}${item.value.toLowerCase()}`.includes(filter)),
          });
        });
        setVisibleResources(tempResources);
      }
    }, [resources, resourcesFilter]);

    function handleSelectedResource(type: ListItem<SelectTextTextAreaDateDateTime>[]) {
      setSelectedResourceType(type);
      if (type && type[0] && selected.resourceType !== type[0].value) {
        onChange({ ...selected, resourceType: type[0].value });
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
                            onChange({ ...selected, resource: id, resourceGroup: group.id });
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
            {/* Type (*Optional*) */}
            {resourceTypes?.length > 0 && selectedResourceType && (
              <div className="slds-col slds-grow-none">
                <Picklist
                  label="Type"
                  items={resourceTypes}
                  selectedItems={selectedResourceType}
                  allowDeselection={false}
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
                  />
                </Input>
              )}
              {resourceType === 'TEXTAREA' && (
                <Textarea id={`value-${row}`} label={valueLabel} helpText={valueLabelHelpText} hasError={false}>
                  <textarea
                    id={`value-${row}`}
                    className="slds-textarea"
                    rows={5}
                    value={selectedValue}
                    onChange={(event) => setSelectValue(event.currentTarget.value)}
                  />
                </Textarea>
              )}
              {resourceType === 'DATE' && (
                <DatePicker
                  className="width-100"
                  initialSelectedDate={selectedValue ? moment(selectedValue, YYYY_MM_DD) : undefined}
                  label={valueLabel}
                  onChange={(value) => setSelectValue(value.format(YYYY_MM_DD))}
                />
              )}
              {resourceType === 'DATETIME' && (
                // TODO:
                <DatePicker
                  initialSelectedDate={selectedValue ? moment(selectedValue, YYYY_MM_DD) : undefined}
                  label={valueLabel}
                  onChange={(value) => setSelectValue(value.format(YYYY_MM_DD))}
                />
              )}
              {resourceType === 'SELECT' && (
                // TODO: this should optionally allow multi-selection, but not sure how to represent
                <Picklist
                  label={valueLabel}
                  items={resourceSelectItems || []}
                  selectedItemIds={selectedValue ? [selectedValue] : []}
                  allowDeselection={false}
                  onChange={(item) => setSelectValue(item[0].id)}
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
