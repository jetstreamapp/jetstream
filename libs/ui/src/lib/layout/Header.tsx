import { UserButton } from '@clerk/clerk-react';
import { IconName, IconType } from '@jetstream/icon-factory';
import { DropDownItem, Maybe, UserProfileUi } from '@jetstream/types';
import { Fragment, FunctionComponent, ReactNode, Suspense } from 'react';
import Icon from '../widgets/Icon';

export interface HeaderProps {
  userProfile: Maybe<UserProfileUi>;
  logo: string | ReactNode;
  orgs?: ReactNode;
  userMenuItems: DropDownItem[];
  accountPages?: {
    label: string;
    url: string;
    icon: {
      type: string;
      icon: string;
      description?: string;
    };
    content: ReactNode;
  }[];
  rightHandMenuItems?: ReactNode;
  // notification?: ReactNode;
  isChromeExtension?: boolean;
  onUserMenuItemSelected: (id: string) => void;
  children?: React.ReactNode;
}

export const Header: FunctionComponent<HeaderProps> = ({
  userProfile,
  logo,
  orgs,
  rightHandMenuItems,
  userMenuItems,
  accountPages = [],
  isChromeExtension,
  onUserMenuItemSelected,
  children,
}) => {
  return (
    <header className="slds-global-header_container branding-header slds-no-print">
      <div className="slds-global-header slds-grid slds-grid_align-spread">
        <HeaderContent
          userProfile={userProfile}
          logo={logo}
          orgs={orgs}
          rightHandMenuItems={rightHandMenuItems}
          userMenuItems={userMenuItems}
          accountPages={accountPages}
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
  orgs,
  rightHandMenuItems,
  userMenuItems,
  accountPages,
  isChromeExtension,
  onUserMenuItemSelected,
}) => {
  return (
    <Fragment>
      {/* LOGO */}
      <div className="slds-global-header__item draggable">
        <div className="slds-global-header__logo draggable" style={{ backgroundImage: `url(${logo})` }}></div>
      </div>
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
          {!isChromeExtension && (
            <li className="slds-global-actions__item non-draggable">
              <div className="slds-dropdown-trigger slds-dropdown-trigger_click">
                <UserButton>
                  <UserButton.MenuItems>
                    {userMenuItems.map(({ id, value, title, icon }, i) => (
                      <UserButton.Action
                        key={id}
                        label={String(value)}
                        onClick={() => onUserMenuItemSelected(id)}
                        labelIcon={
                          <Icon
                            type={icon!.type as IconType}
                            icon={icon!.icon as IconName}
                            description={icon!.description}
                            omitContainer
                            className="slds-icon slds-icon_xx-small slds-icon-text-default"
                          />
                        }
                      />
                    ))}
                    <UserButton.Action label="signOut" />
                  </UserButton.MenuItems>
                  {accountPages?.map(({ content, icon, label, url }) => (
                    <UserButton.UserProfilePage
                      key={label}
                      label={label}
                      url={url}
                      labelIcon={
                        <Icon
                          type={icon.type as IconType}
                          icon={icon.icon as IconName}
                          description={icon.description}
                          omitContainer
                          className="slds-icon slds-icon_xx-small slds-icon-text-default"
                        />
                      }
                    >
                      {content}
                    </UserButton.UserProfilePage>
                  ))}
                </UserButton>
              </div>
            </li>
          )}
        </ul>
      </div>
    </Fragment>
  );
};

export default Header;
