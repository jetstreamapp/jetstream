import classNames from 'classnames';
import { FunctionComponent, ReactNode } from 'react';
import Icon from './Icon';

export interface PillProps {
  className?: string;
  title?: string;
  /**
   * Render as a `role="option"` inside a listbox (Picklist's selected items). Only pass this when the
   * pill really is a selectable option and an ancestor provides `role="listbox"`.
   *
   * Off by default: `option` makes its children presentational, so a nested remove button loses its
   * own name and role for assistive tech while staying in the tab order, and each pill becomes a
   * second tab stop. Plain pills expose the remove button as the single, properly named tab stop.
   */
  listboxOption?: boolean;
  onRemove?: () => void;
  children?: ReactNode;
}

export const Pill: FunctionComponent<PillProps> = ({ title, className, listboxOption, onRemove, children }) => {
  const listboxProps = listboxOption ? ({ role: 'option', tabIndex: 0, 'aria-selected': true } as const) : {};
  const removeLabel = title ? `Remove: ${title}` : 'Remove';
  return (
    <span className={classNames('slds-pill', className)} {...listboxProps}>
      <span className="slds-pill__label" title={title}>
        {children}
      </span>
      {onRemove && (
        <button
          type="button"
          className="slds-button slds-button_icon slds-button_icon slds-pill__remove"
          title={removeLabel}
          // Inside an option the button is presentational, so naming it would be dropped anyway;
          // as a plain pill it is the tab stop and carries the name itself.
          aria-label={listboxOption ? undefined : removeLabel}
          onClick={onRemove}
        >
          <Icon type="utility" icon="close" className="slds-button__icon" description={removeLabel} omitContainer />
        </button>
      )}
    </span>
  );
};

export default Pill;
