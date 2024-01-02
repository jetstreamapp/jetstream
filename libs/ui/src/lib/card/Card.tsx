import { css } from '@emotion/react';
import { IconObj } from '@jetstream/icon-factory';
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { forwardRef, ReactNode } from 'react';
import Grid from '../grid/Grid';
import Icon from '../widgets/Icon';

export interface CardProps {
  testId?: string;
  className?: string;
  bodyClassName?: Maybe<string>;
  title?: string | ReactNode;
  icon?: IconObj;
  actions?: ReactNode;
  footer?: ReactNode;
  nestedBorder?: boolean;
  children?: ReactNode;
}

/**
 * This is used when a button is inline on a form where there needs to be top-margin to align with the inputs
 * (e.x. ExpressionConditionRow)
 */
export const Card = forwardRef<HTMLElement, CardProps>(
  ({ testId, className, bodyClassName = 'slds-card__body_inner', title, icon, actions, footer, nestedBorder, children }, ref) => {
    const titleContent = isString(title) ? <span className="slds-truncate">{title}</span> : title;
    return (
      <article data-testid={testId} className={classNames('slds-card', { 'slds-card_boundary': nestedBorder }, className)} ref={ref}>
        {title && (
          <div className="slds-card__header slds-grid">
            <header
              className={classNames('slds-media slds-media_center slds-has-flexi-truncate')}
              css={css`
                flex-wrap: wrap;
              `}
            >
              {icon && (
                <div className="slds-media__figure">
                  <Icon
                    type={icon.type}
                    icon={icon.icon}
                    title={icon.title}
                    description={icon.description}
                    containerClassname={classNames('slds-icon_container', `slds-icon-${icon.type}-${icon.icon.replaceAll('_', '-')}`)}
                    className="slds-icon slds-icon_small"
                  />
                </div>
              )}
              <div
                className="slds-media__body"
                css={css`
                  min-width: fit-content;
                `}
              >
                <h2 className="slds-card__header-title">{titleContent}</h2>
              </div>
              {actions && (
                <Grid
                  wrap
                  css={css`
                    margin-left: auto;
                  `}
                >
                  {actions}
                </Grid>
              )}
            </header>
          </div>
        )}
        <div className={classNames('slds-card__body', bodyClassName)}>{children}</div>
        {footer && <footer className="slds-card__footer">{footer}</footer>}
      </article>
    );
  }
);

export default Card;
