import { ListItem, GroupingOperator } from '@jetstream/types';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import React, { FunctionComponent } from 'react';
import Combobox from '../form/combobox/Combobox';
import { ComboboxListItem } from '../form/combobox/ComboboxListItem';
import Input from '../form/input/Input';
import Icon from '../widgets/Icon';
import Picklist from '../form/picklist/Picklist';

export interface ExpressionConditionRowSelectedItems {
  resource: string | null;
  operator: string | null;
  value: string | null;
}

export interface ExpressionConditionRowProps {
  row: number;
  group?: number;
  groupingOperator?: GroupingOperator;
  resourceLabel?: string;
  operatorLabel?: string;
  valueLabel?: string;
  resources: ListItem[];
  operators: ListItem[];
  selected: ExpressionConditionRowSelectedItems;
  onChange: (selected: ExpressionConditionRowSelectedItems) => void;
  // TODO: on delete
}

export const ExpressionConditionRow: FunctionComponent<ExpressionConditionRowProps> = ({
  row,
  group,
  groupingOperator,
  resourceLabel = 'Resource',
  operatorLabel = 'Operator',
  valueLabel = 'Value',
  resources,
  operators,
  selected,
  onChange,
}) => {
  return (
    <li className={classNames('slds-expression__row', { 'slds-expression__row_group': isNumber(group) })}>
      <fieldset>
        <legend className="slds-expression__legend">
          {groupingOperator && <span>{groupingOperator}</span>}
          <span className="slds-assistive-text">
            Condition {row} {group ? `Of Group ${group}` : ''}
          </span>
        </legend>
        <div className="slds-grid slds-gutters_xx-small">
          {/* Resource */}
          <div className="slds-col">
            <Picklist
              label={resourceLabel}
              items={resources}
              allowDeselection={true}
              onChange={(items) => onChange({ ...selected, resource: items[0].id })}
            />
          </div>
          {/* Operator */}
          <div className="slds-col slds-grow-none">
            <Picklist
              label={operatorLabel}
              items={operators}
              selectedItems={[operators[0]]}
              allowDeselection={false}
              onChange={(items) => onChange({ ...selected, operator: items[0].id })}
            />
          </div>
          {/* Value */}
          {/* TODO: this needs to dynamically change based on the resource that is selected (e.x. date picker, combobox, etc..) */}
          <div className="slds-col">
            <Input id={`value-${row}`} label={valueLabel} hasError={false} onClear={() => onChange({ ...selected, value: null })}>
              <input id={`value-${row}`} className="slds-input" value={selected.value} />
            </Input>
          </div>
          {/* Delete */}
          <div className="slds-col slds-grow-none">
            <div className="slds-form-element">
              <span className="slds-form-element__label"> </span>
              <div className="slds-form-element__control"> </div>
              <button className="slds-button slds-button_icon slds-button_icon-border-filled" title="Delete Condition">
                <Icon type="utility" icon="delete" description="Delete condition" className="slds-button__icon" omitContainer={true} />
              </button>
            </div>
          </div>
        </div>
      </fieldset>
    </li>
  );
};

export default ExpressionConditionRow;
