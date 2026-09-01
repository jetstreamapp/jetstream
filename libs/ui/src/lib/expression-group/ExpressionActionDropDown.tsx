import { css } from '@emotion/react';
import { AndOr, ListItem } from '@jetstream/types';
import React, { FunctionComponent, useState } from 'react';
import Picklist from '../form/picklist/Picklist';

export interface ExpressionActionDropDownProps {
  label: string;
  helpText?: string;
  value: AndOr;
  /** Keep the label for assistive technology only (condition groups show their number in a legend instead) */
  hideLabel?: boolean;
  ancillaryOptions?: React.ReactNode;
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

export const ExpressionActionDropDown: FunctionComponent<ExpressionActionDropDownProps> = ({
  label,
  hideLabel,
  helpText,
  value,
  ancillaryOptions,
  onChange,
}) => {
  const [selectedItem] = useState<ListItem[]>(getInitSelected(value));

  return (
    <div
      className="slds-expression__options slds-grid"
      // A group's legend is padded to line up with a picklist below a visible label line; keep that line's
      // height when the label is assistive text only, or the picklist rides up past the legend
      css={
        hideLabel
          ? css`
              padding-top: 1lh;
            `
          : undefined
      }
    >
      <Picklist
        label={label}
        hideLabel={hideLabel}
        labelHelp={helpText}
        items={items}
        selectedItems={selectedItem}
        allowDeselection={false}
        onChange={(items) => onChange(items[0].id as AndOr)}
      />
      {ancillaryOptions}
    </div>
  );
};

export default ExpressionActionDropDown;
