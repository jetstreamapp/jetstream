import { css } from '@emotion/react';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { getFlattenedListItems } from '@jetstream/shared/utils';
import {
  AndOr,
  ExpressionConditionHelpText,
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
import { useDrag } from 'react-dnd';
import FormRowButton from '../form/button/FormRowButton';
import ComboboxWithItems from '../form/combobox/ComboboxWithItems';
import { ComboboxWithItemsVirtual } from '../form/combobox/ComboboxWithItemsVirtual';
import DatePicker from '../form/date/DatePicker';
import Input from '../form/input/Input';
import Picklist from '../form/picklist/Picklist';
import Textarea from '../form/textarea/Textarea';
import { Icon } from '../widgets/Icon';
import { DraggableRow } from './expression-types';

export interface ExpressionConditionRowProps {
  rowKey: number;
  groupKey?: number;
  row: number;
  group?: number;
  AndOr?: AndOr;
  showDragHandles?: boolean;
  wrap?: boolean;
  resourceLabel?: string;
  resourceHelpText?: string;
  operatorLabel?: string;
  operatorHelpText?: string;
  valueLabel?: string;
  valueLabelHelpText?: string;
  rowHelpText?: ExpressionConditionHelpText;
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

function getSelectionLabel(item: ListItem<string, unknown>) {
  return `${item.secondaryLabel} (${item.label})`;
}

export const ExpressionConditionRow: FunctionComponent<ExpressionConditionRowProps> = React.memo(
  ({
    rowKey,
    groupKey,
    row,
    group,
    AndOr,
    showDragHandles,
    wrap,
    resourceLabel = 'Resource',
    resourceHelpText,
    operatorLabel = 'Operator',
    operatorHelpText,
    valueLabel = 'Value',
    valueLabelHelpText,
    rowHelpText,
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
    const [flattenedResources, setFlattenedResources] = useState<ListItem[]>(() => getFlattenedListItems(resources));
    const [selectedResourceType, setSelectedResourceType] = useState<ListItem<ExpressionRowValueType>[]>();
    const [selectedValue, setSelectValue] = useState(selected.value);
    // used to force re-render and re-init for picklist values - since array turns to string and takes multiple renders
    // the default picklist value does not get picked up in time - so this forces the picklist to re-render
    const [picklistKey, setPicklistKey] = useState<string>(`${new Date().getTime()}`);
    const debouncedSelectedValue = useDebounce(selectedValue, 150);

    const [{ isDragging }, drag, preview] = useDrag(
      () => ({
        type: 'row',
        item: (): DraggableRow => ({ rowKey, groupKey }),
        collect: (monitor) => ({
          isDragging: !!monitor.isDragging(),
        }),
      }),
      [row]
    );

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
    }, [selected.value, selected.resourceType]);

    useEffect(() => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setDisableValueInput(disableValueForOperators.includes(selected.operator!));
    }, [disableValueForOperators, selected.operator]);

    useEffect(() => {
      let selectedType: ListItem<ExpressionRowValueType> | undefined = undefined;
      if (resourceTypes?.length) {
        // changing operator can change the resource type, some types are considered equivalent
        if (resourceType === 'TEXT' || resourceType === 'TEXTAREA') {
          selectedType = resourceTypes.find((type) => type.value === 'TEXT' || type.value === 'TEXTAREA');
        } else if (resourceType === 'SELECT' || resourceType === 'SELECT-MULTI') {
          selectedType = resourceTypes.find((type) => type.value === 'SELECT' || type.value === 'SELECT-MULTI');
        } else {
          selectedType = resourceTypes.find((type) => type.value === resourceType);
        }
        // fallback if no type match
        selectedType = selectedType || resourceTypes[0];
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
      setFlattenedResources(getFlattenedListItems(resources));
    }, [resources]);

    function handleSelectedResourceType(type: ListItem<ExpressionRowValueType>[]) {
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
      <li
        ref={preview}
        className={classNames('slds-expression__row', {
          'slds-expression__row_group': isNumber(group),
          'slds-border_top': row > 1 && wrap,
        })}
        css={css`
          opacity: ${isDragging ? '.4' : '1'};
        `}
      >
        <fieldset>
          <legend className="slds-expression__legend slds-grid">
            {row !== 1 && AndOr && <span>{AndOr}</span>}
            <span className="slds-assistive-text">{`Condition ${row} ${group ? `Of Group ${group}` : ''}`}</span>
          </legend>
          <div className={classNames('slds-grid slds-gutters_xx-small', { 'slds-wrap': wrap })}>
            {showDragHandles && (
              <button
                ref={drag}
                css={css`
                  cursor: grab;
                `}
                className="slds-button slds-button_icon"
                title="Drag row between groups or out of the group"
              >
                <Icon icon="drag_and_drop" type="utility" className="slds-button__icon" omitContainer description="Drag filter row" />
              </button>
            )}
            {/* Resource */}
            <div className="slds-col">
              <ComboboxWithItemsVirtual
                comboboxProps={{
                  label: resourceLabel,
                  labelHelp: resourceHelpText,
                  itemLength: 10,
                }}
                selectedItemLabelFn={getSelectionLabel}
                selectedItemId={selected.resource}
                items={flattenedResources}
                onSelected={(item) =>
                  onChange({ ...selected, resource: item.id, resourceGroup: item.group?.id || '', resourceMeta: item.meta })
                }
              />
            </div>
            {/* Operator */}
            <div className="slds-col slds-grow-none">
              <ComboboxWithItems
                comboboxProps={{
                  label: operatorLabel,
                  labelHelp: operatorHelpText,
                  itemLength: 10,
                }}
                items={operators}
                selectedItemId={selected.operator}
                onSelected={(item) => onChange({ ...selected, operator: item.value as QueryFilterOperator })}
              />
            </div>
            {/* Type (*Optional*) */}
            {resourceTypes && resourceTypes?.length > 0 && selectedResourceType && (
              <div className="slds-col slds-grow-none">
                <Picklist
                  label="Type"
                  items={resourceTypes}
                  selectedItems={selectedResourceType}
                  allowDeselection={false}
                  scrollLength={10}
                  onChange={handleSelectedResourceType}
                />
              </div>
            )}
            {/* Value */}
            <div className="slds-col">
              {(!resourceType || resourceType === 'TEXT') && (
                <Input
                  id={`value-${group || 0}-${row}`}
                  label={valueLabel}
                  helpText={valueLabelHelpText}
                  hasError={false}
                  onClear={() => onChange({ ...selected, value: '' })}
                >
                  <input
                    id={`value-${group || 0}-${row}`}
                    className="slds-input"
                    value={selectedValue}
                    onChange={(event) => setSelectValue(event.currentTarget.value)}
                    disabled={disableValueInput}
                  />
                </Input>
              )}
              {resourceType === 'TEXTAREA' && (
                <Textarea id={`value-${group || 0}-${row}`} label={valueLabel} helpText="Put each value on a new line" hasError={false}>
                  <textarea
                    id={`value-${group || 0}-${row}`}
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
                  onChange={(value) => value && setSelectValue(formatISO(value, { representation: 'date' }))}
                  disabled={disableValueInput}
                />
              )}
              {resourceType === 'DATETIME' && (
                <DatePicker
                  className="width-100"
                  initialSelectedDate={selectedValue ? parseDate(selectedValue) : undefined}
                  label={valueLabel}
                  dropDownPosition="right"
                  onChange={(value) => value && setSelectValue(formatISO(value))}
                  disabled={disableValueInput}
                />
              )}
              {resourceType === 'SELECT' && (
                <Picklist
                  key={picklistKey}
                  label={valueLabel}
                  items={resourceSelectItems || []}
                  selectedItemIds={selectedValue ? [selectedValue as string] : []}
                  allowDeselection
                  scrollLength={10}
                  onChange={(item) => {
                    if (item && item[0]) {
                      setSelectValue(item[0].id);
                    }
                  }}
                  disabled={disableValueInput}
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
                  scrollLength={10}
                  onChange={(items) => {
                    if (items) {
                      setSelectValue(items.map((item) => item.id));
                    }
                  }}
                  disabled={disableValueInput}
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
        {rowHelpText && (
          <div className="slds-m-left_xx-large">
            <span
              className={classNames('slds-p-left_xx-small', {
                'slds-text-color_weak': rowHelpText.type === 'hint',
                'text-color_warning': rowHelpText.type === 'warning',
              })}
            >
              {rowHelpText.value}
            </span>
          </div>
        )}
      </li>
    );
  }
);

export default ExpressionConditionRow;
