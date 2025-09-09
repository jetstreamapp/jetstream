import { FunctionComponent, HTMLAttributes } from 'react';
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
  sizeSmall?: number;
  maxSizeSmall?: number;
  sizeMedium?: number;
  maxSizeMedium?: number;
  sizeLarge?: number;
  maxSizeLarge?: number;
  extraProps?: HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
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
  sizeSmall,
  maxSizeSmall = DEFAULT_SIZE,
  sizeMedium,
  maxSizeMedium = DEFAULT_SIZE,
  sizeLarge,
  maxSizeLarge = DEFAULT_SIZE,
  extraProps = {},
  children,
}) => {
  return (
    <div
      className={classNames(
        {
          'slds-col': !bump,
          'slds-no-flex': noFlex,
          'slds-no-space': noSpace,
          'slds-grow': grow,
          'slds-grow-none': growNone,
          'slds-shrink': shrink,
          'slds-shrink-none': shrinkNone,
        },
        bump ? getClassWithModifier('slds-col_bump-', bump) : undefined,
        size ? `slds-size_${size}-of-${maxSize}` : undefined,
        sizeSmall ? `slds-small-size_${sizeSmall}-of-${maxSizeSmall}` : undefined,
        sizeMedium ? `slds-medium-size_${sizeMedium}-of-${maxSizeMedium}` : undefined,
        sizeLarge ? `slds-large-size_${sizeLarge}-of-${maxSizeLarge}` : undefined,
        className,
      )}
      {...extraProps}
    >
      {children}
    </div>
  );
};

export default GridCol;
