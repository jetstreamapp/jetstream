import { SerializedStyles } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { AddOrgHandlerFn, DropDownItem, UserProfileUi } from '@jetstream/types';
import { Header, Navbar, NavbarItem, NavbarMenuItems, UpgradeToProButton } from '@jetstream/ui';
import { applicationCookieState, selectUserPreferenceState, userProfileState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAmplitude } from '../analytics';
import Jobs from '../jobs/Jobs';
import OrgsDropdown from '../orgs/OrgsDropdown';
import { SelectedOrgReadOnly } from '../orgs/SelectedOrgReadOnly';
import { QuickQueryPopover } from '../query/QuickQueryPopover';
import { RecordSearchPopover } from '../record/RecordSearchPopover';
import { UserSearchPopover } from '../record/UserSearchPopover';
import HeaderDonatePopover from './HeaderDonatePopover';
import HeaderHelpPopover from './HeaderHelpPopover';
import LogoPro from './jetstream-logo-pro-200w.png';
import Logo from './jetstream-logo-v1-200w.png';
import NotificationsRequestModal from './NotificationsRequestModal';

export interface HeaderNavbarProps {
  isBillingEnabled: boolean;
  isChromeExtension?: boolean;
  isDesktop?: boolean;
  logoCss?: SerializedStyles;
  onAddOrgHandlerFn?: AddOrgHandlerFn;
  onLogoutHandlerFn?: () => void;
}

function logout(serverUrl: string) {
  const logoutUrl = `${serverUrl}/api/auth/logout`;
  // eslint-disable-next-line no-restricted-globals
  location.href = logoutUrl;
}

function getMenuItems({
  userProfile,
  isBillingEnabled,
  deniedNotifications,
  isDesktop,
}: {
  userProfile: UserProfileUi;
  isBillingEnabled: boolean;
  deniedNotifications?: boolean;
  isDesktop?: boolean;
}) {
  const menu: DropDownItem[] = [];

  if (!isDesktop) {
    menu.push({ id: 'profile', value: 'Profile', subheader: userProfile.email, icon: { type: 'utility', icon: 'profile_alt' } });
  }
  menu.push({ id: 'settings', value: 'Settings', icon: { type: 'utility', icon: 'settings' } });

  if (isBillingEnabled) {
    menu.push({ id: 'billing', value: 'Billing & Subscription', subheader: 'Billing', icon: { type: 'utility', icon: 'billing' } });
  }

  if (deniedNotifications && window.Notification && window.Notification.permission === 'default') {
    menu.push({
      id: 'enable-notifications',
      value: 'Enable Notifications',
      subheader: 'Notifications',
      icon: { type: 'utility', icon: 'notification' },
    });
  }

  menu.push({ id: 'nav-user-logout', subheader: 'Logout', value: 'Logout', icon: { type: 'utility', icon: 'logout' } });
  return menu;
}

