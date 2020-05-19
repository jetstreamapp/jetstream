/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/icons/
import { jsx } from '@emotion/core';
import actionIcons from '@salesforce-ux/design-system/assets/icons/action-sprite/svg/symbols.svg';
import customIcons from '@salesforce-ux/design-system/assets/icons/custom-sprite/svg/symbols.svg';
import doctypeIcons from '@salesforce-ux/design-system/assets/icons/doctype-sprite/svg/symbols.svg';
import standardIcons from '@salesforce-ux/design-system/assets/icons/standard-sprite/svg/symbols.svg';
import utilityIcons from '@salesforce-ux/design-system/assets/icons/utility-sprite/svg/symbols.svg';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { IconType } from '@silverthorn/types';

export interface IconProps {
  containerClassname?: string; // container classname, only used if not omitted
  className?: string; // SVG element classname
  omitContainer?: boolean;
  title?: string;
  type: IconType;
  icon: string; // TODO: see if we can add some types
  description?: string;
}

function getIconHref(type: IconType, icon: string) {
  const iconSuffix = `#${icon}`;
  switch (type) {
    case 'action':
      return `${actionIcons}${iconSuffix}`;
    case 'custom':
      return `${customIcons}${iconSuffix}`;
    case 'doctype':
      return `${doctypeIcons}${iconSuffix}`;
    case 'standard':
      return `${standardIcons}${iconSuffix}`;
    case 'utility': // INTENTIONAL FALLTHROUGH
    default:
      return `${utilityIcons}${iconSuffix}`;
  }
}

export const Icon: FunctionComponent<IconProps> = ({
  containerClassname,
  className,
  title,
  omitContainer = false,
  type,
  icon,
  description,
}) => {
  containerClassname = containerClassname || '';
  className = className || '';
  const svg = (
    <svg className={classNames(className || 'slds-icon')} aria-hidden="true">
      <use href={getIconHref(type, icon)}></use>
    </svg>
  );
  if (omitContainer) {
    return svg;
  } else {
    return (
      <span className={classNames('slds-icon_container', containerClassname)} title={title}>
        {svg}
        {description && <span className="slds-assistive-text">{description}</span>}
      </span>
    );
  }
};

export default Icon;
// slds-icon slds-icon_small slds-icon-standard-account slds-m-right_small
// slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_x-small slds-icon-custom-custom34
