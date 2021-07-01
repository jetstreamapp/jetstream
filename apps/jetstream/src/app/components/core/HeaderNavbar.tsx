/** @jsx jsx */
import { jsx } from '@emotion/react';
import { FEATURE_FLAGS } from '@jetstream/shared/constants';
import { hasFeatureFlagAccess } from '@jetstream/shared/ui-utils';
import { DropDownItem, UserProfileUi } from '@jetstream/types';
import { Header, Icon, Navbar, NavbarItem, NavbarMenuItems } from '@jetstream/ui';
import NotificationsRequestModal from 'apps/jetstream/src/app/components/core/NotificationsRequestModal';
import { Fragment, FunctionComponent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import Logo from '../../../assets/images/jetstream-logo-v1-200w.png';
import { applicationCookieState, selectUserPreferenceState } from '../../app-state';
import OrgsDropdown from '../orgs/OrgsDropdown';
import Jobs from './jobs/Jobs';

export interface HeaderNavbarProps {
  userProfile: UserProfileUi;
  featureFlags: Set<string>;
}

function logout(serverUrl: string) {
  const logoutUrl = `${serverUrl}/oauth/logout`;
  // eslint-disable-next-line no-restricted-globals
  location.href = logoutUrl;
}

function getMenuItems(userProfile: UserProfileUi, deniedNotifications?: boolean) {
  const menu: DropDownItem[] = [
    { id: 'nav-user-logout', value: 'Logout', subheader: userProfile?.email, icon: { type: 'utility', icon: 'logout' } },
  ];
  if (deniedNotifications && window.Notification && window.Notification.permission === 'default') {
    menu.unshift({
      id: 'enable-notifications',
      value: 'Enable Notifications',
      subheader: 'Notifications',
      icon: { type: 'utility', icon: 'notification' },
    });
  }
  return menu;
}

export const HeaderNavbar: FunctionComponent<HeaderNavbarProps> = ({ userProfile, featureFlags }) => {
  const [applicationState] = useRecoilState(applicationCookieState);
  const { deniedNotifications } = useRecoilValue(selectUserPreferenceState);
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [userMenuItems, setUserMenuItems] = useState<DropDownItem[]>(getMenuItems(userProfile, deniedNotifications));

  function handleUserMenuSelection(id: string) {
    switch (id) {
      case 'nav-user-logout':
        logout(applicationState.serverUrl);
        break;
      case 'enable-notifications':
        setEnableNotifications(true);
        break;
      default:
        break;
    }
  }

  function handleNotificationMenuClosed(isEnabled: boolean) {
    setEnableNotifications(false);
    setUserMenuItems(getMenuItems(userProfile, !isEnabled));
  }

  return (
    <Fragment>
      {enableNotifications && <NotificationsRequestModal userInitiated onClose={handleNotificationMenuClosed} />}
      <Header
        logo={Logo}
        orgs={<OrgsDropdown />}
        userMenuItems={userMenuItems}
        rightHandMenuItems={[
          <Link
            className="slds-button slds-button_icon slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__help slds-global-actions__item-action"
            to="/feedback"
            target="_blank"
          >
            <Icon type="utility" icon="help" className="slds-button__icon slds-global-header__icon" omitContainer />
          </Link>,
          <Jobs />,
        ]}
        onUserMenuItemSelected={handleUserMenuSelection}
      >
        <Navbar>
          {/* TODO: home page - also pass this in from app instead if possible */}
          {/* <NavbarItem path="/" title="Home" label="Home" /> */}
          {hasFeatureFlagAccess(featureFlags, FEATURE_FLAGS.QUERY) && (
            <NavbarItem path="/query" title="Query Records" label="Query Records" />
          )}
          {hasFeatureFlagAccess(featureFlags, FEATURE_FLAGS.LOAD) && <NavbarItem path="/load" title="Load Records" label="Load Records" />}
          {hasFeatureFlagAccess(featureFlags, FEATURE_FLAGS.AUTOMATION_CONTROL) && (
            <Fragment>
              <NavbarItem path="/automation-control" title="Automation Control" label="Automation Control" />
            </Fragment>
          )}
          {hasFeatureFlagAccess(featureFlags, FEATURE_FLAGS.PERMISSION_MANAGER) && (
            <NavbarItem path="/permissions-manager" title="Manage Permissions" label="Manage Permissions" />
          )}
          {hasFeatureFlagAccess(featureFlags, FEATURE_FLAGS.DEPLOYMENT) && (
            <Fragment>
              <NavbarItem path="/deploy-metadata" title="Deploy Metadata" label="Deploy Metadata" />
              {/* <NavbarItem path="/apex" title="Anonymous Apex" label="Anonymous Apex" /> */}
            </Fragment>
          )}
          <NavbarMenuItems
            label="Developer Tools"
            items={[
              { id: 'apex', path: '/apex', title: 'Anonymous Apex', label: 'Anonymous Apex' },
              { id: 'debug-logs', path: '/debug-logs', title: 'View Debug Logs', label: 'View Debug Logs' },
              { id: 'salesforce-api', path: '/salesforce-api', title: 'Salesforce API', label: 'Salesforce API' },
            ]}
          />
          <NavbarItem path="/feedback" title="Feedback" label="Support / Feedback" />
        </Navbar>
      </Header>
    </Fragment>
  );
};

export default HeaderNavbar;
