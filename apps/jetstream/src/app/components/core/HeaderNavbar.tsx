/** @jsx jsx */
import { jsx } from '@emotion/react';
import { FEATURE_FLAGS } from '@jetstream/shared/constants';
import { hasFeatureFlagAccess } from '@jetstream/shared/ui-utils';
import { UserProfileUi } from '@jetstream/types';
import { Header, Icon, Navbar, NavbarItem, NavbarMenuItems } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import Logo from '../../../assets/images/jetstream-logo-v1-200w.png';
import { applicationCookieState } from '../../app-state';
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
          items={[{ id: 'apex', path: '/apex', title: 'Anonymous Apex', label: 'Anonymous Apex' }]}
        />
        <NavbarItem path="/feedback" title="Feedback" label="Product Feedback" />
      </Navbar>
    </Header>
  );
};

export default HeaderNavbar;
