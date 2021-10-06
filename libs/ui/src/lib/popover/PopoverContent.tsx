import { PositionAll, SmallMediumLargeFullWidth } from '@jetstream/types';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import React, { FunctionComponent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { isEscapeKey } from '@jetstream/shared/ui-utils';
import Icon from '../widgets/Icon';
import { Instance as PopperInstance } from '@popperjs/core';

export interface PopoverContentProps {
  id?: string;
  nubbinPosition?: PositionAll;
  inverseIcons?: boolean;
  size?: SmallMediumLargeFullWidth;
  containerClassName?: string;
  bodyClassName?: string;
  arrow?: JSX.Element;
  header?: JSX.Element;
  footer?: JSX.Element;
  onClose: () => void;
}

export const PopoverContent: FunctionComponent<PopoverContentProps> = ({
  id = uniqueId('popover'),
  nubbinPosition,
  inverseIcons,
  size,
  containerClassName,
  bodyClassName = 'slds-popover__body',
  arrow,
  header,
  footer,
  children,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>();
  // const [nubbin, setNubbin] = useState(nubbinPosition);

  // useEffect(() => {
  //   setNubbin(nubbinPosition);
  // }, [nubbinPosition]);

  // useEffect(() => {
  //   if (nubbinPosition && modalRef.current) {
  //     // TODO: this does not work because it depends on the position of the ref item compared to the base item
  //     if (
  //       nubbinPosition === 'top' &&
  //       popperInstance?.state?.rects &&
  //       modalRef.current.clientWidth > popperInstance?.state?.rects.reference.width
  //     ) {
  //       // 'top-left';
  //       setNubbin('top-left');
  //     }
  //   }
  // }, [nubbinPosition, popperInstance, modalRef]);

  function handleKeyUp(event: KeyboardEvent<HTMLInputElement>) {
    if (isEscapeKey(event)) {
      onClose();
    }
  }

  return (
    <section
      ref={modalRef}
      aria-describedby={id}
      aria-label="Dialog Title"
      className={classNames(
        'slds-popover',
        /** nubbinPosition ? `slds-nubbin_${nubbinPosition}` : '',*/
        nubbinPosition ? `slds-nubbin_${nubbinPosition}` : '',
        containerClassName,
        size ? `slds-popover_${size}` : undefined
      )}
      role="dialog"
      onKeyUp={handleKeyUp}
    >
      <button
        className={classNames('slds-button slds-button_icon slds-button_icon-small slds-float_right slds-popover__close', {
          'slds-button_icon-inverse': inverseIcons,
        })}
        title="Close dialog"
        onClick={() => onClose()}
        autoFocus
      >
        <Icon type="utility" icon="close" className="slds-button__icon" omitContainer />
        <span className="slds-assistive-text">Close dialog</span>
      </button>
      {header}
      <div className={bodyClassName} id={id}>
        {children}
      </div>
      {footer}
    </section>
  );
};

export default PopoverContent;
