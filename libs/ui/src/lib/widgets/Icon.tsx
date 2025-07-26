import { SerializedStyles } from '@emotion/react';
import { getIcon, IconName, IconType } from '@jetstream/icon-factory';
import classNames from 'classnames';
import { cloneElement } from 'react';

export interface IconProps {
  containerClassname?: string;
  className?: string;
  omitContainer?: boolean;
  containerCss?: SerializedStyles;
  svgCss?: SerializedStyles;
  title?: string;
  type: IconType;
  icon: IconName;
  description?: string;
}

/**
 * https://www.lightningdesignsystem.com/components/icons/
 */
export const Icon = ({
  containerClassname,
  className,
  title,
  omitContainer = false,
  type,
  icon,
  description,
  containerCss,
  svgCss,
}: IconProps) => {
  containerClassname = containerClassname || '';
  className = className || '';
  const ariaLabel = description || title || undefined;
  let svgElement = getIcon(type, icon, className, svgCss);

  // If svgElement is a React element, clone it to add aria-label if needed
  if (omitContainer && ariaLabel && svgElement && typeof svgElement === 'object' && 'type' in svgElement) {
    svgElement = cloneElement(svgElement, { 'aria-label': ariaLabel });
  }

  if (omitContainer) {
    return svgElement;
  } else {
    return (
      <span className={classNames('slds-icon_container', containerClassname)} css={containerCss} title={title || description}>
        {svgElement}
        {(description || title) && <span className="slds-assistive-text">{description || title}</span>}
      </span>
    );
  }
};

export default Icon;
