import { isEnterOrSpace } from '@jetstream/shared/ui-utils';
import { forwardRef, KeyboardEvent, MouseEvent } from 'react';

export interface ComboboxListItemHeadingProps {
  label: string;
  actionLabel?: string;
  onActionClick?: () => void;
}

/**
 * Group heading or heading with action button (e.x. reset for drill-in)
 */
export const ComboboxListItemHeading = forwardRef<HTMLLIElement, ComboboxListItemHeadingProps>(
  ({ label, actionLabel, onActionClick }: ComboboxListItemHeadingProps, ref) => {
    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onActionClick && onActionClick();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      // Only consume the keys this handles — the unconditional preventDefault/stopPropagation
      // trapped focus on the button (Tab could not move) and swallowed Escape before the
      // combobox's close handler could see it
      if (isEnterOrSpace(event)) {
        event.preventDefault();
        event.stopPropagation();
        onActionClick && onActionClick();
      }
    };

    return (
      <li ref={ref} role="presentation" className="slds-listbox__item slds-grid slds-grid_align-spread">
        <div className="slds-media slds-listbox__option slds-listbox__option_plain slds-media_small slds-truncate" role="presentation">
          <h3 className="slds-listbox__option-header slds-truncate" role="presentation" title={label}>
            {label}
          </h3>
        </div>
        {actionLabel && onActionClick && (
          <button className="slds-button slds-m-right_medium" onClick={handleClick} onKeyDown={handleKeyDown}>
            {actionLabel}
          </button>
        )}
      </li>
    );
  },
);
