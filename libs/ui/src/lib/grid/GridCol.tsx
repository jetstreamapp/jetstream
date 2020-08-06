/** @jsx jsx */
import { jsx } from '@emotion/core';
import { FunctionComponent } from 'react';
import classNames from 'classnames';
import { TopRightBottomLeft } from '@jetstream/types';

const DEFAULT_SIZE = 12;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GridColProps {
  className?: string;
  noFlex?: boolean;
  noSpace?: boolean;
  grow?: boolean;
  growNone?: boolean;
  shrink?: boolean;
  shrinkNone?: boolean;
  bump?: TopRightBottomLeft;
  size?: number;
  maxSize?: number; // defaults to 12
}

function getClassWithModifier(base: string, modifier?: TopRightBottomLeft) {
  if (!modifier) {
    return;
  }
  return `${base}${modifier}`;
}

export const GridCol: FunctionComponent<GridColProps> = ({
  className,
  noFlex,
  noSpace,
  grow,
  growNone,
  shrink,
  shrinkNone,
  bump,
  size,
  maxSize = DEFAULT_SIZE,
  children,
}) => {
  return (
    <div
      className={classNames(
        'slds-col',
        {
          'slds-no-flex': noFlex,
          'slds-no-space': noSpace,
          'slds-grow': grow,
          'slds-grow-none': growNone,
          'slds-shrink': shrink,
          'slds-shrink-none': shrinkNone,
        },
        bump ? getClassWithModifier('slds-col_bump-', bump) : undefined,
        size ? `slds-size_${size}-of-${maxSize}` : undefined,
        className
      )}
    >
      {children}
    </div>
  );
};

export default GridCol;
