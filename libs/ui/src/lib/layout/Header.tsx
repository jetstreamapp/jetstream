/** @jsx jsx */
import { jsx } from '@emotion/core';
import Avatar from '@salesforce-ux/design-system/assets/images/profile_avatar_96.png';
import { FunctionComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HeaderProps {
  logo: string;
}

export const Header: FunctionComponent<HeaderProps> = ({ logo, children }) => {
  return (
    <header className="slds-global-header_container branding-header slds-no-print">
      <div className="slds-global-header slds-grid slds-grid_align-spread">
        {/* LOGO */}
        <div className="slds-global-header__item">
          <div className="slds-global-header__logo" style={{ backgroundImage: `url(${logo})` }}></div>
        </div>
        {/* RIGHT HAND AREA */}
        <div className="slds-global-header__item">
          <ul className="slds-global-actions">
            <li className="slds-global-actions__item">
              <div className="slds-dropdown-trigger slds-dropdown-trigger_click">
                <button
                  className="slds-button slds-global-actions__avatar slds-global-actions__item-action"
                  title="person name"
                  aria-haspopup="true"
                >
                  <span className="slds-avatar slds-avatar_circle slds-avatar_medium">
                    <img alt="Avatar" src={Avatar} />
                  </span>
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>
      {children}
    </header>
  );
};

export default Header;
