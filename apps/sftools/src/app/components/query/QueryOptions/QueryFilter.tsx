/** @jsx jsx */
import { FunctionComponent } from 'react';
import { css, jsx } from '@emotion/core';

export interface OrderByProps {
  foo: boolean;
}

export const OrderBy: FunctionComponent<OrderByProps> = ({ foo }) => {
  return <span css={css``}>TODO</span>;
};

export default OrderBy;
