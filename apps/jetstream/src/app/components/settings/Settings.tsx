import type { UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { deleteUserProfile, getFullUserProfile, getUserProfile as getUserProfileUi, updateUserProfile } from '@jetstream/shared/data';
import { eraseCookies, useRollbar, useTitle } from '@jetstream/shared/ui-utils';
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
import { useAmplitude } from '@jetstream/ui-core';
import { fromAppState, userProfileState } from '@jetstream/ui/app-state';
import { dexieDataSync } from '@jetstream/ui/db';
import localforage from 'localforage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import LoggerConfig from './LoggerConfig';
import { SettingsDeleteAccount } from './SettingsDeleteAccount';

const HEIGHT_BUFFER = 170;

export const Settings = () => {
  useTitle(TITLES.SETTINGS);
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const setUserProfile = useSetRecoilState(userProfileState);
  const [fullUserProfile, setFullUserProfile] = useState<UserProfileUiWithIdentities>();
  const [modifiedUser, setModifiedUser] = useState<UserProfileUiWithIdentities>();

  const [resetSyncLoading, setResetSyncLoading] = useState(false);

  // TODO: Give option to disable
  const recordSyncEnabled = useRecoilValue(fromAppState.userProfileEntitlementState('recordSync'));

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
    }
  }

  function handleFrontdoorLoginChange(skipFrontdoorLogin: boolean) {
    const _modifiedUser = { ...modifiedUser, preferences: { skipFrontdoorLogin } } as UserProfileUiWithIdentities;
    setModifiedUser(_modifiedUser);
    handleSave(_modifiedUser);
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

  async function resetSync() {
    try {
      setResetSyncLoading(true);
      await dexieDataSync.reset(recordSyncEnabled);
    } catch (ex) {
      logger.error('[DB] Error resetting sync', ex);
    } finally {
      setResetSyncLoading(false);
      fireToast({
        message: 'Sync reset successfully!',
        type: 'success',
      });
    }
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
        {loading && <Spinner />}
        {loadingError && (
          <ScopedNotification theme="error" className="slds-m-vertical_medium">
            There was a problem getting your profile information. Make sure you have an internet connection and file a support ticket if you
            need additional assistance.
          </ScopedNotification>
        )}
        {fullUserProfile && (
          <div className="slds-m-top_medium">
            <h2 className="slds-text-heading_medium slds-m-vertical_small">General Settings</h2>
            <CheckboxToggle
              id="frontdoor-toggle"
              checked={modifiedUser?.preferences?.skipFrontdoorLogin || false}
              label="Don't Auto-Login on Link Clicks"
              labelHelp="When enabled, Jetstream will not attempt to auto-login to Salesforce when you click a link in Jetstream. If you have issues with multi-factor authentication when clicking links, enable this."
              onChange={handleFrontdoorLoginChange}
            />

            {recordSyncEnabled && (
              <div className="slds-m-top_large">
                <h2 className="slds-text-heading_medium slds-m-vertical_small">Data Sync</h2>
                {/* FIXME: add option for user to opt-out of this behavior (e.g. user preference?) */}
                {/* <CheckboxToggle
                  id="enable-record-sync-button"
                  checked={recordSyncEnabled}
                  label="Data Sync"
                  labelHelp="Enable to sync Query History with the Jetstream server."
                  onChange={(value) => setRecordSyncEnabled(value)}
                /> */}
                <button className="slds-button slds-button_text-destructive slds-m-top_small slds-is-relative" onClick={resetSync}>
                  {resetSyncLoading && <Spinner className="slds-spinner slds-spinner_small" />}
                  Reset Sync
                </button>
                <p className=" slds-m-top_small">
                  If you have having an issue with your data syncing from Jetstream to the Extension, you can reset your extension data to
                  pull in all your Jetstream data.
                </p>
              </div>
            )}

            <div className="slds-m-top_large">
              <h2 className="slds-text-heading_medium slds-m-vertical_small">Logging</h2>
              <LoggerConfig />
            </div>

            <SettingsDeleteAccount onDeleteAccount={handleDelete} />
          </div>
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default Settings;
