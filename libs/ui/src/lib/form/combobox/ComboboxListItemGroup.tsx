import React, { forwardRef } from 'react';

export interface ComboboxListItemGroupProps {
  label: string;
  children?: React.ReactNode;
}

export const ComboboxListItemGroup = forwardRef<HTMLUListElement, ComboboxListItemGroupProps>(({ label, children }, ref) => {
  return (
    <ul ref={ref} className="slds-listbox slds-listbox_vertical" role="group" aria-label={label}>
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
});
