import React, { FunctionComponent } from 'react';
import classNames from 'classnames';

export interface SpinnerProps {
  size?: 'xx-small' | 'x-small' | 'small' | 'medium' | 'large';
  inline?: boolean;
  hasContainer?: boolean;
}

export const Spinner: FunctionComponent<SpinnerProps> = ({ size = 'medium', inline = false, hasContainer = true }) => {
  return (
    <div className={classNames({ 'slds-spinner_container': hasContainer, 'slds-spinner_inline': inline })}>
      <div role="status" className={`slds-spinner slds-spinner_${size} slds-spinner_brand`}>
        <span className="slds-assistive-text">Loading</span>
        <div className="slds-spinner__dot-a"></div>
        <div className="slds-spinner__dot-b"></div>
      </div>
    </div>
  );
};

export default Spinner;
