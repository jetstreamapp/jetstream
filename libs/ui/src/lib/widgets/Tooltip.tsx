/** @jsx jsx */
import { jsx } from '@emotion/core';
import Tippy from '@tippyjs/react';
import { FunctionComponent } from 'react';

export interface TooltipProps {
  id?: string;
  content: string | JSX.Element;
}

export const Tooltip: FunctionComponent<TooltipProps> = ({ id = 'tooltip', content, children }) => {
  return (
    <Tippy
      // TODO: figure out proper placement for the nubbins and figure out how to dynamically set
      // onBeforeUpdate={(instance, props) => console.log('onBeforeUpdate', { instance, props })}
      // onShow={(instance) => console.log('onShow', { instance })}
      // onShown={(instance) => console.log('onShown', { instance })}
      // onHide={(instance) => console.log('onHide', { instance })}
      // onHidden={(instance) => console.log('onHidden', { instance })}
      // onTrigger={(instance) => console.log('onTrigger', { instance })}
      content={
        <div className="slds-popover slds-popover_tooltip" tabIndex={-1} role="tooltip">
          <div className="slds-popover__body">{content}</div>
        </div>
      }
    >
      <span tabIndex={0}>{children}</span>
    </Tippy>
  );
};

export default Tooltip;
