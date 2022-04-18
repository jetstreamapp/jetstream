import { FunctionComponent } from 'react';

export interface NavbarProps {
  children?: React.ReactNode;
}

export const Navbar: FunctionComponent<NavbarProps> = ({ children }) => {
  return (
    <div className="slds-context-bar">
      <nav className="slds-context-bar__secondary" role="navigation">
        <ul className="slds-grid">{children}</ul>
      </nav>
    </div>
  );
};

export default Navbar;
