//
/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FunctionComponent } from 'react';

const MIN_COL_SIZE = 375;

export const COLUMN_SIZES = {
  third: MIN_COL_SIZE,
  half: MIN_COL_SIZE * 2,
};

export interface ColumnWithMinWidthProps {
  className?: string;
  minWidth?: number;
}

export const ColumnWithMinWidth: FunctionComponent<ColumnWithMinWidthProps> = ({ className, minWidth = COLUMN_SIZES.third, children }) => {
  return (
    <div
      className={`slds-col ${className || ''}`}
      css={css`
        min-width: ${minWidth}px;
      `}
    >
      {children}
    </div>
  );
};

export default ColumnWithMinWidth;
