import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';

export interface ProgressIndicatorProps {
  className?: string;
  currentValue: number;
  isIndeterminate?: boolean;
}

export const ProgressIndicator = ({ className, currentValue: _currentValue, isIndeterminate }: ProgressIndicatorProps) => {
  const currValueRef = useRef(_currentValue);
  currValueRef.current = _currentValue;
  const [currentValue, setCurrentValue] = useState(() => (isIndeterminate ? 0 : _currentValue));
  const isIncreasingRef = useRef(true);

  useEffect(() => {
    // If completed (100%), show as complete regardless of isIndeterminate
    if (currValueRef.current === 100) {
      setCurrentValue(100);
      return;
    }

    // Animate between 0 and 100 when indeterminate
    if (isIndeterminate) {
      const interval = setInterval(() => {
        setCurrentValue((prev) => {
          if (prev >= 100) {
            isIncreasingRef.current = false;
            return 99;
          } else if (prev <= 0) {
            isIncreasingRef.current = true;
            return 1;
          }
          return isIncreasingRef.current ? prev + 1 : prev - 1;
        });
      }, 20);

      return () => clearInterval(interval);
    } else {
      // Not indeterminate, use the passed in value
      setCurrentValue(currValueRef.current);
    }
  }, [isIndeterminate, _currentValue]);

  // Calculate width and margin for indeterminate animation
  const isAnimating = isIndeterminate && _currentValue !== 100;
  const width = isAnimating ? Math.min(currentValue, 50) : currentValue;
  const marginLeft = isAnimating ? Math.max(0, currentValue - 50) : 0;

  return (
    <div
      className={classNames('slds-progress-bar slds-progress-bar_small', className)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={currentValue}
      role="progressbar"
    >
      <span className="slds-progress-bar__value" style={{ width: `${width}%`, marginLeft: `${marginLeft}%` }}>
        <span className="slds-assistive-text">{currentValue}% Complete</span>
      </span>
    </div>
  );
};
