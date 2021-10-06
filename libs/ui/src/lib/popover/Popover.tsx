import { css } from '@emotion/react';
import Tippy, { TippyProps } from '@tippyjs/react';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useState, useEffect } from 'react';
import PopoverContent from './PopoverContent';
import { Placement } from 'tippy.js';
import isBoolean from 'lodash/isBoolean';
import { PositionAll, SmallMediumLargeFullWidth } from '@jetstream/types';

function placementToNubbin(placement: Placement): PositionAll {
  switch (placement) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'right':
      return 'left';
    case 'left':
      return 'right';
    case 'top-start':
      return 'bottom-left';
    case 'top-end':
      return 'bottom-right';
    case 'bottom-start':
      return 'top-left';
    case 'bottom-end':
      return 'top-right';
    case 'right-start':
      return 'left-top';
    case 'right-end':
      return 'left-bottom';
    case 'left-start':
      return 'right-top';
    case 'left-end':
      return 'right-bottom';
    default:
      break;
  }
}

function placementToOffset(placement: Placement) {
  /**
   * TODO:
   * we need to set left/right/top/bottom CSS style offset
   * but only for some (mostly bottom) because the arrow overlaps in these cases
   */
}

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
  size?: SmallMediumLargeFullWidth;
  tippyProps?: TippyProps;
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
  size,
  tippyProps = {},
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
      appendTo="parent"
      interactive
      allowHTML
      onShow={() => onOpen && onOpen()}
      onHide={() => onClose && onClose()}
      render={(attrs, foo, tippy) => {
        console.log(tippy);
        console.log(attrs['data-placement']);
        return (
          visible && (
            <PopoverContent
              id={id}
              nubbinPosition={placementToNubbin(attrs['data-placement'])}
              inverseIcons={inverseIcons}
              size={size}
              containerClassName={containerClassName}
              bodyClassName={bodyClassName}
              // arrow={
              //   <span
              //     className={`slds-nubbin_${attrs['data-placement']}`}
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
      {...tippyProps}
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
