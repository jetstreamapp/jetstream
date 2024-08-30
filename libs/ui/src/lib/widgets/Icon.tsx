import { SerializedStyles } from '@emotion/react';
import { getIcon, IconName, IconType } from '@jetstream/icon-factory';
import classNames from 'classnames';

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
  const svg = getIcon(type, icon, className, svgCss);
  if (omitContainer) {
    return svg;
  } else {
    return (
      <span className={classNames('slds-icon_container', containerClassname)} css={containerCss} title={title || description}>
        {svg}
        {(description || title) && <span className="slds-assistive-text">{description || title}</span>}
      </span>
    );
  }
};

export default Icon;
