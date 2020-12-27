/** @jsx jsx */
import { jsx, css } from '@emotion/react';
import Tippy from '@tippyjs/react';
import { FunctionComponent, MouseEvent, useState } from 'react';
import { PositionAll } from '@jetstream/types';
import { convertTippyPlacementToSlds } from '@jetstream/shared/ui-utils';

export interface TooltipProps {
  id?: string;
  content: string | JSX.Element;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

export const Tooltip: FunctionComponent<TooltipProps> = ({ id = 'tooltip', content, onClick, children }) => {
  const [nubbinPosition, setNubbinPosition] = useState<PositionAll>();
  const [visible, setVisible] = useState(false);
  return (
    <Tippy
      onHide={() => setVisible(false)}
      onShow={() => content && setVisible(true)}
      hideOnClick={false}
      allowHTML
      render={(attrs) => {
        // NOTE: In addition to the tooltip placement bug, this causes another error with react 16.13
        // Cannot update a component ... while rendering a different component ...
        // setNubbinPosition(convertTippyPlacementToSlds(attrs['data-placement']));
        return (
          visible && (
            <div className="slds-popover slds-popover_tooltip" tabIndex={-1} role="tooltip">
              {/* <span
                className={`slds-nubbin_${nubbinPosition}`}
                css={css`
                  background-color: inherit;
                `}
                data-popper-arrow
              /> */}
              <div className="slds-popover__body">{content}</div>
            </div>
          )
        );
      }}
    >
      <span tabIndex={0} onClick={onClick}>
        {children}
      </span>
    </Tippy>
  );
};

export default Tooltip;
