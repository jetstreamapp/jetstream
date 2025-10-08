import classNames from 'classnames';
import { FunctionComponent } from 'react';
import Icon from './Icon';
import Tooltip from './Tooltip';

export interface HelpTextProps {
  /**
   * @deprecated - the aria attributes are computed internally
   */
  id?: string;
  content: string | React.ReactNode;
  className?: string;
}

export const HelpText: FunctionComponent<HelpTextProps> = ({ content, className }) => {
  return (
    <div className={classNames('slds-form-element__icon', className)}>
      <Tooltip content={content}>
        <Icon type="utility" icon="info" className="slds-icon slds-icon-text-default slds-icon_xx-small cursor-pointer" />
        <span className="slds-assistive-text">{content}</span>
      </Tooltip>
    </div>
  );
};

export default HelpText;
