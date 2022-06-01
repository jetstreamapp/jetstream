import { DropDownItem, UserProfileUi } from '@jetstream/types';
import { Header, JetstreamIcon, Navbar, NavbarItem, NavbarMenuItems } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import Logo from '../../../assets/images/jetstream-logo-v1-200w.png';
import { applicationCookieState, selectUserPreferenceState } from '../../app-state';
import OrgsDropdown from '../orgs/OrgsDropdown';
import HeaderHelpPopover from './HeaderHelpPopover';
import Jobs from './jobs/Jobs';
import NotificationsRequestModal from './NotificationsRequestModal';
import RecordLookupPopover from './record-lookup/RecordLookupPopover';

const isElectron = window.electron?.isElectron;

export interface HeaderNavbarProps {
  userProfile: UserProfileUi;
  featureFlags: Set<string>;
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

function getMenuItems(userProfile: UserProfileUi, featureFlags: Set<string>, deniedNotifications?: boolean, isElectron?: boolean) {
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

export const HeaderNavbar: FunctionComponent<HeaderNavbarProps> = ({ userProfile, featureFlags }) => {
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
    setUserMenuItems(getMenuItems(userProfile, featureFlags, !isEnabled, isElectron));
  }

  useEffect(() => {
    setUserMenuItems(getMenuItems(userProfile, featureFlags, deniedNotifications, isElectron));
  }, [userProfile, featureFlags, deniedNotifications]);

  return (
    <Fragment>
      {enableNotifications && (
        <NotificationsRequestModal featureFlags={featureFlags} userInitiated onClose={handleNotificationMenuClosed} />
      )}
      <Header
        userProfile={userProfile}
        logo={isElectron ? <JetstreamIcon inverse /> : Logo}
        orgs={<OrgsDropdown addOrgsButtonClassName={isElectron ? 'slds-button_neutral slds-m-left_small' : undefined} />}
        userMenuItems={userMenuItems}
        rightHandMenuItems={[<RecordLookupPopover />, <HeaderHelpPopover />, <Jobs />]}
        isElectron={isElectron}
        onUserMenuItemSelected={handleUserMenuSelection}
      >
        <Navbar>
          <NavbarItem path="/query" title="Query Records" label="Query Records" />

          <NavbarMenuItems
            label="Load Records"
            items={[
              { id: 'load', path: '/load', title: 'Load records to a single object', label: 'Load Records to Single Object' },
              {
                id: 'load-with-relationships',
                path: '/load-multiple-objects',
                title: 'Load records from multiple objects at once',
                label: 'Load Records to Multiple Objects',
              },
              {
                id: 'update-records',
                path: '/update-records',
                title: 'Update Records without File',
                label: 'Update Records without File',
              },
            ]}
          />

          <NavbarItem path="/automation-control" title="Automation Control" label="Automation Control" />
          <NavbarItem path="/permissions-manager" title="Manage Permissions" label="Manage Permissions" />

          <NavbarMenuItems
            label="Deploy Metadata"
            items={[
              {
                id: 'deploy-metadata',
                path: '/deploy-metadata',
                title: 'Deploy and Compare Metadata',
                label: 'Deploy and Compare Metadata',
              },
              {
                id: 'deploy-sobject-metadata',
                path: '/deploy-sobject-metadata',
                title: 'Create Fields',
                label: 'Create Fields',
              },
            ]}
          />

          <NavbarMenuItems
            label="Developer Tools"
            items={[
              { id: 'apex', path: '/apex', title: 'Anonymous Apex', label: 'Anonymous Apex' },
              { id: 'debug-logs', path: '/debug-logs', title: 'View Debug Logs', label: 'View Debug Logs' },
              { id: 'sobject-export', path: '/object-export', title: 'Export Object Metadata', label: 'Export Object Metadata' },
              { id: 'salesforce-api', path: '/salesforce-api', title: 'Salesforce API', label: 'Salesforce API' },
              {
                id: 'platform-event-monitor',
                path: '/platform-event-monitor',
                title: 'Platform Events',
                label: 'Platform Events',
              },
            ]}
          />
          <NavbarMenuItems
            label="Documentation &amp; Support"
            items={[
              { id: 'feedback', path: '/feedback', title: 'File a support ticket', label: 'File a support ticket' },
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
