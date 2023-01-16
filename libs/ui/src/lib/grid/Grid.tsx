import { FunctionComponent } from 'react';
import classNames from 'classnames';
import { sizeXXXSmallToXXLarge, CenterSpaceSpreadEnd, StartCenterEnd } from '@jetstream/types';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GridProps {
  testId?: string;
  className?: string;
  gutters?: boolean;
  guttersDirect?: boolean;
  guttersSize?: sizeXXXSmallToXXLarge;
  pullPadded?: boolean;
  pullPaddedSize?: sizeXXXSmallToXXLarge;
  align?: CenterSpaceSpreadEnd;
  verticalAlign?: StartCenterEnd;
  vertical?: boolean;
  verticalStretch?: boolean;
  reverse?: boolean;
  wrap?: boolean;
  noWrap?: boolean;
  flexiTruncate?: boolean;
  divProps?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
}

function getClassWithModifier(base: string, modifier?: CenterSpaceSpreadEnd | StartCenterEnd | sizeXXXSmallToXXLarge) {
  if (!modifier) {
    return;
  }
  return `${base}${modifier}`;
}

export const Grid: FunctionComponent<GridProps> = ({
  testId,
  className,
  gutters,
  guttersSize,
  guttersDirect,
  pullPadded,
  pullPaddedSize,
  align,
  verticalAlign,
  vertical,
  verticalStretch,
  reverse,
  wrap,
  noWrap,
  flexiTruncate,
  divProps,
  children,
}) => {
  return (
    <div
      data-testid={testId}
      className={classNames(
        'slds-grid',
        {
          'slds-grid_vertical': vertical,
          'slds-grid_vertical-reverse': vertical && reverse,
          'slds-grid_reverse': !vertical && reverse,
          'slds-wrap': wrap,
          'slds-nowrap': noWrap,
          'slds-gutters': gutters,
          'slds-gutters_direct': guttersDirect,
          'slds-grid_pull-padded': pullPadded,
          'slds-grid_vertical-stretch': verticalStretch,
          'slds-has-flexi-truncate': flexiTruncate,
        },
        gutters && guttersSize ? getClassWithModifier('slds-gutters_', guttersSize) : undefined,
        guttersDirect && guttersSize ? getClassWithModifier('slds-gutters_direct-', guttersSize) : undefined,
        pullPaddedSize ? getClassWithModifier('slds-grid_pull-padded-', pullPaddedSize) : undefined,
        align ? getClassWithModifier('slds-grid_align-', align) : undefined,
        verticalAlign ? getClassWithModifier('slds-grid_vertical-align-', verticalAlign) : undefined,
        className
      )}
      {...divProps}
    >
      {children}
    </div>
  );
};

export default Grid;
