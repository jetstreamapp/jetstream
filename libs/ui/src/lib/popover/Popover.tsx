/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { convertTippyPlacementToSlds } from '@jetstream/shared/ui-utils';
import { PositionAll } from '@jetstream/types';
import Tippy from '@tippyjs/react';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useState, useEffect } from 'react';
import PopoverContent from './PopoverContent';
import { Placement } from 'tippy.js';

// TODO: use popper to detect nubbin position
// TODO: add PopoverHeader and PopoverFooter components
// https://www.lightningdesignsystem.com/components/popovers
export interface PopoverProps {
  inverseIcons?: boolean;
  containerClassName?: string;
  bodyClassName?: string;
  placement?: Placement;
  content: JSX.Element;
  header?: JSX.Element;
  footer?: JSX.Element;
  onClose?: () => void;
  setVisibleRef?: (setVisible: (visible: boolean) => void) => void;
}

export const Popover: FunctionComponent<PopoverProps> = ({
  inverseIcons,
  containerClassName,
  bodyClassName,
  placement = 'auto',
  content,
  header,
  footer,
  children,
  onClose,
  setVisibleRef,
}) => {
  const [id] = useState<string>(uniqueId('popover'));
  const [visible, setVisible] = useState(false);

  // optionally pass setVisible to parent so that parent can trigger close if required
  useEffect(() => {
    if (setVisibleRef) {
      setVisibleRef(setVisible);
    }
  }, [setVisibleRef]);

  // convertTippyPlacementToSlds
  return (
    <Tippy
      visible={visible}
      placement={placement}
      onClickOutside={() => setVisible(false)}
      interactive={true}
      allowHTML={true}
      onHide={() => onClose && onClose()}
      render={(attrs) => {
        return (
          visible && (
            <PopoverContent
              id={id}
              // nubbinPosition={nubbinPosition}
              inverseIcons={inverseIcons}
              containerClassName={containerClassName}
              bodyClassName={bodyClassName}
              // arrow={
              //   <span
              //     className={`slds-nubbin_${nubbinPosition}`}
              //     css={css`
              //       background-color: inherit;
              //     `}
              //     data-popper-arrow=""
              //   />
              // }
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
