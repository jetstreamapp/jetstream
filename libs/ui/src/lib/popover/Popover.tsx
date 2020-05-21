/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { convertTippyPlacementToSlds } from '@silverthorn/shared/ui-utils';
import { PositionAll } from '@silverthorn/types';
import Tippy from '@tippyjs/react';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useState } from 'react';
import PopoverContent from './PopoverContent';
import { Placement } from 'tippy.js';

// TODO: use popper to detect nubbin position
// TODO: add PopoverHeader and PopoverFooter components
// https://www.lightningdesignsystem.com/components/popovers
export interface PopoverProps {
  inverseIcons?: boolean;
  containerClassName?: string;
  placement?: Placement;
  content: JSX.Element;
  header?: JSX.Element;
  footer?: JSX.Element;
  onClose?: () => void;
}

export const Popover: FunctionComponent<PopoverProps> = ({
  inverseIcons,
  containerClassName,
  placement = 'auto',
  content,
  header,
  footer,
  children,
  onClose,
}) => {
  const [id] = useState<string>(uniqueId('popover'));
  const [visible, setVisible] = useState(false);
  const [nubbinPosition, setNubbinPosition] = useState<PositionAll>();
  // convertTippyPlacementToSlds
  return (
    <Tippy
      visible={visible}
      placement={placement}
      onClickOutside={() => setVisible(false)}
      interactive
      allowHTML
      onHide={() => onClose && onClose()}
      render={(attrs) => {
        setNubbinPosition(convertTippyPlacementToSlds(attrs['data-placement']));
        return (
          visible && (
            <PopoverContent
              id={id}
              nubbinPosition={nubbinPosition}
              inverseIcons={inverseIcons}
              containerClassName={containerClassName}
              arrow={
                <span
                  className={`slds-nubbin_${nubbinPosition}`}
                  css={css`
                    background-color: inherit;
                  `}
                  data-popper-arrow=""
                />
              }
              header={header}
              footer={footer}
              onClose={() => setVisible(false)}
            >
              {content}
            </PopoverContent>
          )
        );
      }}
    >
      <span
        tabIndex={0}
        onClick={() => setVisible(!visible)}
        css={css`
          cursor: pointer;
        `}
      >
        {children}
      </span>
    </Tippy>
  );
};

export default Popover;
