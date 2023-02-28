import { css } from '@emotion/react';
import { DropDownItem, Maybe, UserProfileUi } from '@jetstream/types';
import Avatar from '@salesforce-ux/design-system/assets/images/profile_avatar_96.png';
import { Fragment, FunctionComponent, ReactNode, Suspense } from 'react';
import DropDown from '../form/dropdown/DropDown';
import Grid from '../grid/Grid';

export interface HeaderProps {
  userProfile: Maybe<UserProfileUi>;
  logo: string | ReactNode;
  orgs?: ReactNode;
  userMenuItems: DropDownItem[];
  rightHandMenuItems?: ReactNode;
  // notification?: ReactNode;
  isElectron?: boolean;
  onUserMenuItemSelected: (id: string) => void;
  children?: React.ReactNode;
}

export const Header: FunctionComponent<HeaderProps> = ({
  userProfile,
  logo,
  orgs,
  rightHandMenuItems,
  userMenuItems,
  isElectron,
  onUserMenuItemSelected,
  children,
}) => {
  if (!isElectron) {
    return (
      <header className="slds-global-header_container branding-header slds-no-print">
        <div className="slds-global-header slds-grid slds-grid_align-spread">
          <HeaderContent
            userProfile={userProfile}
            logo={logo}
            orgs={orgs}
            rightHandMenuItems={rightHandMenuItems}
            userMenuItems={userMenuItems}
            onUserMenuItemSelected={onUserMenuItemSelected}
          />
        </div>
        {children}
      </header>
    );
  }

  return (
    <header className="">
      <div className="global-titlebar draggable">
        <Grid align="spread" verticalAlign="center" className="titlebar draggable">
          <HeaderContent
            userProfile={userProfile}
            logo={logo}
            orgs={orgs}
            rightHandMenuItems={rightHandMenuItems}
            userMenuItems={userMenuItems}
            isElectron={isElectron}
            onUserMenuItemSelected={onUserMenuItemSelected}
          />
        </Grid>
      </div>
      <div className="electron-navbar">{children}</div>
    </header>
  );
};

const HeaderContent: FunctionComponent<Omit<HeaderProps, 'children'>> = ({
  userProfile,
  logo,
  orgs,
  rightHandMenuItems,
  userMenuItems,
  isElectron,
  onUserMenuItemSelected,
}) => {
  return (
    <Fragment>
      {/* LOGO */}
      {isElectron ? (
        <div className="slds-global-header__item draggable">
          <div
            css={css`
              height: 2.5rem;
            `}
            className="draggable"
          >
            {logo}
          </div>
        </div>
      ) : (
        <div className="slds-global-header__item draggable">
          <div className="slds-global-header__logo draggable" style={{ backgroundImage: `url(${logo})` }}></div>
        </div>
      )}
      {/* ORGS */}
      {orgs && (
        <Suspense fallback={<div>Loading...</div>}>
          <div className="slds-global-header__item non-draggable">{orgs}</div>
        </Suspense>
      )}
      {/* RIGHT HAND AREA */}
      <div className="slds-global-header__item draggable">
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
          <li className="slds-global-actions__item non-draggable">
            <div className="slds-dropdown-trigger slds-dropdown-trigger_click">
              <DropDown
                buttonClassName="slds-button slds-global-actions__avatar slds-global-actions__item-action"
                buttonContent={
                  <span className="slds-avatar slds-avatar_circle slds-avatar_medium">
                    <img alt="Avatar" src={userProfile?.picture || Avatar} />
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
    </Fragment>
  );
};

export default Header;
