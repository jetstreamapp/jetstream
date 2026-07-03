import { css, SerializedStyles } from '@emotion/react';
import { AppAbility } from '@jetstream/acl';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { isCanvasApp } from '@jetstream/shared/ui-utils';
import { AddOrgHandlerFn, ColorScheme, DropDownItem, UserProfileUi } from '@jetstream/types';
import { Header, Icon, Navbar, UpgradeToProButton } from '@jetstream/ui';
import {
  abilityState,
  applicationCookieState,
  hasPaidPlanState,
  isReadOnlyUserState,
  selectedOrgStateWithoutPlaceholder,
  userProfileState,
  useUserPreferenceState,
} from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAmplitude } from '../analytics';
import Jobs from '../jobs/Jobs';
import OrgsDropdown from '../orgs/OrgsDropdown';
import { SelectedOrgReadOnly } from '../orgs/SelectedOrgReadOnly';
import { QuickQueryPopover } from '../query/QuickQueryPopover';
import { RecordSearchPopover } from '../record/RecordSearchPopover';
import { UserSearchPopover } from '../record/UserSearchPopover';
import HeaderDonatePopover from './HeaderDonatePopover';
import HeaderHelpPopover from './HeaderHelpPopover';
import { useHeaderNavbarItems } from './HeaderNavbarItems';
import { headerNavbarBillingUserItems } from './HeaderNavbarReadOnlyUserItems';
import HeaderUpdateNotification from './HeaderUpdateNotification';
import LogoPro from './jetstream-logo-pro-200w.png';
import Logo from './jetstream-logo-v1-200w.png';
import NotificationsRequestModal from './NotificationsRequestModal';

export interface HeaderNavbarProps {
  isBillingEnabled: boolean;
  isEmbeddedApp?: boolean;
  isDesktop?: boolean;
  /** When true, the "Open Fullscreen" button is hidden (canvas app is already fullscreen). */
  isFullscreen?: boolean;
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
  ability,
  userProfile,
  deniedNotifications,
  isBillingEnabled,
  colorScheme,
}: {
  ability: AppAbility;
  userProfile: UserProfileUi;
  deniedNotifications?: boolean;
  isBillingEnabled: boolean;
  colorScheme: ColorScheme;
}) {
  const menu: DropDownItem[] = [];

  if (ability.can('read', 'Profile')) {
    menu.push({ id: 'profile', value: 'Profile', subheader: userProfile.email, icon: { type: 'utility', icon: 'profile_alt' } });
  }

  if (ability.can('read', 'Settings')) {
    menu.push({ id: 'settings', value: 'Settings', icon: { type: 'utility', icon: 'settings' } });
  }

  if (ability.can('read', 'Team')) {
    menu.push({ id: 'team-dashboard', value: 'Team Dashboard', icon: { type: 'utility', icon: 'people' } });
  }

  if (isBillingEnabled && ability.can('read', 'Billing')) {
    menu.push({ id: 'billing', value: 'Billing & Subscription', subheader: 'Billing', icon: { type: 'utility', icon: 'billing' } });
  }

  if (deniedNotifications && ability.can('read', 'Settings') && window.Notification && window.Notification.permission === 'default') {
    menu.push({
      id: 'enable-notifications',
      value: 'Enable Notifications',
      subheader: 'Notifications',
      icon: { type: 'utility', icon: 'notification' },
    });
  }

  if (!isCanvasApp()) {
    menu.push(
      {
        id: 'theme-light',
        subheader: 'Theme',
        value: 'Light Mode',
        icon: { type: 'utility', icon: colorScheme === 'light' ? 'check' : 'light_bulb' },
      },
      {
        id: 'theme-dark',
        // ReactNode value bypasses DropDown's string rendering, so the icon markup is replicated here
        value: (
          <span className="slds-truncate" title="Dark Mode">
            <Icon
              type="utility"
              icon={colorScheme === 'dark' ? 'check' : 'color_swatch'}
              omitContainer
              className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_x-small"
            />
            Dark Mode
            <span className="slds-badge slds-m-left_x-small">Beta</span>
          </span>
        ),
      },
      {
        id: 'theme-system',
        value: 'Match Device',
        icon: { type: 'utility', icon: colorScheme === 'system' ? 'check' : 'desktop_and_phone' },
        trailingDivider: true,
      },
    );
  }

  menu.push({ id: 'nav-user-logout', subheader: 'Logout', value: 'Logout', icon: { type: 'utility', icon: 'logout' } });
  return menu;
}

