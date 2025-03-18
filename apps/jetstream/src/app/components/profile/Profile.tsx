import type { UserProfileAuthFactor, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import {
  getFullUserProfile,
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
  Grid,
  GridCol,
  Page,
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
  fireToast,
} from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { userProfileState } from '@jetstream/ui/app-state';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { Profile2fa } from './2fa/Profile2fa';
import { ProfileLinkedAccounts } from './ProfileLinkedAccounts';
import { ProfileUserProfile } from './ProfileUserProfile';
import { ProfileSessions } from './session/ProfileSessions';

const HEIGHT_BUFFER = 170;

export const Profile = () => {
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
  // const { linkAccount, unlinkAccount, loading: linkAccountLoading, providers } = useLinkAccount();
  // const {csrfToken} = useCsrfToken();

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

  async function handleSave() {
    try {
      if (!modifiedUser) {
        return;
      }
      setLoading(true);
      const userProfile = await updateUserProfile({ name: modifiedUser.name });
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

  function handleUpdatedAuthFactors(authFactors: UserProfileAuthFactor[]) {
    setFullUserProfile((prior) => {
      if (!prior) {
        return prior;
      }
      return { ...prior, authFactors };
    });
  }

  function handleCancelEdit() {
    setEditMode(false);
    fullUserProfile && setModifiedUser({ ...fullUserProfile });
  }

  async function handleSetPassword(password: string) {
    try {
      setFullUserProfile(await initPassword(password));
      trackEvent(ANALYTICS_KEYS.settings_password_action, { action: 'set-password' });
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
    setModifiedUser((priorValue) => ({ ...fullUserProfile, ...priorValue, ...modified } as UserProfileUiWithIdentities));
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
        {fullUserProfile && (
          <Grid wrap gutters>
            <GridCol size={12} sizeMedium={6}>
              <ProfileUserProfile
                fullUserProfile={fullUserProfile}
                name={modifiedUser?.name || ''}
                editMode={editMode}
                onEditMode={setEditMode}
                onChange={handleProfileChange}
                onSave={handleSave}
                onCancel={handleCancelEdit}
                onSetPassword={handleSetPassword}
                onResetPassword={handleResetPassword}
                onRemovePassword={handleRemovePassword}
              />

              <Profile2fa authFactors={fullUserProfile.authFactors} onUpdate={handleUpdatedAuthFactors} />

              <ProfileLinkedAccounts fullUserProfile={fullUserProfile} onUserProfilesChange={setFullUserProfile} />
            </GridCol>

            <GridCol size={12} sizeMedium={6}>
              <ProfileSessions />
            </GridCol>
          </Grid>
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default Profile;
