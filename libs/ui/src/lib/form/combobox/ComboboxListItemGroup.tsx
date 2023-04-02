import React, { forwardRef } from 'react';
import { ComboboxListItemHeading } from './ComboboxListItemHeading';

export interface ComboboxListItemGroupProps {
  label: string;
  children?: React.ReactNode;
}

export const ComboboxListItemGroup = forwardRef<HTMLUListElement, ComboboxListItemGroupProps>(({ label, children }, ref) => {
  return (
    <ul ref={ref} className="slds-listbox slds-listbox_vertical" role="group" aria-label={label}>
      <ComboboxListItemHeading label={label} />
      {children}
    </ul>
  );
});
