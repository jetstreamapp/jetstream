/** @jsx jsx */
import { jsx } from '@emotion/react';
import { getIcon, IconName, IconType } from '@jetstream/icon-factory';
import classNames from 'classnames';
import { FunctionComponent, HTMLAttributes } from 'react';

export interface IconLazyWrapperProps {
  containerClassname?: string; // container classname, only used if not omitted
  className?: string; // SVG element classname
  omitContainer?: boolean;
  title?: string;
  type: IconType;
  icon: IconName; // TODO: see if we can add some types
  description?: string;
  spanProps?: HTMLAttributes<HTMLSpanElement>;
}

export const IconLazyWrapper: FunctionComponent<IconLazyWrapperProps> = ({
  containerClassname,
  className,
  title,
  omitContainer = false,
  type,
  icon,
  description,
  spanProps,
}) => {
  containerClassname = containerClassname || '';
  className = className || '';
  const svg = getIcon(type, icon, className);
  if (omitContainer) {
    return svg;
  } else {
    return (
      <span className={classNames('slds-icon_container', containerClassname)} title={title} {...spanProps}>
        {svg}
        {description && <span className="slds-assistive-text">{description}</span>}
      </span>
    );
  }
};

export default IconLazyWrapper;
