/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FunctionComponent } from 'react';
import { BadgeTypes } from '@silverthorn/types';

export interface BadgeProps {
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

export const Badge: FunctionComponent<BadgeProps> = ({ type = 'default', children }) => {
  return <span className={getCssClass(type)}>{children}</span>;
};

export default Badge;
