/** @jsx jsx */
import { jsx } from '@emotion/core';
import { FunctionComponent } from 'react';
import NavbarAppLauncher from './NavbarAppLauncher';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NavbarProps {}

export const Navbar: FunctionComponent<NavbarProps> = ({ children }) => {
  return (
    <div className="slds-context-bar">
      <NavbarAppLauncher />
      <nav className="slds-context-bar__secondary" role="navigation">
        <ul className="slds-grid">{children}</ul>
      </nav>
    </div>
  );
};

export default Navbar;
