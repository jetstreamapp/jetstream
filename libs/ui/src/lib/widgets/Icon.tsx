import { IconName, IconType, getIcon } from '@jetstream/icon-factory';
import classNames from 'classnames';

export interface IconProps {
  containerClassname?: string;
  className?: string;
  omitContainer?: boolean;
  title?: string;
  type: IconType;
  icon: IconName;
  description?: string;
}

/**
 * https://www.lightningdesignsystem.com/components/icons/
 */
export const Icon = ({ containerClassname, className, title, omitContainer = false, type, icon, description }: IconProps) => {
  containerClassname = containerClassname || '';
  className = className || '';
  const svg = getIcon(type, icon, className);
  if (omitContainer) {
    return svg;
  } else {
    return (
      <span className={classNames('slds-icon_container', containerClassname)} title={title || description}>
        {svg}
        {(description || title) && <span className="slds-assistive-text">{description || title}</span>}
      </span>
    );
  }
};

export default Icon;
