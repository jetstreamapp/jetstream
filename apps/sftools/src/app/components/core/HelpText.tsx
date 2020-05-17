/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FunctionComponent } from 'react';

export interface HelpTextProps {
  id: string;
}

export const HelpText: FunctionComponent<HelpTextProps> = ({ id, children }) => {
  return (
    <div className="slds-form-element__icon">
      <button className="slds-button slds-button_icon" aria-describedby={id}>
        <svg className="slds-button__icon" aria-hidden="true">
          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#info"></use>
        </svg>
        <span className="slds-assistive-text">Help</span>
      </button>
      <div
        className="slds-popover slds-popover_tooltip slds-nubbin_bottom-left"
        role="tooltip"
        id={id}
        css={css`
          position: absolute;
          /* TODO: fixme - use popper or something */
          top: -45px;
          left: -15px;
          width: 170px;
        `}
      >
        <div className="slds-popover__body">{children}</div>
      </div>
    </div>
  );
};

export default HelpText;
