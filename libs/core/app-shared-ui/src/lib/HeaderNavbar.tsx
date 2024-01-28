import { APP_ROUTES, applicationCookieState, selectUserPreferenceState } from '@jetstream/core/app';
import { DropDownItem, Maybe, SalesforceOrgUi, UserProfileUi } from '@jetstream/types';
import { Header, Icon, Navbar, NavbarItem, NavbarMenuItems } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import HeaderDonatePopover from './HeaderDonatePopover';
import HeaderHelpPopover from './HeaderHelpPopover';
import NotificationsRequestModal from './NotificationsRequestModal';
import RecordSearchPopover from './RecordSearchPopover';
import Logo from './jetstream-logo-v1-200w.png';
import Jobs from './jobs/Jobs';

const isElectron = window.electron?.isElectron;
const defaultFlags = new Set<string>();
const unavailableRoutesDefault = new Set<keyof typeof APP_ROUTES>();

export interface HeaderNavbarProps {
  userProfile?: Maybe<UserProfileUi>;
  selectedOrg?: SalesforceOrgUi;
  featureFlags?: Set<string>;
  orgsDropdown?: JSX.Element;
  unavailableRoutes?: Set<keyof typeof APP_ROUTES>;
}

function logout(serverUrl: string) {
  if (isElectron) {
    window.electron?.logout();
  } else {
    const logoutUrl = `${serverUrl}/oauth/logout`;
    // eslint-disable-next-line no-restricted-globals
    location.href = logoutUrl;
  }
}

function getMenuItems(userProfile: Maybe<UserProfileUi>, featureFlags: Set<string>, deniedNotifications?: boolean, isElectron?: boolean) {
  const menu: DropDownItem[] = [];

  if (!isElectron) {
    menu.push({ id: 'settings', value: 'Settings', subheader: userProfile?.email, icon: { type: 'utility', icon: 'settings' } });
  }

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

export const HeaderNavbar: FunctionComponent<HeaderNavbarProps> = ({
  userProfile,
  featureFlags = defaultFlags,
  unavailableRoutes = unavailableRoutesDefault,
  orgsDropdown,
  selectedOrg,
}) => {
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
    userProfile && setUserMenuItems(getMenuItems(userProfile, featureFlags, !isEnabled, isElectron));
  }

  useEffect(() => {
    userProfile && setUserMenuItems(getMenuItems(userProfile, featureFlags, deniedNotifications, isElectron));
  }, [userProfile, featureFlags, deniedNotifications]);

  return (
    <Fragment>
      {enableNotifications && (
        <NotificationsRequestModal featureFlags={featureFlags} userInitiated onClose={handleNotificationMenuClosed} />
      )}
      <Header
        userProfile={userProfile}
        logo={isElectron ? <Icon type="brand" icon="jetstream_inverse" /> : Logo}
        orgs={orgsDropdown}
        userMenuItems={userMenuItems}
        rightHandMenuItems={[<RecordSearchPopover selectedOrg={selectedOrg} />, <Jobs />, <HeaderHelpPopover />, <HeaderDonatePopover />]}
        isElectron={isElectron}
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
          {!unavailableRoutes.has('QUERY') && (
            <NavbarItem path={APP_ROUTES.QUERY.ROUTE} title={APP_ROUTES.QUERY.DESCRIPTION} label={APP_ROUTES.QUERY.TITLE} />
          )}

          {!unavailableRoutes.has('LOAD') && (
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
          )}

          {!unavailableRoutes.has('AUTOMATION_CONTROL') && (
            <NavbarItem
              path={APP_ROUTES.AUTOMATION_CONTROL.ROUTE}
              title={APP_ROUTES.AUTOMATION_CONTROL.DESCRIPTION}
              label={APP_ROUTES.AUTOMATION_CONTROL.TITLE}
            />
          )}
          {!unavailableRoutes.has('PERMISSION_MANAGER') && (
            <NavbarItem
              path={APP_ROUTES.PERMISSION_MANAGER.ROUTE}
              title={APP_ROUTES.PERMISSION_MANAGER.DESCRIPTION}
              label={APP_ROUTES.PERMISSION_MANAGER.TITLE}
            />
          )}

          {!unavailableRoutes.has('FORMULA_EVALUATOR') && (
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
          )}
          {!unavailableRoutes.has('PLATFORM_EVENT_MONITOR') && (
            <NavbarMenuItems
              label="Developer Tools"
              items={[
                {
                  id: 'apex',
                  path: APP_ROUTES.ANON_APEX.ROUTE,
                  title: APP_ROUTES.ANON_APEX.DESCRIPTION,
                  label: APP_ROUTES.ANON_APEX.TITLE,
                },
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
          )}
          {!unavailableRoutes.has('FEEDBACK_SUPPORT') && (
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
          )}
        </Navbar>
      </Header>
    </Fragment>
  );
};

export default HeaderNavbar;
