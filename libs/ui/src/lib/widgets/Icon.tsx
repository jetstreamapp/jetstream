/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/icons/
import { jsx } from '@emotion/core';
import { IconName } from '@jetstream/icon-factory';
import { IconType } from '@jetstream/types';
import React, { FunctionComponent, Suspense } from 'react';

const IconLazyWrapper = React.lazy(() => import('./IconLazyWrapper'));

export interface IconProps {
  containerClassname?: string; // container classname, only used if not omitted
  className?: string; // SVG element classname
  omitContainer?: boolean;
  title?: string;
  type: IconType;
  icon: IconName;
  description?: string;
}
/**
 * This component lazy loads the actual icon class to allow code splitting
 * to reduce the size of the main bundle
 */
export const Icon: FunctionComponent<IconProps> = (props) => {
  return (
    <Suspense fallback={<svg />}>
      <IconLazyWrapper {...props} />
    </Suspense>
  );
};

export default Icon;
