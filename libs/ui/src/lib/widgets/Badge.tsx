import React, { FunctionComponent } from 'react';
import { BadgeTypes } from '@silverthorn/types';

export interface BadgeProps {
  className?: string;
  title?: string;
  type?: BadgeTypes;
}

function getCssClass(type: BadgeTypes) {
  let cssClass = 'slds-badge';
  switch (type) {
    case 'inverse':
      cssClass += ' slds-badge_inverse';
      break;
    case 'light':
      cssClass += ' slds-badge_lightest';
      break;
    case 'success':
      cssClass += ' slds-theme_success';
      break;
    case 'warning':
      cssClass += ' slds-theme_warning';
      break;
    case 'error':
      cssClass += ' slds-theme_error';
      break;
    default:
      break;
  }
  return cssClass;
}

export const Badge: FunctionComponent<BadgeProps> = ({ className, title, type = 'default', children }) => {
  return (
    <span className={`${className || ''} ${getCssClass(type)}`} title={title}>
      {children}
    </span>
  );
};

export default Badge;
