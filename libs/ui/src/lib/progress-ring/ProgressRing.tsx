import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, ReactNode, useState } from 'react';

/**
 * Common classes:
 * slds-progress-ring_{warning} / expired / complete / active-step / large
 */

export interface ProgressRingProps {
  className?: string;
  size?: 'medium' | 'large' | 'x-large';
  fillPercent: number;
  theme?: 'active-step' | 'warning' | 'expired' | 'complete' | null;
  children?: ReactNode;
}

const viewBoxParams = '-1 -1 2 2';
const progressRingRadius = 1;
// Since the viewBox units are set to 2, radii are doubled for shape sizes.
// For a 6px progress head in a 30 px, we use 0.2 units, instead of 0.1
const progressHeadRadius = 6 / 30;
// The radius of the circular path the progress head is plotted on is 21 pixels,
// 24 pixels from the ring, minus 3px for the radius of the progress head
const progressHeadPlotRadius = 21 / 30;

export const ProgressRing: FunctionComponent<ProgressRingProps> = ({ className, size, fillPercent, theme, children }) => {
  const [id] = useState(uniqueId('slds-progress-ring-path-'));

  fillPercent = Math.min(1, Math.max(0, fillPercent)); // ensure we do not go past 100% or below 0%
  const isLong = fillPercent > 0.5 ? 1 : 0;
  const arcX = Math.cos(2 * Math.PI * fillPercent).toFixed(2);
  const arcY = Math.sin(2 * Math.PI * fillPercent).toFixed(2);
  const pathD = `M 1 0 A 1 1 0 ${isLong} 1 ${arcX} ${arcY} L 0 0`;

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
        <svg viewBox={viewBoxParams}>
          {fillPercent >= 1 ? (
            <circle className="slds-progress-ring__path" id={id} cx="0" cy="0" r={progressRingRadius} />
          ) : (
            <path id={id} className="slds-progress-ring__path" d={pathD}></path>
          )}
        </svg>
      </div>
      <div className={classNames('slds-progress-ring__content', { 'slds-text-color_inverse': theme === 'complete' })}>{children}</div>
      {/* The placement of the head was off just a bit, removing for now */}
      {/* {![0, 1].includes(fillPercent) && (
        <div className="slds-progress-ring__progress-head">
          <svg viewBox={viewBoxParams}>
            <circle
              className="slds-progress-ring__path"
              id={id}
              cx={progressHeadPlotRadius * Number(arcX)}
              cy={progressHeadPlotRadius * Number(arcY) * -1}
              r={progressHeadRadius}
            />
          </svg>
        </div>
      )} */}
    </div>
  );
};

export default ProgressRing;
