/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { UserProfile } from '@jetstream/types';
import { Header, Navbar, NavbarItem } from '@jetstream/ui';
import Logo from '../../../assets/jetstream-logo-v1-200w.png';
import OrgsDropdown from '../orgs/OrgsDropdown';
import { FunctionComponent } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';

export interface HeaderNavbarProps {
  userProfile: UserProfile;
}

function logout(serverUrl: string) {
  const logoutUrl = `${serverUrl}/oauth/logout`;
  // eslint-disable-next-line no-restricted-globals
  location.href = logoutUrl;
}

export const HeaderNavbar: FunctionComponent<HeaderNavbarProps> = () => {
  const [applicationState] = useRecoilState(applicationCookieState);

  function handleUserMenuSelection(id: string) {
    switch (id) {
      case 'nav-user-logout':
        logout(applicationState.serverUrl);
        break;
      default:
        break;
    }
  }

  return (
    <Header
      logo={Logo}
      orgs={<OrgsDropdown />}
      userMenuItems={[{ id: 'nav-user-logout', value: 'Logout', icon: { type: 'utility', icon: 'logout' } }]}
      onUserMenuItemSelected={handleUserMenuSelection}
    >
      <Navbar>
        <NavbarItem path="/" title="Home" label="Home" />
        <NavbarItem path="/query" title="Query Records" label="Query Records" />
      </Navbar>
    </Header>
  );
};

export default HeaderNavbar;