export const HeaderNavbar = ({
  isBillingEnabled,
  isChromeExtension = false,
  isDesktop = false,
  logoCss,
  onAddOrgHandlerFn,
  onLogoutHandlerFn,
}: HeaderNavbarProps) => {
  const navigate = useNavigate();
  const { trackEvent } = useAmplitude();
  const userProfile = useAtomValue(userProfileState);
  const applicationState = useAtomValue(applicationCookieState);
  const { deniedNotifications } = useAtomValue(selectUserPreferenceState);
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [userMenuItems, setUserMenuItems] = useState<DropDownItem[]>([]);

  const subscriptionLength = userProfile?.subscriptions?.length || 0;

  function handleUserMenuSelection(id: string) {
    switch (id) {
      case 'profile':
        navigate(APP_ROUTES.PROFILE.ROUTE);
        break;
      case 'billing':
        navigate(APP_ROUTES.BILLING.ROUTE);
        break;
      case 'settings':
        navigate(APP_ROUTES.SETTINGS.ROUTE);
        break;
      case 'nav-user-logout':
        onLogoutHandlerFn ? onLogoutHandlerFn() : logout(applicationState.serverUrl);
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
    setUserMenuItems(getMenuItems({ userProfile, isBillingEnabled, deniedNotifications: !isEnabled, isDesktop }));
  }

  useEffect(() => {
    setUserMenuItems(getMenuItems({ userProfile, isBillingEnabled, deniedNotifications, isDesktop }));
  }, [userProfile, deniedNotifications, isBillingEnabled, isDesktop]);

  const rightHandMenuItems = useMemo(() => {
    if (isChromeExtension || isDesktop) {
      return [<QuickQueryPopover />, <RecordSearchPopover />, <UserSearchPopover />, <Jobs />, <HeaderHelpPopover />];
    }

    if (!isBillingEnabled) {
      return [
        <QuickQueryPopover />,
        <RecordSearchPopover />,
        <UserSearchPopover />,
        <Jobs />,
        <HeaderHelpPopover />,
        <HeaderDonatePopover />,
      ];
    }

    if (subscriptionLength === 0) {
      return [
        <UpgradeToProButton trackEvent={trackEvent} source="navbar" />,
        <QuickQueryPopover />,
        <RecordSearchPopover />,
        <UserSearchPopover />,
        <Jobs />,
        <HeaderHelpPopover />,
      ];
    }

    return [<QuickQueryPopover />, <RecordSearchPopover />, <UserSearchPopover />, <Jobs />, <HeaderHelpPopover />];
  }, [isChromeExtension, isDesktop, isBillingEnabled, subscriptionLength, trackEvent]);

  return (
    <Fragment>
      {enableNotifications && <NotificationsRequestModal userInitiated onClose={handleNotificationMenuClosed} />}
      <Header
        userProfile={userProfile}
        logo={isChromeExtension || isDesktop || subscriptionLength > 0 ? LogoPro : Logo}
        logoCss={logoCss}
        orgs={isChromeExtension ? <SelectedOrgReadOnly /> : <OrgsDropdown onAddOrgHandlerFn={onAddOrgHandlerFn} />}
        userMenuItems={userMenuItems}
        rightHandMenuItems={rightHandMenuItems}
        isChromeExtension={isChromeExtension}
        onUserMenuItemSelected={handleUserMenuSelection}
      >
        <Navbar>
          <NavbarItem
            path={APP_ROUTES.HOME.ROUTE}
            search={APP_ROUTES.HOME.SEARCH_PARAM}
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
          <NavbarItem
            path={APP_ROUTES.QUERY.ROUTE}
            search={APP_ROUTES.QUERY.SEARCH_PARAM}
            title={APP_ROUTES.QUERY.DESCRIPTION}
            label={APP_ROUTES.QUERY.TITLE}
          />

          <NavbarMenuItems
            label="Load Records"
            items={[
              {
                id: 'load',
                path: APP_ROUTES.LOAD.ROUTE,
                search: APP_ROUTES.LOAD.SEARCH_PARAM,
                title: APP_ROUTES.LOAD.DESCRIPTION,
                label: APP_ROUTES.LOAD.TITLE,
              },
              {
                id: 'load-with-relationships',
                path: APP_ROUTES.LOAD_MULTIPLE.ROUTE,
                search: APP_ROUTES.LOAD_MULTIPLE.SEARCH_PARAM,
                title: APP_ROUTES.LOAD_MULTIPLE.DESCRIPTION,
                label: APP_ROUTES.LOAD_MULTIPLE.TITLE,
              },
              {
                id: 'update-records',
                path: APP_ROUTES.LOAD_MASS_UPDATE.ROUTE,
                search: APP_ROUTES.LOAD_MASS_UPDATE.SEARCH_PARAM,
                title: APP_ROUTES.LOAD_MASS_UPDATE.DESCRIPTION,
                label: APP_ROUTES.LOAD_MASS_UPDATE.TITLE,
              },
              {
                id: 'create-records',
                path: APP_ROUTES.LOAD_CREATE_RECORD.ROUTE,
                search: APP_ROUTES.LOAD_CREATE_RECORD.SEARCH_PARAM,
                title: APP_ROUTES.LOAD_CREATE_RECORD.DESCRIPTION,
                label: APP_ROUTES.LOAD_CREATE_RECORD.TITLE,
              },
            ]}
          />

          <NavbarItem
            path={APP_ROUTES.AUTOMATION_CONTROL.ROUTE}
            search={APP_ROUTES.AUTOMATION_CONTROL.SEARCH_PARAM}
            title={APP_ROUTES.AUTOMATION_CONTROL.DESCRIPTION}
            label={APP_ROUTES.AUTOMATION_CONTROL.TITLE}
          />
          <NavbarItem
            path={APP_ROUTES.PERMISSION_MANAGER.ROUTE}
            search={APP_ROUTES.PERMISSION_MANAGER.SEARCH_PARAM}
            title={APP_ROUTES.PERMISSION_MANAGER.DESCRIPTION}
            label={APP_ROUTES.PERMISSION_MANAGER.TITLE}
          />

          <NavbarMenuItems
            label="Deploy Metadata"
            items={[
              {
                id: 'deploy-metadata',
                path: APP_ROUTES.DEPLOY_METADATA.ROUTE,
                search: APP_ROUTES.DEPLOY_METADATA.SEARCH_PARAM,
                title: APP_ROUTES.DEPLOY_METADATA.DESCRIPTION,
                label: APP_ROUTES.DEPLOY_METADATA.TITLE,
              },
              {
                id: 'deploy-sobject-metadata',
                path: APP_ROUTES.CREATE_FIELDS.ROUTE,
                search: APP_ROUTES.CREATE_FIELDS.SEARCH_PARAM,
                title: APP_ROUTES.CREATE_FIELDS.DESCRIPTION,
                label: APP_ROUTES.CREATE_FIELDS.TITLE,
              },
              {
                id: 'record-type-manager',
                path: APP_ROUTES.RECORD_TYPE_MANAGER.ROUTE,
                search: APP_ROUTES.RECORD_TYPE_MANAGER.SEARCH_PARAM,
                title: APP_ROUTES.RECORD_TYPE_MANAGER.DESCRIPTION,
                label: APP_ROUTES.RECORD_TYPE_MANAGER.TITLE,
              },
              {
                id: 'formula-evaluator',
                path: APP_ROUTES.FORMULA_EVALUATOR.ROUTE,
                search: APP_ROUTES.FORMULA_EVALUATOR.SEARCH_PARAM,
                title: APP_ROUTES.FORMULA_EVALUATOR.DESCRIPTION,
                label: APP_ROUTES.FORMULA_EVALUATOR.TITLE,
              },
            ]}
          />

          <NavbarMenuItems
            label="Developer Tools"
            items={[
              {
                id: 'apex',
                path: APP_ROUTES.ANON_APEX.ROUTE,
                search: APP_ROUTES.ANON_APEX.SEARCH_PARAM,
                title: APP_ROUTES.ANON_APEX.DESCRIPTION,
                label: APP_ROUTES.ANON_APEX.TITLE,
              },
              {
                id: 'debug-logs',
                path: APP_ROUTES.DEBUG_LOG_VIEWER.ROUTE,
                search: APP_ROUTES.DEBUG_LOG_VIEWER.SEARCH_PARAM,
                title: APP_ROUTES.DEBUG_LOG_VIEWER.DESCRIPTION,
                label: APP_ROUTES.DEBUG_LOG_VIEWER.TITLE,
              },
              {
                id: 'sobject-export',
                path: APP_ROUTES.OBJECT_EXPORT.ROUTE,
                search: APP_ROUTES.OBJECT_EXPORT.SEARCH_PARAM,
                title: APP_ROUTES.OBJECT_EXPORT.DESCRIPTION,
                label: APP_ROUTES.OBJECT_EXPORT.TITLE,
              },
              {
                id: 'salesforce-api',
                path: APP_ROUTES.SALESFORCE_API.ROUTE,
                search: APP_ROUTES.SALESFORCE_API.SEARCH_PARAM,
                title: APP_ROUTES.SALESFORCE_API.DESCRIPTION,
                label: APP_ROUTES.SALESFORCE_API.TITLE,
              },
              {
                id: 'platform-event-monitor',
                path: APP_ROUTES.PLATFORM_EVENT_MONITOR.ROUTE,
                search: APP_ROUTES.PLATFORM_EVENT_MONITOR.SEARCH_PARAM,
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
                search: APP_ROUTES.FEEDBACK_SUPPORT.SEARCH_PARAM,
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
