import { AndOr, ListItem } from '@jetstream/types';
import React, { FunctionComponent, useState } from 'react';
import Picklist from '../form/picklist/Picklist';

export interface ExpressionActionDropDownProps {
  label: string;
  value: AndOr;
  onChange: (value: AndOr) => void;
}

const items: ListItem[] = [
  { id: 'AND', label: 'All conditions are met', value: 'AND' },
  { id: 'OR', label: 'Any conditions are met', value: 'OR' },
];

function getInitSelected(value: AndOr) {
  const item = value ? items.find((item) => item.id === value) : undefined;
  if (item) {
    return [item];
  } else {
    return [];
  }
}

export const ExpressionActionDropDown: FunctionComponent<ExpressionActionDropDownProps> = ({ label, value, onChange }) => {
  const [selectedItem] = useState<ListItem[]>(getInitSelected(value));

  return (
    <div className="slds-expression__options">
      <Picklist
        label={label}
        items={items}
        selectedItems={selectedItem}
        allowDeselection={false}
        onChange={(items) => onChange(items[0].id as AndOr)}
      />
    </div>
  );
};

export default ExpressionActionDropDown;
