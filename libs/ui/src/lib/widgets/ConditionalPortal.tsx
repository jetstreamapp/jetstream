import { Maybe } from '@jetstream/types';
import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const ConditionalPortal = ({
  usePortal,
  portalRef,
  children,
}: {
  usePortal: boolean;
  portalRef?: Maybe<Element>;
  children: ReactNode;
}) => {
  if (!usePortal) {
    return children;
  }
  return createPortal(children as any, portalRef || document.body) as ReactNode;
};
