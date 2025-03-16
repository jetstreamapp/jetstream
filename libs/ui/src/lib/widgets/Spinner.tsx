import classNames from 'classnames';
import { FunctionComponent } from 'react';

export interface SpinnerProps {
  size?: 'xx-small' | 'x-small' | 'small' | 'medium' | 'large';
  inline?: boolean;
  hasContainer?: boolean;
  // If provided, this overrides all other classes on the spinner div
  // Normally this is used with hasContainer={false}
  className?: string;
  containerClassName?: string;
}

export const Spinner: FunctionComponent<SpinnerProps> = ({
  size = 'medium',
  inline = false,
  hasContainer = true,
  className,
  containerClassName,
}) => {
  return (
    <div className={classNames({ 'slds-spinner_container': hasContainer, 'slds-spinner_inline': inline }, containerClassName)}>
      <div role="status" className={className || `slds-spinner slds-spinner_${size} slds-spinner_brand`}>
        <span className="slds-assistive-text">Loading</span>
        <div className="slds-spinner__dot-a"></div>
        <div className="slds-spinner__dot-b"></div>
      </div>
    </div>
  );
};

export default Spinner;
