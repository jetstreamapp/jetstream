/** @jsx jsx */
import { jsx } from '@emotion/core';
import { FunctionComponent } from 'react';

export interface NavbarAppLauncherProps {
  appName?: string;
}

export const NavbarAppLauncher: FunctionComponent<NavbarAppLauncherProps> = ({ appName }) => {
  return (
    <div className="slds-context-bar__primary">
      <div className="slds-context-bar__item slds-context-bar__dropdown-trigger slds-dropdown-trigger slds-dropdown-trigger_click slds-no-hover">
        <div className="slds-context-bar__icon-action">
          <button className="slds-button slds-icon-waffle_container slds-context-bar__button" title="Open App Launcher">
            <span className="slds-icon-waffle">
              <span className="slds-r1"></span>
              <span className="slds-r2"></span>
              <span className="slds-r3"></span>
              <span className="slds-r4"></span>
              <span className="slds-r5"></span>
              <span className="slds-r6"></span>
              <span className="slds-r7"></span>
              <span className="slds-r8"></span>
              <span className="slds-r9"></span>
            </span>
            <span className="slds-assistive-text">Open App Launcher</span>
          </button>
        </div>
        {appName && (
          <span className="slds-context-bar__label-action slds-context-bar__app-name">
            <span className="slds-truncate" title="App Name">
              {appName}
            </span>
          </span>
        )}
      </div>
    </div>
  );
};

export default NavbarAppLauncher;
