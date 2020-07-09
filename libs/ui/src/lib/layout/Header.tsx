/** @jsx jsx */
import { jsx } from '@emotion/core';
import Avatar from '@salesforce-ux/design-system/assets/images/profile_avatar_96.png';
import { FunctionComponent, ReactNode, Suspense } from 'react';
import { DropDownItem } from '@jetstream/types';
import DropDown from '../form/dropdown/DropDown';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HeaderProps {
  logo: string;
  orgs?: ReactNode;
  userMenuItems: DropDownItem[];
  notification?: ReactNode;
  onUserMenuItemSelected: (id: string) => void;
}

export const Header: FunctionComponent<HeaderProps> = ({ logo, orgs, notification, userMenuItems, onUserMenuItemSelected, children }) => {
  return (
    <header className="slds-global-header_container branding-header slds-no-print">
      <div className="slds-global-header slds-grid slds-grid_align-spread">
        {/* LOGO */}
        <div className="slds-global-header__item">
          <div className="slds-global-header__logo" style={{ backgroundImage: `url(${logo})` }}></div>
        </div>
        {/* ORGS */}
        {orgs && (
          <Suspense fallback={<div>Loading...</div>}>
            <div className="slds-global-header__item">{orgs}</div>
          </Suspense>
        )}
        {/* RIGHT HAND AREA */}
        <div className="slds-global-header__item">
          <ul className="slds-global-actions">
            {notification && <li className="slds-global-actions__item">{notification}</li>}
            <li className="slds-global-actions__item">
              <div className="slds-dropdown-trigger slds-dropdown-trigger_click">
                <DropDown
                  buttonClassName="slds-button slds-global-actions__avatar slds-global-actions__item-action"
                  buttonContent={
                    <span className="slds-avatar slds-avatar_circle slds-avatar_medium">
                      <img alt="Avatar" src={Avatar} />
                    </span>
                  }
                  position="right"
                  actionText="view user options"
                  items={userMenuItems}
                  onSelected={onUserMenuItemSelected}
                />
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
