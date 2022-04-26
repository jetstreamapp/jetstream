import React, { FunctionComponent } from 'react';

export interface ComboboxListItemGroupProps {
  label?: string; // can pass in children instead to override the complete media body
  children?: React.ReactNode;
}

export const ComboboxListItemGroup: FunctionComponent<ComboboxListItemGroupProps> = ({ label, children }) => {
  return (
    <ul className="slds-listbox slds-listbox_vertical" role="group" aria-label={label}>
      <li role="presentation" className="slds-listbox__item slds-item">
        <div className="slds-media slds-listbox__option slds-listbox__option_plain slds-media_small" role="presentation">
          <h3 className="slds-listbox__option-header" role="presentation">
            {label}
          </h3>
        </div>
      </li>
      {children}
    </ul>
  );
};
