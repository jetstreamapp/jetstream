import { SerializedStyles } from '@emotion/react';
import { BadgeType } from '@jetstream/types';
import { FunctionComponent, HTMLAttributes, ReactNode } from 'react';

export interface BadgeProps {
  className?: string;
  title?: string;
  type?: BadgeType;
  spanProps?: HTMLAttributes<HTMLSpanElement>;
  css?: SerializedStyles;
  children?: ReactNode;
}

function getCssClass(type: BadgeType) {
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

export const Badge: FunctionComponent<BadgeProps> = ({ className, title, type = 'default', spanProps, css, children }) => {
  return (
    <span className={`${className || ''} ${getCssClass(type)}`} title={title} css={css} {...spanProps}>
      {children}
    </span>
  );
};

export default Badge;
