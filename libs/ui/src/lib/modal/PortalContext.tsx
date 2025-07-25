import { Maybe } from '@jetstream/types';
import { createContext, ReactNode, useContext } from 'react';

interface PortalContextValue {
  isInPortal: boolean;
  portalRoot?: Maybe<HTMLElement>;
}

const PortalContext = createContext<PortalContextValue>({ isInPortal: false });

export const usePortalContext = () => useContext(PortalContext);

/**
 * Used to detect if we are in a portal and to provide easy access to the portal root element.
 * This is useful for components that need to render in a specific portal context or have different behavior in an existing portal.
 */
export const PortalProvider = ({ children, portalRoot }: { children: ReactNode; portalRoot?: Maybe<HTMLElement> }) => (
  <PortalContext.Provider value={{ isInPortal: true, portalRoot }}>{children}</PortalContext.Provider>
);
