import React, { FunctionComponent } from 'react';
import Combobox from '../form/combobox/Combobox';
import { ComboboxListItem } from '../form/combobox/ComboboxListItem';
import { GroupingOperator, ListItem } from '@silverthorn/types';
import Picklist from '../form/picklist/Picklist';

export interface ExpressionActionDropDownProps {
  label: string;
  value: GroupingOperator;
  onChange: (value: GroupingOperator) => void;
}

const items: ListItem[] = [
  { id: 'AND', label: 'All conditions are met', value: 'AND' },
  { id: 'OR', label: 'Any conditions are met', value: 'OR' },
];

export const ExpressionActionDropDown: FunctionComponent<ExpressionActionDropDownProps> = ({ label, value, onChange }) => {
  return (
    <div className="slds-expression__options">
      <Picklist
        label={label}
        items={items}
        selectedItems={[items[0]]}
        allowDeselection={false}
        onChange={(items) => onChange(items[0].id as GroupingOperator)}
      />
    </div>
  );
};

export default ExpressionActionDropDown;
