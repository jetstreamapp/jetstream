import { css } from '@emotion/react';
import { FunctionComponent } from 'react';
import Icon from './Icon';
import Tooltip from './Tooltip';
import classNames from 'classnames';

export interface HelpTextProps {
  id: string;
  content: string | JSX.Element;
  className?: string;
}

export const HelpText: FunctionComponent<HelpTextProps> = ({ id, content, className }) => {
  return (
    <div className={classNames('slds-form-element__icon', className)}>
      <Tooltip id={id} content={content}>
        <Icon type="utility" icon="info" className="slds-icon slds-icon-text-default slds-icon_xx-small cursor-pointer" />
        <span className="slds-assistive-text">{content}</span>
      </Tooltip>
    </div>
  );
};

export default HelpText;
