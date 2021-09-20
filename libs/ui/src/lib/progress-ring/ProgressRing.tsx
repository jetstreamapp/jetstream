import classNames from 'classnames';
import { FunctionComponent, ReactNode } from 'react';

/**
 * Common classes:
 * slds-progress-ring_{warning} / expired / complete / active-step / large
 */

export interface ProgressRingProps {
  className?: string;
  size?: 'medium' | 'large' | 'x-large';
  fillPercent: number;
  theme?: 'active-step' | 'warning' | 'expired' | 'complete';
  children?: ReactNode;
}

const calculateD = (fillPercent) => {
  const isLong = fillPercent > 0.5 ? 1 : 0;
  const arcX = Math.cos(2 * Math.PI * fillPercent);
  const arcY = Math.sin(2 * Math.PI * fillPercent);

  return getD(isLong, arcX, arcY);
};

const getD = (isLong, arcX, arcY) => `M 1 0 A 1 1 0 ${isLong} 1 ${arcX} ${arcY} L 0 0`;

export const ProgressRing: FunctionComponent<ProgressRingProps> = ({ className, size, fillPercent, theme, children }) => {
  let height = '1.5rem';
  if (size === 'large') {
    height = '2rem';
  } else if (size === 'x-large') {
    height = '3rem';
  }
  const containerDivStyles: React.CSSProperties = { height, width: height };
  const divStyles: React.CSSProperties = { height, transform: 'scaleX(1) rotate(-90deg)' };
  let extraClassNames = '';
  if (theme) {
    extraClassNames = `slds-progress-ring_${theme}`;
  }
  return (
    <div className={classNames('slds-progress-ring', extraClassNames, className)} style={containerDivStyles}>
      <div
        className="slds-progress-ring__progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fillPercent * 100}
        style={divStyles}
      >
        <svg viewBox="-1 -1 2 2">
          <path className="slds-progress-ring__path" d={calculateD(fillPercent)}></path>
        </svg>
      </div>
      <div className={classNames('slds-progress-ring__content', { 'slds-text-color_inverse': theme === 'complete' })}>{children}</div>
    </div>
  );
};

export default ProgressRing;
