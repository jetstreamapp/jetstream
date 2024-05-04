import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import {
  deleteUserProfile,
  getFullUserProfile,
  getUserProfile as getUserProfileUi,
  resendVerificationEmail,
  updateUserProfile,
} from '@jetstream/shared/data';
import { eraseCookies, useRollbar, useTitle } from '@jetstream/shared/ui-utils';
import {
  Auth0ConnectionName,
  Maybe,
  UserProfileAuth0Identity,
  UserProfileAuth0Ui,
  UserProfileUi,
  UserProfileUiWithIdentities,
} from '@jetstream/types';
import {
  AutoFullHeightContainer,
  CheckboxToggle,
  Page,
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
  fireToast,
} from '@jetstream/ui';
import { userProfileState } from '@jetstream/ui-core';
import localforage from 'localforage';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { useAmplitude } from '@jetstream/ui-core';
import LoggerConfig from './LoggerConfig';
import SettingsDeleteAccount from './SettingsDeleteAccount';
import SettingsLinkedAccounts from './SettingsLinkedAccounts';
import SettingsUserProfile from './SettingsUserProfile';
import { useLinkAccount } from './useLinkAccount';

const HEIGHT_BUFFER = 170;

export interface SettingsProps {
  userProfile: Maybe<UserProfileUi>;
  featureFlags: Set<string>;
}

export const Settings: FunctionComponent<SettingsProps> = ({ userProfile, featureFlags }) => {
  useTitle(TITLES.SETTINGS);
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const setUserProfile = useSetRecoilState(userProfileState);
  const [fullUserProfile, setFullUserProfile] = useState<UserProfileUiWithIdentities>();
  const [modifiedUser, setModifiedUser] = useState<UserProfileUiWithIdentities>();
  const [editMode, setEditMode] = useState(false);
  const { linkAccount, unlinkAccount, loading: linkAccountLoading } = useLinkAccount();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const getUserProfile = useCallback(async () => {
    setLoading(true);
    try {
      setLoadingError(false);
      setFullUserProfile(await getFullUserProfile());
    } catch (ex) {
      rollbar.error('Settings: Error fetching user', { stack: ex.stack, message: ex.message });
      setLoadingError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fullUserProfile) {
      setModifiedUser({ ...fullUserProfile });
    }
  }, [fullUserProfile]);

  async function handleSave(_modifiedUser?: UserProfileUiWithIdentities) {
    try {
      _modifiedUser = _modifiedUser || modifiedUser;
      if (!_modifiedUser) {
        return;
      }
      setLoading(true);
      const userProfile = await updateUserProfile(_modifiedUser);
      setUserProfile(await getUserProfileUi());
      setFullUserProfile(userProfile);
      trackEvent(ANALYTICS_KEYS.settings_update_user);
    } catch (ex) {
      logger.warn('Error updating user', ex);
      fireToast({
        message: 'There was a problem updating your user. Try again or file a support ticket for assistance.',
        type: 'error',
      });
      rollbar.error('Settings: Error updating user', { stack: ex.stack, message: ex.message });
    } finally {
      setLoading(false);
      setEditMode(false);
    }
  }

  function handleCancelEdit() {
    setEditMode(false);
    fullUserProfile && setModifiedUser({ ...fullUserProfile });
  }

  async function handleUnlinkAccount(identity: UserProfileAuth0Identity) {
    try {
      const userProfile = await unlinkAccount(identity);
      setFullUserProfile(userProfile);
      trackEvent(ANALYTICS_KEYS.settings_unlink_account, { provider: identity.provider, userId: identity.user_id });
    } catch (ex) {
      fireToast({
        message: 'There was a problem unlinking your account. Try again or file a support ticket for assistance.',
        type: 'error',
      });
      rollbar.error('Settings: Error unlinking account', { stack: ex.stack, message: ex.message });
    }
  }

  async function handleOnResendVerificationEmail(identity: UserProfileAuth0Identity) {
    try {
      await resendVerificationEmail({ provider: identity.provider, userId: identity.user_id });
      fireToast({
        message: 'You have been sent an email to verify your email address.',
        type: 'success',
      });
      trackEvent(ANALYTICS_KEYS.settings_resend_email_verification, { provider: identity.provider, userId: identity.user_id });
    } catch (ex) {
      fireToast({
        message: 'There was a problem sending the email verification. Try again or file a support ticket for assistance.',
        type: 'error',
      });
      rollbar.error('Settings: Error sending verification email', { stack: ex.stack, message: ex.message });
    }
  }

  function handleProfileChange(modified: Pick<UserProfileAuth0Ui, 'name'>) {
    setModifiedUser((priorValue) => ({ ...fullUserProfile, ...priorValue, ...modified } as UserProfileUiWithIdentities));
  }

  function handleFrontdoorLoginChange(skipFrontdoorLogin: boolean) {
    const _modifiedUser = { ...modifiedUser, preferences: { skipFrontdoorLogin } } as UserProfileUiWithIdentities;
    setModifiedUser(_modifiedUser);
    handleSave(_modifiedUser);
  }

  function handleLinkAccount(connection: Auth0ConnectionName) {
    linkAccount(connection, getUserProfile);
    trackEvent(ANALYTICS_KEYS.settings_link_account, { provider: connection });
  }

  async function handleDelete(reason: string) {
    /**
     * FUTURE:
     * Send email from server letting user know we are sorry to see them go!
     */
    trackEvent(ANALYTICS_KEYS.settings_delete_account, { reason });
    setLoading(true);
    try {
      localStorage.clear();
      await localforage.clear();
    } catch (ex) {
      // error clearing local storage
    }

    try {
      await deleteUserProfile(reason);
    } catch (ex) {
      // error deleting everything from server
    }

    eraseCookies();

    window.location.href = '/goodbye/';
  }

  return (
    <Page testId="settings-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'settings' }} label="Settings" />
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {/* Settings */}
        {(loading || linkAccountLoading) && <Spinner />}
        {loadingError && (
          <ScopedNotification theme="error" className="slds-m-vertical_medium">
            There was a problem getting your profile information. Make sure you have an internet connection and file a support ticket if you
            need additional assistance.
          </ScopedNotification>
        )}
        {fullUserProfile && (
          <Fragment>
            <SettingsUserProfile
              fullUserProfile={fullUserProfile}
              name={modifiedUser?.name || ''}
              editMode={editMode}
              onEditMode={setEditMode}
              onChange={handleProfileChange}
              onSave={handleSave}
              onCancel={handleCancelEdit}
            />

            <CheckboxToggle
              id="frontdoor-toggle"
              checked={modifiedUser?.preferences?.skipFrontdoorLogin || false}
              label="Don't Auto-Login on Link Clicks"
              labelHelp="When enabled, Jetstream will not attempt to auto-login to Salesforce when you click a link in Jetstream. If you have issues with multi-factor authentication when clicking links, enable this."
              onChange={handleFrontdoorLoginChange}
            />

            <SettingsLinkedAccounts
              fullUserProfile={fullUserProfile}
              onLink={handleLinkAccount}
              onUnlink={handleUnlinkAccount}
              onResendVerificationEmail={handleOnResendVerificationEmail}
            />

            <div className="slds-m-top_medium">
              <LoggerConfig />
            </div>

            <SettingsDeleteAccount onDeleteAccount={handleDelete} />
          </Fragment>
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default Settings;
