/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { UserProfileUi } from '@jetstream/types';
import { Header, Navbar, NavbarItem, Icon } from '@jetstream/ui';
import Logo from '../../../assets/images/jetstream-logo-v1-200w.png';
import OrgsDropdown from '../orgs/OrgsDropdown';
import { Fragment, FunctionComponent } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';
import Jobs from './jobs/Jobs';
import { Link } from 'react-router-dom';
import { hasFeatureFlagAccess } from '@jetstream/shared/ui-utils';
import { FEATURE_FLAGS } from '@jetstream/shared/constants';

export interface HeaderNavbarProps {
  userProfile: UserProfileUi;
  featureFlags: Set<string>;
}

function logout(serverUrl: string) {
  const logoutUrl = `${serverUrl}/oauth/logout`;
  // eslint-disable-next-line no-restricted-globals
  location.href = logoutUrl;
}

export const HeaderNavbar: FunctionComponent<HeaderNavbarProps> = ({ userProfile, featureFlags }) => {
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
      userMenuItems={[{ id: 'nav-user-logout', value: 'Logout', subheader: userProfile?.email, icon: { type: 'utility', icon: 'logout' } }]}
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
        {hasFeatureFlagAccess(featureFlags, FEATURE_FLAGS.QUERY) && (
          <NavbarItem path="/query" title="Query Records" label="Query Records" />
        )}
        {hasFeatureFlagAccess(featureFlags, FEATURE_FLAGS.AUTOMATION_CONTROL) && (
          <Fragment>
            <NavbarItem path="/automation-control" title="Automation Control" label="Automation Control (Object List)" />
            <NavbarItem path="/automation-control-2" title="Automation Control" label="Automation Control (Tree Grid)" />
            <NavbarItem path="/automation-control-3" title="Automation Control" label="Automation Control (Vertical Tabs)" />
          </Fragment>
        )}
      </Navbar>
    </Header>
  );
};

export default HeaderNavbar;
