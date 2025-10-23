import { SerializedStyles } from '@emotion/react';
import { AppAbility } from '@jetstream/acl';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { AddOrgHandlerFn, DropDownItem, UserProfileUi } from '@jetstream/types';
import { Header, Navbar, UpgradeToProButton } from '@jetstream/ui';
import {
  abilityState,
  applicationCookieState,
  hasPaidPlanState,
  isReadOnlyUserState,
  selectUserPreferenceState,
  userProfileState,
} from '@jetstream/ui/app-state';
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
import { HeaderNavbarItems } from './HeaderNavbarItems';
import { HeaderNavbarBillingUserItems } from './HeaderNavbarReadOnlyUserItems';
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
  ability,
  userProfile,
  deniedNotifications,
  isBillingEnabled,
}: {
  ability: AppAbility;
  userProfile: UserProfileUi;
  deniedNotifications?: boolean;
  isBillingEnabled: boolean;
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
  const ability = useAtomValue(abilityState);
  const userProfile = useAtomValue(userProfileState);
  const isReadOnlyUser = useAtomValue(isReadOnlyUserState);
  const hasPaidPlan = useAtomValue(hasPaidPlanState);
  const applicationState = useAtomValue(applicationCookieState);
  const { deniedNotifications } = useAtomValue(selectUserPreferenceState);
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [userMenuItems, setUserMenuItems] = useState<DropDownItem[]>([]);

  function handleUserMenuSelection(id: string) {
    switch (id) {
      case 'profile':
        navigate(APP_ROUTES.PROFILE.ROUTE);
        break;
      case 'team-dashboard':
        navigate(APP_ROUTES.TEAM_DASHBOARD.ROUTE);
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
    setUserMenuItems(getMenuItems({ ability, userProfile, deniedNotifications: !isEnabled, isBillingEnabled }));
  }

  useEffect(() => {
    setUserMenuItems(getMenuItems({ ability, userProfile, deniedNotifications, isBillingEnabled }));
  }, [ability, userProfile, deniedNotifications, isBillingEnabled]);

  const rightHandMenuItems = useMemo(() => {
    if (isReadOnlyUser) {
      return [<HeaderHelpPopover />];
    }

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
  }, [isReadOnlyUser, isChromeExtension, isDesktop, isBillingEnabled, hasPaidPlan, trackEvent]);

  return (
    <Fragment>
      {enableNotifications && <NotificationsRequestModal userInitiated onClose={handleNotificationMenuClosed} />}
      <Header
        userProfile={userProfile}
        isReadOnlyUser={isReadOnlyUser}
        logo={isChromeExtension || isDesktop || hasPaidPlan ? LogoPro : Logo}
        logoCss={logoCss}
        orgs={isChromeExtension ? <SelectedOrgReadOnly /> : <OrgsDropdown onAddOrgHandlerFn={onAddOrgHandlerFn} />}
        userMenuItems={userMenuItems}
        rightHandMenuItems={rightHandMenuItems}
        isChromeExtension={isChromeExtension}
        onUserMenuItemSelected={handleUserMenuSelection}
      >
        <Navbar>
          {isReadOnlyUser && <HeaderNavbarBillingUserItems />}
          {!isReadOnlyUser && <HeaderNavbarItems />}
        </Navbar>
      </Header>
    </Fragment>
  );
};

export default HeaderNavbar;
