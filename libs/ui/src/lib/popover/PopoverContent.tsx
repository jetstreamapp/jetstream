import { PositionAll } from '@silverthorn/types';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import React, { FunctionComponent } from 'react';
import Icon from '../widgets/Icon';

export interface PopoverContentProps {
  id?: string;
  nubbinPosition?: PositionAll;
  inverseIcons?: boolean;
  containerClassName?: string;
  arrow?: JSX.Element;
  header?: JSX.Element;
  footer?: JSX.Element;
  onClose: () => void;
}

export const PopoverContent: FunctionComponent<PopoverContentProps> = ({
  id = uniqueId('popover'),
  nubbinPosition,
  inverseIcons,
  containerClassName,
  arrow,
  header,
  footer,
  children,
  onClose,
}) => {
  return (
    <section
      aria-describedby={id}
      aria-label="Dialog Title"
      className={classNames('slds-popover', /** nubbinPosition ? `slds-nubbin_${nubbinPosition}` : '',*/ containerClassName)}
      role="dialog"
    >
      {arrow}
      <button
        className={classNames('slds-button slds-button_icon slds-button_icon-small slds-float_right slds-popover__close', {
          'slds-button_icon-inverse': inverseIcons,
        })}
        title="Close dialog"
        onClick={() => onClose()}
      >
        <Icon type="utility" icon="close" className="slds-button__icon" omitContainer={true} />
        <span className="slds-assistive-text">Close dialog</span>
      </button>
      {header}
      <div className="slds-popover__body" id={id}>
        {children}
      </div>
      {footer}
    </section>
  );
};

export default PopoverContent;
