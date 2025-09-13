import { getLoginConfigurationAbility, LoginConfigAbility } from '@jetstream/acl';
import type { LoginConfigurationUI, UserProfileAuthFactor, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import {
  getFullUserProfile,
  getLoginConfiguration,
  getUserProfile as getUserProfileUi,
  initPassword,
  initResetPassword,
  removePassword,
  updateUserProfile,
} from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useRollbar, useTitle } from '@jetstream/shared/ui-utils';
import {
  AutoFullHeightContainer,
  fireToast,
  Grid,
  GridCol,
  Page,
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { userProfileState } from '@jetstream/ui/app-state';
import { useAtom } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { Profile2fa } from './2fa/Profile2fa';
import { ProfileLinkedAccounts } from './ProfileLinkedAccounts';
import { ProfileUserProfile } from './ProfileUserProfile';
import { ProfileLoginActivity } from './session/ProfileLoginActivity';
import { ProfileSessions } from './session/ProfileSessions';
import { useSessionData } from './useSessionData';

const HEIGHT_BUFFER = 170;

export const Profile = () => {
  useTitle(TITLES.PROFILE);
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [userProfile, setUserProfile] = useAtom(userProfileState);
  const [fullUserProfile, setFullUserProfile] = useState<UserProfileUiWithIdentities>();
  const [loginConfiguration, setLoginConfiguration] = useState<LoginConfigurationUI | null>(null);
  const [modifiedUser, setModifiedUser] = useState<UserProfileUiWithIdentities>();
  const [loginConfigAbility, setLoginConfigAbility] = useState<LoginConfigAbility>();
  const [editMode, setEditMode] = useState(false);

  const sessionData = useSessionData();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setLoadingError(false);
        const loginConfiguration = await getLoginConfiguration();
        setLoginConfiguration(loginConfiguration);
        setFullUserProfile(await getFullUserProfile());
        setLoginConfigAbility(getLoginConfigurationAbility({ user: userProfile, loginConfiguration }));
      } catch (ex) {
        rollbar.error('Settings: Error fetching user', { stack: ex.stack, message: ex.message });
        setLoadingError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [rollbar]);

  useEffect(() => {
    if (fullUserProfile) {
      setModifiedUser({ ...fullUserProfile });
    }
  }, [fullUserProfile]);

  async function handleSave() {
    try {
      if (!modifiedUser) {
        return;
      }
      setLoading(true);
      const userProfile = await updateUserProfile({ name: modifiedUser.name });
      setUserProfile(await getUserProfileUi());
      setFullUserProfile(userProfile);
      sessionData.getSessions();
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

  function handleUpdatedAuthFactors(authFactors: UserProfileAuthFactor[]) {
    setFullUserProfile((prior) => {
      if (!prior) {
        return prior;
      }
      return { ...prior, authFactors };
    });
    sessionData.getSessions();
  }

  function handleCancelEdit() {
    setEditMode(false);
    fullUserProfile && setModifiedUser({ ...fullUserProfile });
  }

  async function handleSetPassword(password: string) {
    try {
      setFullUserProfile(await initPassword(password));
      trackEvent(ANALYTICS_KEYS.settings_password_action, { action: 'set-password' });
      sessionData.getSessions();
    } catch (ex) {
      fireToast({
        message: ex.message || 'There was a problem resetting your password. Try again or file a support ticket for assistance.',
        type: 'error',
      });
      rollbar.error('Settings: Error setting password', { stack: ex.stack, message: ex.message });
    }
  }

  async function handleResetPassword() {
    try {
      await initResetPassword();
      sessionData.getSessions();
      trackEvent(ANALYTICS_KEYS.settings_password_action, { action: 'reset-password' });
      fireToast({
        message: 'An email has been sent to continue the password reset process.',
        type: 'success',
      });
    } catch (ex) {
      fireToast({
        message: ex.message || 'There was a problem resetting your password. Try again or file a support ticket for assistance.',
        type: 'error',
      });
      rollbar.error('Settings: Error resetting password', { stack: ex.stack, message: ex.message });
    }
  }

  async function handleRemovePassword() {
    try {
      setFullUserProfile(await removePassword());
      sessionData.getSessions();
      trackEvent(ANALYTICS_KEYS.settings_password_action, { action: 'remove-password' });
    } catch (ex) {
      fireToast({
        message: 'There was a problem removing your password. Try again or file a support ticket for assistance.',
        type: 'error',
      });
      rollbar.error('Settings: Error removing password', { stack: ex.stack, message: ex.message });
    }
  }

  function handleProfileChange(modified: { name: string }) {
    setModifiedUser((priorValue) => ({ ...fullUserProfile, ...priorValue, ...modified }) as UserProfileUiWithIdentities);
  }

  return (
    <Page testId="settings-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'user' }} label="Profile" docsPath={APP_ROUTES.PROFILE.DOCS} />
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-around_small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {/* Settings */}
        {loading && <Spinner />}
        {loadingError && (
          <ScopedNotification theme="error" className="slds-m-vertical_medium">
            There was a problem getting your profile information. Make sure you have an internet connection and file a support ticket if you
            need additional assistance.
          </ScopedNotification>
        )}
        {fullUserProfile && loginConfigAbility && (
          <Grid wrap gutters>
            <GridCol className="slds-m-bottom_large" size={12} sizeMedium={6} sizeLarge={4}>
              <ProfileUserProfile
                fullUserProfile={fullUserProfile}
                name={modifiedUser?.name || ''}
                editMode={editMode}
                loginConfigAbility={loginConfigAbility}
                onEditMode={setEditMode}
                onChange={handleProfileChange}
                onSave={handleSave}
                onCancel={handleCancelEdit}
                onSetPassword={handleSetPassword}
                onResetPassword={handleResetPassword}
                onRemovePassword={handleRemovePassword}
              />

              <Profile2fa
                authFactors={fullUserProfile.authFactors}
                loginConfiguration={loginConfiguration}
                loginConfigAbility={loginConfigAbility}
                onUpdate={handleUpdatedAuthFactors}
              />

              <ProfileLinkedAccounts
                fullUserProfile={fullUserProfile}
                loginConfiguration={loginConfiguration}
                loginConfigAbility={loginConfigAbility}
                onUserProfilesChange={setFullUserProfile}
              />
            </GridCol>

            <GridCol className="slds-m-bottom_large" size={12} sizeMedium={6} sizeLarge={4}>
              <ProfileSessions sessionData={sessionData} />
            </GridCol>

            <GridCol className="slds-m-bottom_large" size={12} sizeMedium={6} sizeLarge={4}>
              <ProfileLoginActivity sessionData={sessionData} />
            </GridCol>
          </Grid>
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default Profile;
