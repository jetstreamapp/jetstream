import { css, SerializedStyles } from '@emotion/react';
import { DropDownItem, Maybe, UserProfileUi } from '@jetstream/types';
import Avatar from '@salesforce-ux/design-system/assets/images/profile_avatar_96.png';
import { Fragment, FunctionComponent, ReactNode, Suspense, useState } from 'react';
import DropDown from '../form/dropdown/DropDown';
import WindowsMenuBar from './WindowsMenuBar';

export interface HeaderProps {
  userProfile: Maybe<UserProfileUi>;
  logo: string | ReactNode;
  logoCss?: SerializedStyles;
  orgs?: ReactNode;
  userMenuItems: DropDownItem[];
  rightHandMenuItems?: ReactNode;
  // notification?: ReactNode;
  isChromeExtension?: boolean;
  isDesktop?: boolean;
  onUserMenuItemSelected: (id: string) => void;
  onMenuAction?: (action: string) => void;
  children?: React.ReactNode;
}

export const Header: FunctionComponent<HeaderProps> = ({
  userProfile,
  logo,
  logoCss,
  orgs,
  rightHandMenuItems,
  userMenuItems,
  isChromeExtension,
  isDesktop,
  onUserMenuItemSelected,
  onMenuAction,
  children,
}) => {
  const isWindowsDesktop = isDesktop && typeof window !== 'undefined' && !navigator.userAgent.toLowerCase().includes('mac');

  return (
    <header className="slds-global-header_container branding-header slds-no-print">
      <div className="slds-global-header slds-grid slds-grid_align-spread">
        {isWindowsDesktop && onMenuAction && <WindowsMenuBar onMenuAction={onMenuAction} />}
        <HeaderContent
          userProfile={userProfile}
          logo={logo}
          logoCss={logoCss}
          orgs={orgs}
          rightHandMenuItems={rightHandMenuItems}
          userMenuItems={userMenuItems}
          isChromeExtension={isChromeExtension}
          onUserMenuItemSelected={onUserMenuItemSelected}
        />
      </div>
      {children}
    </header>
  );
};

const HeaderContent: FunctionComponent<Omit<HeaderProps, 'children'>> = ({
  userProfile,
  logo,
  logoCss,
  orgs,
  rightHandMenuItems,
  userMenuItems,
  isChromeExtension,
  onUserMenuItemSelected,
}) => {
  const [avatarSrc, setAvatarSrc] = useState(userProfile?.picture || Avatar);

  return (
    <Fragment>
      {/* LOGO */}
      <div
        className="slds-global-header__item non-draggable"
        css={css`
          padding: 0 0.25rem;
          -webkit-app-region: no-drag;
        `}
      >
        <div
          css={css`
            width: 10.7rem;
            -webkit-app-region: drag;
            ${logoCss}
          `}
          className="slds-global-header__logo"
          style={{ backgroundImage: `url(${logo})` }}
        ></div>
      </div>
      {/* ORGS */}
      {orgs && (
        <Suspense fallback={<div>Loading...</div>}>
          <div
            className="slds-global-header__item non-draggable"
            css={css`
              padding: 0 0.25rem;
              -webkit-app-region: no-drag;
            `}
          >
            {orgs}
          </div>
        </Suspense>
      )}
      {/* RIGHT HAND AREA */}
      <div
        className="slds-global-header__item non-draggable"
        css={css`
          padding: 0 0.25rem;
          -webkit-app-region: no-drag;
        `}
      >
        <ul className="slds-global-actions non-draggable">
          {rightHandMenuItems && Array.isArray(rightHandMenuItems) ? (
            rightHandMenuItems.map((item, i) => (
              <li key={i} className="slds-global-actions__item">
                {item}
              </li>
            ))
          ) : (
            <li className="slds-global-actions__item non-draggable">{rightHandMenuItems}</li>
          )}
          {!isChromeExtension && (
            <li
              className="slds-global-actions__item non-draggable"
              css={css`
                padding: 0 0.25rem;
              `}
            >
              <div className="slds-dropdown-trigger slds-dropdown-trigger_click">
                <DropDown
                  buttonClassName="slds-button slds-global-actions__avatar slds-global-actions__item-action"
                  buttonContent={
                    <span className="slds-avatar slds-avatar_circle slds-avatar_medium">
                      <img loading="lazy" alt="Avatar" src={avatarSrc} onError={() => setAvatarSrc(Avatar)} />
                    </span>
                  }
                  position="right"
                  actionText="view user options"
                  items={userMenuItems}
                  onSelected={onUserMenuItemSelected}
                />
              </div>
            </li>
          )}
        </ul>
      </div>
    </Fragment>
  );
};

export default Header;
