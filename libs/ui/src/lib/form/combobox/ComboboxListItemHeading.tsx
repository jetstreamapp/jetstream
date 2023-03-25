import { forwardRef } from 'react';

export interface ComboboxListItemHeadingProps {
  label: string;
  actionLabel?: string;
  onActionClick?: () => void;
}

export const ComboboxListItemHeading = forwardRef<HTMLLIElement, ComboboxListItemHeadingProps>(
  ({ label, actionLabel, onActionClick }, ref) => {
    return (
      <li ref={ref} role="presentation" className="slds-listbox__item slds-grid slds-grid_align-spread">
        <div className="slds-media slds-listbox__option slds-listbox__option_plain slds-media_small" role="presentation">
          <h3 className="slds-listbox__option-header" role="presentation">
            {label}
          </h3>
        </div>
        {actionLabel && onActionClick && (
          <button className="slds-button slds-m-right_medium" onClick={onActionClick}>
            {actionLabel}
          </button>
        )}
      </li>
    );
  }
);
