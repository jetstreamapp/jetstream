import React, { FunctionComponent } from 'react';
import Icon from './Icon';

export interface PillProps {
  label: string;
  onRemove?: () => void;
}

export const Pill: FunctionComponent<PillProps> = ({ label, onRemove }) => {
  return (
    <span className="slds-pill" role="option" tabIndex={0} aria-selected="true">
      <span className="slds-pill__label" title={label}>
        {label}
      </span>
      {onRemove && (
        <button className="slds-button slds-button_icon slds-button_icon slds-pill__remove" title="Remove" onClick={onRemove}>
          <Icon type="utility" icon="close" className="slds-button__icon" description="Remove" omitContainer />
        </button>
      )}
    </span>
  );
};

export default Pill;
