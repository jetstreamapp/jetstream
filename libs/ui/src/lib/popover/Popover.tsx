import { css } from '@emotion/react';
import Tippy, { TippyProps } from '@tippyjs/react';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useState, useEffect, Fragment } from 'react';
import PopoverContent from './PopoverContent';
import { Placement, Instance as TippyInstance } from 'tippy.js';
import isBoolean from 'lodash/isBoolean';
import { PositionAll, SmallMediumLargeFullWidth } from '@jetstream/types';
import './popover-arrow.css';
import { Instance as PopperInstance } from '@popperjs/core';

function placementToNubbin(placement: Placement, popperInstance: PopperInstance): PositionAll {
  switch (placement) {
    case 'top':
      return 'bottom';
    case 'bottom':
      // TODO: this is example of they type of thing we need to d0
      // TODO: but we need to figure out offsets / positions instead of just worrying about width
      if (popperInstance?.state?.rects && popperInstance?.state?.rects.popper.width > popperInstance?.state?.rects.reference.width) {
        return 'top-left';
      }
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

// function placementToOffset({ rects }: PopperState) {
//   /**
//    * TODO:
//    * just testing this out, still need to figure shit out
//    */
//   if (rects.popper.width > rects.reference.width) {
//   }
// }

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
  const [nubbinPosition, setNubbinPosition] = useState<PositionAll>();

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

  function handleMount(tippyInstance: TippyInstance) {
    if (tippyInstance) {
      console.log(tippyInstance);
      setNubbinPosition(placementToNubbin(tippyInstance.popperInstance.state.placement, tippyInstance.popperInstance));
    }
  }

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
      // onAfterUpdate={(props) => console.log('onAfterUpdate', props)}
      onMount={handleMount}
      render={(attrs, foo, tippy) => {
        // console.log(foo);
        // console.log(tippy.popperInstance);
        // console.log(attrs['data-placement']);
        return (
          visible && (
            <PopoverContent
              {...attrs}
              id={id}
              // nubbinPosition={placementToNubbin(attrs['data-placement'], tippy.popperInstance)}
              nubbinPosition={nubbinPosition}
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
