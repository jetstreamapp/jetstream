/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FunctionComponent } from 'react';
import Icon from './Icon';
import Tooltip from './Tooltip';

export interface HelpTextProps {
  id: string;
  content: string | JSX.Element;
}

export const HelpText: FunctionComponent<HelpTextProps> = ({ id, content, children }) => {
  return (
    <div className="slds-form-element__icon">
      <Tooltip id={id} content={content}>
        <button className="slds-button slds-button_icon" aria-describedby={id}>
          <Icon type="utility" icon="info" className="slds-button__icon" omitContainer={true} />
          <span className="slds-assistive-text">Help</span>
        </button>
      </Tooltip>
    </div>
  );
};

export default HelpText;
