import { DropDownItem, Maybe, UserProfileUi } from '@jetstream/types';
import { Header, Navbar, NavbarItem, NavbarMenuItems } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import Jobs from '../jobs/Jobs';
import OrgsDropdown from '../orgs/OrgsDropdown';
import { SelectedOrgReadOnly } from '../orgs/SelectedOrgReadOnly';
import { RecordSearchPopover } from '../record/RecordSearchPopover';
import { applicationCookieState, selectUserPreferenceState } from '../state-management/app-state';
import HeaderDonatePopover from './HeaderDonatePopover';
import HeaderHelpPopover from './HeaderHelpPopover';
import NotificationsRequestModal from './NotificationsRequestModal';
import { APP_ROUTES } from './app-routes';
import Logo from './jetstream-logo-v1-200w.png';

export interface HeaderNavbarProps {
  userProfile: Maybe<UserProfileUi>;
  featureFlags: Set<string>;
  isChromeExtension?: boolean;
}

function logout(serverUrl: string) {
  const logoutUrl = `${serverUrl}/oauth/logout`;
  // eslint-disable-next-line no-restricted-globals
  location.href = logoutUrl;
}

function getMenuItems(userProfile: Maybe<UserProfileUi>, featureFlags: Set<string>, deniedNotifications?: boolean) {
  const menu: DropDownItem[] = [];

  menu.push({ id: 'settings', value: 'Settings', subheader: userProfile?.email, icon: { type: 'utility', icon: 'settings' } });

  menu.push({ id: 'nav-user-logout', value: 'Logout', icon: { type: 'utility', icon: 'logout' } });
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

export const HeaderNavbar: FunctionComponent<HeaderNavbarProps> = ({ userProfile, featureFlags, isChromeExtension }) => {
  const navigate = useNavigate();
  const [applicationState] = useRecoilState(applicationCookieState);
  const { deniedNotifications } = useRecoilValue(selectUserPreferenceState);
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [userMenuItems, setUserMenuItems] = useState<DropDownItem[]>([]);

  function handleUserMenuSelection(id: string) {
    switch (id) {
      case 'settings':
        navigate('/settings');
        break;
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
    userProfile && setUserMenuItems(getMenuItems(userProfile, featureFlags, !isEnabled));
  }

  useEffect(() => {
    userProfile && setUserMenuItems(getMenuItems(userProfile, featureFlags, deniedNotifications));
  }, [userProfile, featureFlags, deniedNotifications]);

  const rightHandMenuItems = useMemo(() => {
    return isChromeExtension
      ? [<RecordSearchPopover />, <Jobs />, <HeaderHelpPopover />]
      : [<RecordSearchPopover />, <Jobs />, <HeaderHelpPopover />, <HeaderDonatePopover />];
  }, [isChromeExtension]);

  return (
    <Fragment>
      {enableNotifications && (
        <NotificationsRequestModal featureFlags={featureFlags} userInitiated onClose={handleNotificationMenuClosed} />
      )}
      <Header
        userProfile={userProfile}
        logo={Logo}
        orgs={isChromeExtension ? <SelectedOrgReadOnly /> : <OrgsDropdown />}
        userMenuItems={userMenuItems}
        rightHandMenuItems={rightHandMenuItems}
        isChromeExtension={isChromeExtension}
        onUserMenuItemSelected={handleUserMenuSelection}
      >
        <Navbar>
          <NavbarItem
            path={APP_ROUTES.HOME.ROUTE}
            title="Home"
            label={
              <button className="slds-button slds-icon-waffle_container">
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
                <span className="slds-assistive-text">Home Page</span>
              </button>
            }
          />
          <NavbarItem path={APP_ROUTES.QUERY.ROUTE} title={APP_ROUTES.QUERY.DESCRIPTION} label={APP_ROUTES.QUERY.TITLE} />

          <NavbarMenuItems
            label="Load Records"
            items={[
              { id: 'load', path: APP_ROUTES.LOAD.ROUTE, title: APP_ROUTES.LOAD.DESCRIPTION, label: APP_ROUTES.LOAD.TITLE },
              {
                id: 'load-with-relationships',
                path: APP_ROUTES.LOAD_MULTIPLE.ROUTE,
                title: APP_ROUTES.LOAD_MULTIPLE.DESCRIPTION,
                label: APP_ROUTES.LOAD_MULTIPLE.TITLE,
              },
              {
                id: 'update-records',
                path: APP_ROUTES.LOAD_MASS_UPDATE.ROUTE,
                title: APP_ROUTES.LOAD_MASS_UPDATE.DESCRIPTION,
                label: APP_ROUTES.LOAD_MASS_UPDATE.TITLE,
              },
            ]}
          />

          <NavbarItem
            path={APP_ROUTES.AUTOMATION_CONTROL.ROUTE}
            title={APP_ROUTES.AUTOMATION_CONTROL.DESCRIPTION}
            label={APP_ROUTES.AUTOMATION_CONTROL.TITLE}
          />
          <NavbarItem
            path={APP_ROUTES.PERMISSION_MANAGER.ROUTE}
            title={APP_ROUTES.PERMISSION_MANAGER.DESCRIPTION}
            label={APP_ROUTES.PERMISSION_MANAGER.TITLE}
          />

          <NavbarMenuItems
            label="Deploy Metadata"
            items={[
              {
                id: 'deploy-metadata',
                path: APP_ROUTES.DEPLOY_METADATA.ROUTE,
                title: APP_ROUTES.DEPLOY_METADATA.DESCRIPTION,
                label: APP_ROUTES.DEPLOY_METADATA.TITLE,
              },
              {
                id: 'deploy-sobject-metadata',
                path: APP_ROUTES.CREATE_FIELDS.ROUTE,
                title: APP_ROUTES.CREATE_FIELDS.DESCRIPTION,
                label: APP_ROUTES.CREATE_FIELDS.TITLE,
              },
              {
                id: 'formula-evaluator',
                path: APP_ROUTES.FORMULA_EVALUATOR.ROUTE,
                title: APP_ROUTES.FORMULA_EVALUATOR.DESCRIPTION,
                label: APP_ROUTES.FORMULA_EVALUATOR.TITLE,
              },
            ]}
          />

          <NavbarMenuItems
            label="Developer Tools"
            items={[
              { id: 'apex', path: APP_ROUTES.ANON_APEX.ROUTE, title: APP_ROUTES.ANON_APEX.DESCRIPTION, label: APP_ROUTES.ANON_APEX.TITLE },
              {
                id: 'debug-logs',
                path: APP_ROUTES.DEBUG_LOG_VIEWER.ROUTE,
                title: APP_ROUTES.DEBUG_LOG_VIEWER.DESCRIPTION,
                label: APP_ROUTES.DEBUG_LOG_VIEWER.TITLE,
              },
              {
                id: 'sobject-export',
                path: APP_ROUTES.OBJECT_EXPORT.ROUTE,
                title: APP_ROUTES.OBJECT_EXPORT.DESCRIPTION,
                label: APP_ROUTES.OBJECT_EXPORT.TITLE,
              },
              {
                id: 'salesforce-api',
                path: APP_ROUTES.SALESFORCE_API.ROUTE,
                title: APP_ROUTES.SALESFORCE_API.DESCRIPTION,
                label: APP_ROUTES.SALESFORCE_API.TITLE,
              },
              {
                id: 'platform-event-monitor',
                path: APP_ROUTES.PLATFORM_EVENT_MONITOR.ROUTE,
                title: APP_ROUTES.PLATFORM_EVENT_MONITOR.DESCRIPTION,
                label: APP_ROUTES.PLATFORM_EVENT_MONITOR.TITLE,
              },
            ]}
          />
          <NavbarMenuItems
            label="Documentation &amp; Support"
            items={[
              {
                id: 'feedback',
                path: APP_ROUTES.FEEDBACK_SUPPORT.ROUTE,
                title: APP_ROUTES.FEEDBACK_SUPPORT.DESCRIPTION,
                label: APP_ROUTES.FEEDBACK_SUPPORT.TITLE,
              },
              {
                id: 'documentation',
                path: 'https://docs.getjetstream.app',
                isExternal: true,
                title: 'Documentation',
                label: 'Documentation',
              },
            ]}
          />
        </Navbar>
      </Header>
    </Fragment>
  );
};

export default HeaderNavbar;
