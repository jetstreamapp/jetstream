/** @jsx jsx */
import { jsx, css } from '@emotion/core';
import Tippy from '@tippyjs/react';
import { FunctionComponent, useState } from 'react';
import { PositionAll } from '@silverthorn/types';
import { convertTippyPlacementToSlds } from '@silverthorn/shared/ui-utils';

export interface TooltipProps {
  id?: string;
  content: string | JSX.Element;
}

export const Tooltip: FunctionComponent<TooltipProps> = ({ id = 'tooltip', content, children }) => {
  const [nubbinPosition, setNubbinPosition] = useState<PositionAll>();
  const [visible, setVisible] = useState(false);
  return (
    <Tippy
      onHide={() => setVisible(false)}
      onShow={() => setVisible(true)}
      allowHTML
      render={(attrs) => {
        setNubbinPosition(convertTippyPlacementToSlds(attrs['data-placement']));
        return (
          visible && (
            <div className="slds-popover slds-popover_tooltip" tabIndex={-1} role="tooltip">
              <span
                className={`slds-nubbin_${nubbinPosition}`}
                css={css`
                  background-color: inherit;
                `}
                data-popper-arrow=""
              />
              <div className="slds-popover__body">{content}</div>
            </div>
          )
        );
      }}
    >
      <span tabIndex={0}>{children}</span>
    </Tippy>
  );
};

export default Tooltip;