export const HeaderNavbar = ({
  isBillingEnabled,
  isEmbeddedApp = false,
  isDesktop = false,
  isFullscreen = false,
  logoCss,
  onAddOrgHandlerFn,
  onLogoutHandlerFn,
}: HeaderNavbarProps) => {
  const navigate = useNavigate();
  const { trackEvent } = useAmplitude();
  const ability = useAtomValue(abilityState);
  const userProfile = useAtomValue(userProfileState);
  const isReadOnlyUser = useAtomValue(isReadOnlyUserState);
  const selectedOrg = useAtomValue(selectedOrgStateWithoutPlaceholder);
  const hasPaidPlan = useAtomValue(hasPaidPlanState);
  const applicationState = useAtomValue(applicationCookieState);
  const [userPreferences, setUserPreferences] = useUserPreferenceState();
  const deniedNotifications = userPreferences?.deniedNotifications;
  const colorScheme: ColorScheme = userPreferences?.colorScheme ?? 'light';
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [userMenuItems, setUserMenuItems] = useState<DropDownItem[]>([]);
  const navbarItems = useHeaderNavbarItems();

  function handleUserMenuSelection(id: string) {
    switch (id) {
      case 'profile':
        navigate(APP_ROUTES.PROFILE.ROUTE);
        break;
      case 'team-dashboard': {
        if (isDesktop) {
          window.open(`${applicationState.serverUrl}/app/teams`, '_blank');
        } else {
          navigate(APP_ROUTES.TEAM_DASHBOARD.ROUTE);
        }
        break;
      }
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
      case 'theme-light':
        setUserPreferences({ ...userPreferences, colorScheme: 'light' });
        trackEvent(ANALYTICS_KEYS.settings_color_scheme_changed, { colorScheme: 'light' });
        break;
      case 'theme-dark':
        setUserPreferences({ ...userPreferences, colorScheme: 'dark' });
        trackEvent(ANALYTICS_KEYS.settings_color_scheme_changed, { colorScheme: 'dark' });
        break;
      case 'theme-system':
        setUserPreferences({ ...userPreferences, colorScheme: 'system' });
        trackEvent(ANALYTICS_KEYS.settings_color_scheme_changed, { colorScheme: 'system' });
        break;
      default:
        break;
    }
  }

  function handleNotificationMenuClosed(isEnabled: boolean) {
    setEnableNotifications(false);
    setUserMenuItems(getMenuItems({ ability, userProfile, deniedNotifications: !isEnabled, isBillingEnabled, colorScheme }));
  }

  useEffect(() => {
    setUserMenuItems(getMenuItems({ ability, userProfile, deniedNotifications, isBillingEnabled, colorScheme }));
  }, [ability, userProfile, deniedNotifications, isBillingEnabled, colorScheme]);

  const handleCheckForUpdates = () => {
    if (window.electronAPI) {
      window.electronAPI.checkForUpdates(true);
    }
  };

  const handleInstallUpdate = () => {
    if (window.electronAPI) {
      window.electronAPI.installUpdate();
    }
  };

  // Show "Open Fullscreen" button in canvas app when not already on the fullscreen VF page
  const showFullscreenLink = isCanvasApp() && !isFullscreen;
  const instanceUrl = selectedOrg?.instanceUrl;

  const rightHandMenuItems = useMemo(() => {
    if (isReadOnlyUser) {
      return [<HeaderHelpPopover />];
    }

    if (isEmbeddedApp || isDesktop) {
      const items: React.ReactNode[] = [];

      if (showFullscreenLink && instanceUrl) {
        items.push(
          <a
            href={`${instanceUrl}/apex/jetstream__JetstreamPage`}
            target="_blank"
            rel="noopener noreferrer"
            className="slds-button slds-button_neutral slds-button_small"
          >
            <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_left" omitContainer />
            Open Fullscreen
          </a>,
        );
      }

      items.push(<QuickQueryPopover />, <RecordSearchPopover />, <UserSearchPopover />, <Jobs />);

      // Add update notification for desktop
      if (isDesktop) {
        items.push(<HeaderUpdateNotification onCheckForUpdates={handleCheckForUpdates} onInstallUpdate={handleInstallUpdate} />);
      }

      items.push(<HeaderHelpPopover />);
      return items;
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

    if (!hasPaidPlan) {
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
  }, [isReadOnlyUser, isEmbeddedApp, isDesktop, isBillingEnabled, hasPaidPlan, trackEvent, showFullscreenLink, instanceUrl]);

  // The pro logo is light-on-dark and reads fine in both schemes. The free logo
  // is dark-on-transparent and disappears against dark surfaces, so invert it
  // when the resolved color scheme is dark. Explicit dark pick lands via the
  // body class; system pick falls through to prefers-color-scheme.
  const isPaidLikeLogo = isEmbeddedApp || isDesktop || hasPaidPlan;
  const freeLogoCss = useMemo(
    () => css`
      ${logoCss}

      body.slds-color-scheme--dark & {
        filter: invert(1);
      }

      @media (prefers-color-scheme: dark) {
        body.slds-color-scheme--system & {
          filter: invert(1);
        }
      }
    `,
    [logoCss],
  );

  return (
    <Fragment>
      {enableNotifications && <NotificationsRequestModal userInitiated onClose={handleNotificationMenuClosed} />}
      <Header
        userProfile={userProfile}
        isReadOnlyUser={isReadOnlyUser}
        logo={isPaidLikeLogo ? LogoPro : Logo}
        logoCss={isPaidLikeLogo ? logoCss : freeLogoCss}
        orgs={isEmbeddedApp ? <SelectedOrgReadOnly /> : <OrgsDropdown onAddOrgHandlerFn={onAddOrgHandlerFn} />}
        userMenuItems={userMenuItems}
        rightHandMenuItems={rightHandMenuItems}
        isEmbeddedApp={isEmbeddedApp}
        onUserMenuItemSelected={handleUserMenuSelection}
      >
        <Navbar items={isReadOnlyUser ? headerNavbarBillingUserItems : navbarItems} />
      </Header>
    </Fragment>
  );
};

export default HeaderNavbar;
