import { AndOr, ExpressionConditionRowSelectedItems, ListItem } from '@jetstream/types';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import React, { FunctionComponent } from 'react';
import Input from '../form/input/Input';
import Picklist from '../form/picklist/Picklist';
import Icon from '../widgets/Icon';

export interface ExpressionConditionRowProps {
  row: number;
  group?: number;
  AndOr?: AndOr;
  resourceLabel?: string;
  operatorLabel?: string;
  valueLabel?: string;
  resources: ListItem[];
  operators: ListItem[];
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
            <Picklist
              label={resourceLabel}
              items={resources}
              allowDeselection={false}
              onChange={(items) => onChange({ ...selected, resource: items.length > 0 ? items[0].id : null })}
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
