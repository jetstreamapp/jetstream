/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FunctionComponent, Fragment } from 'react';
import classNames from 'classnames';
import Icon from './Icon';
import { SizeSmMdLgXlFull, PositionLeftRight } from '../../types/types';

export interface PanelProps {
  containerClassName?: string;
  heading: string;
  isOpen: boolean;
  fullHeight?: boolean;
  position?: PositionLeftRight;
  size?: SizeSmMdLgXlFull;
  showBackArrow?: boolean;
  onClosed: () => void;
}

function getPositionClass(position: PositionLeftRight) {
  switch (position) {
    case 'left':
      return 'slds-panel_docked-left';
    case 'right':
      return 'slds-panel_docked-right';
    default:
      return 'slds-panel_docked-left';
  }
}

function getSizeClass(size: SizeSmMdLgXlFull) {
  switch (size) {
    case 'sm':
      return 'slds-size_small';
    case 'md':
      return 'slds-size_medium';
    case 'lg':
      return 'slds-size_large';
    case 'xl':
      return 'slds-size_x-large';
    case 'full':
      return 'slds-size_full';
    default:
      return 'slds-size_medium';
  }
}

export const Panel: FunctionComponent<PanelProps> = ({
  containerClassName,
  heading,
  isOpen,
  fullHeight = true,
  position = 'left',
  size = 'md',
  showBackArrow,
  onClosed,
  children,
}) => {
  return (
    <Fragment>
      {isOpen && (
        <div
          className={containerClassName}
          css={css`
            z-index: 9000;
            ${fullHeight ? 'position: absolute; height: 100vh; top: 0;' : ''}
            ${position === 'left' ? 'left: 0' : 'right: 0'};
          `}
        >
          <div
            className={classNames('slds-panel slds-panel_docked slds-is-open', getPositionClass(position), getSizeClass(size))}
            aria-hidden="false"
          >
            <div className="slds-panel__header">
              {showBackArrow && (
                <button
                  className="slds-button slds-button_icon slds-button_icon-small slds-panel__back"
                  title={`Collapse ${heading}`}
                  onClick={() => onClosed()}
                >
                  <Icon type="utility" icon="back" className="slds-button__icon" />
                  <span className="slds-assistive-text">Collapse {heading}</span>
                </button>
              )}
              <h2 className="slds-panel__header-title slds-text-heading_small slds-truncate" title={heading}>
                {heading}
              </h2>
              <button
                className="slds-button slds-button_icon slds-button_icon-small slds-panel__close"
                title={`Collapse ${heading}`}
                onClick={() => onClosed()}
              >
                <Icon type="utility" icon="close" className="slds-button__icon" />
                <span className="slds-assistive-text">Collapse {heading}</span>
              </button>
            </div>
            <div className="slds-panel__body">{children}</div>
          </div>
        </div>
      )}
    </Fragment>
  );
};

export default Panel;
