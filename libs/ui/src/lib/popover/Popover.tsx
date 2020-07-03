/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import Tippy from '@tippyjs/react';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useState, useEffect } from 'react';
import PopoverContent from './PopoverContent';
import { Placement } from 'tippy.js';
import { isBoolean } from 'lodash';

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
  isOpen?: boolean; // only used if parent wants to have control over this state
  onOpen?: () => void;
  onClose?: () => void;
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
  isOpen,
  onOpen,
  onClose,
}) => {
  const [id] = useState<string>(uniqueId('popover'));
  const [visible, setVisible] = useState(isOpen || false);

  useEffect(() => {
    if (isBoolean(isOpen) && visible !== isOpen) {
      setVisible(isOpen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (visible && onOpen) {
      onOpen();
    } else if (!visible && onClose) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // convertTippyPlacementToSlds
  return (
    <Tippy
      visible={visible}
      placement={placement}
      onClickOutside={() => setVisible(false)}
      interactive={true}
      allowHTML={true}
      onShow={() => onOpen && onOpen()}
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
