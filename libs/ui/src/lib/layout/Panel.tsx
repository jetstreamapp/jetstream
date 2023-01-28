import { css } from '@emotion/react';
import { PositionLeftRight, SizeSmMdLgXlFull } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, useState } from 'react';
import Icon from '../widgets/Icon';

export interface PanelProps {
  containerClassName?: string;
  heading: string;
  isOpen: boolean;
  fullHeight?: boolean;
  position?: PositionLeftRight;
  size?: SizeSmMdLgXlFull;
  showBackArrow?: boolean;
  onClosed: () => void;
  children?: React.ReactNode;
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
  size: userSize = 'md',
  showBackArrow,
  onClosed,
  children,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!isOpen) {
    return null;
  }

  const size: SizeSmMdLgXlFull = expanded ? 'full' : userSize;
  const expandCollapseIcon = expanded ? 'contract_alt' : 'expand_alt';

  return (
    <div
      className={containerClassName}
      css={css`
        z-index: 2;
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

          <button className="slds-button slds-button_icon slds-button_icon-small" onClick={() => setExpanded(!expanded)}>
            <Icon type="utility" icon={expandCollapseIcon} className="slds-button__icon" />
          </button>
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
  );
};

export default Panel;
