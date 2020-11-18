import React, { FunctionComponent } from 'react';
import Icon from './Icon';
import classNames from 'classnames';

export interface PillProps {
  className?: string;
  title?: string;
  onRemove?: () => void;
}

export const Pill: FunctionComponent<PillProps> = ({ title, className, onRemove, children }) => {
  return (
    <span className={classNames('slds-pill', className)} role="option" tabIndex={0} aria-selected="true">
      <span className="slds-pill__label" title={title}>
        {children}
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
