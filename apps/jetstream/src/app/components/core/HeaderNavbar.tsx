/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { UserProfileUi } from '@jetstream/types';
import { Header, Navbar, NavbarItem, Icon } from '@jetstream/ui';
import Logo from '../../../assets/images/jetstream-logo-v1-200w.png';
import OrgsDropdown from '../orgs/OrgsDropdown';
import { FunctionComponent } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';
import Jobs from './jobs/Jobs';
import { Link } from 'react-router-dom';

export interface HeaderNavbarProps {
  userProfile: UserProfileUi;
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
      rightHandMenuItems={[
        <Link
          className="slds-button slds-button_icon slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__help slds-global-actions__item-action"
          to="/feedback"
        >
          <Icon type="utility" icon="help" className="slds-button__icon slds-global-header__icon" omitContainer />
        </Link>,
        <Jobs />,
      ]}
      onUserMenuItemSelected={handleUserMenuSelection}
    >
      <Navbar>
        {/* TODO: home page */}
        {/* <NavbarItem path="/" title="Home" label="Home" /> */}
        <NavbarItem path="/query" title="Query Records" label="Query Records" />
      </Navbar>
    </Header>
  );
};

export default HeaderNavbar;
