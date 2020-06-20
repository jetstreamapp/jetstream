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
        <Icon
          type="utility"
          icon="info"
          className="slds-icon slds-icon-text-default slds-icon_xx-small"
          css={css`
            cursor: pointer;
          `}
        />
        <span className="slds-assistive-text">{content}</span>
      </Tooltip>
    </div>
  );
};

export default HelpText;
