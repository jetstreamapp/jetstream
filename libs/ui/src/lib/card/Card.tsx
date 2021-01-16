import React, { FunctionComponent, ReactNode } from 'react';
import Icon from '../widgets/Icon';
import { IconObj } from '@jetstream/icon-factory';
import classNames from 'classnames';
import isString from 'lodash/isString';

export interface CardProps {
  className?: string;
  title?: string | ReactNode;
  icon?: IconObj;
  actions?: ReactNode;
  footer?: ReactNode;
}

/**
 * This is used when a button is inline on a form where there needs to be top-margin to align with the inputs
 * (e.x. ExpressionConditionRow)
 */
export const Card: FunctionComponent<CardProps> = ({ className, title, icon, actions, footer, children }) => {
  const titleContent = isString(title) ? <span className="slds-truncate">{title}</span> : title;
  return (
    <article className={classNames('slds-card', className)}>
      {title && (
        <div className="slds-card__header slds-grid">
          <header className={classNames('slds-media slds-media_center slds-has-flexi-truncate')}>
            {icon && (
              <div className="slds-media__figure">
                <Icon
                  type={icon.type}
                  icon={icon.icon}
                  title={icon.title}
                  description={icon.description}
                  containerClassname={classNames('slds-icon_container', `slds-icon-${icon.type}-${icon.icon.replace('_', '-')}`)}
                  className="slds-icon slds-icon_small"
                />
              </div>
            )}
            <div className="slds-media__body">
              <h2 className="slds-card__header-title">{titleContent}</h2>
            </div>
            {actions && actions}
          </header>
        </div>
      )}
      <div className="slds-card__body slds-card__body_inner">{children}</div>
      {footer && <footer className="slds-card__footer">{footer}</footer>}
    </article>
  );
};

export default Card;
