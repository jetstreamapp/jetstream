import type { UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { deleteUserProfile, getFullUserProfile, getUserProfile as getUserProfileUi, updateUserProfile } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
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
import { dexieDataSync, recentHistoryItemsDb } from '@jetstream/ui/db';
import { useAtom, useAtomValue } from 'jotai';
import localforage from 'localforage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalyticsTrackingSetting } from './AnalyticsTrackingSetting';
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
  const [userProfile, setUserProfile] = useAtom(userProfileState);
  const ability = useAtomValue(fromAppState.abilityState);
  const [fullUserProfile, setFullUserProfile] = useState<UserProfileUiWithIdentities>();
  const [modifiedUser, setModifiedUser] = useState<UserProfileUiWithIdentities>();
  const selectedOrg = useAtomValue(fromAppState.selectedOrgState);

  const [resetSyncLoading, setResetSyncLoading] = useState(false);
  const [recentRecentItemLoading, setRecentRecentItemLoading] = useState<false | 'all' | 'current'>(false);

  // TODO: Give option to disable
  const recordSyncEnabled = ability.can('access', 'RecordSync');

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
      const userProfile = await updateUserProfile({
        name: _modifiedUser.name,
        preferences: { ..._modifiedUser.preferences },
      });
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

  function handleRecordSyncChange(recordSyncEnabled: boolean) {
    const _modifiedUser = { ...modifiedUser, preferences: { recordSyncEnabled } } as UserProfileUiWithIdentities;
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
    } catch {
      // error clearing local storage
    }

    try {
      await deleteUserProfile(reason);
      eraseCookies();

      window.location.href = '/goodbye/';
    } catch {
      // error deleting everything from server
      fireToast({
        message: 'There was a problem deleting your account. Try again or file a support ticket for assistance.',
        type: 'error',
      });
    }
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
        message: 'Sync reset successfully',
        type: 'success',
      });
    }
  }

  async function resetRecentHistoryItems(type: 'all' | 'current') {
    try {
      setRecentRecentItemLoading(type);
      if (type === 'current' && selectedOrg) {
        await recentHistoryItemsDb.clearRecentHistoryItemsForCurrentOrg(selectedOrg.uniqueId);
      } else if (type === 'all') {
        await recentHistoryItemsDb.clearRecentHistoryItemsForAllOrgs();
      }
      fireToast({
        message: 'History reset successfully',
        type: 'success',
      });
    } catch (ex) {
      logger.error('[DB] Error resetting sync', ex);
      fireToast({
        message: 'There was a problem resetting your history. Try again or file a support ticket for assistance.',
        type: 'warning',
      });
    } finally {
      setRecentRecentItemLoading(false);
    }
  }

  return (
    <Page testId="settings-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'settings' }} label="Settings" docsPath={APP_ROUTES.SETTINGS.DOCS} />
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
              checked={modifiedUser?.preferences?.skipFrontdoorLogin ?? false}
              label="Don't Auto-Login on Link Clicks"
              labelHelp="When enabled, Jetstream will not attempt to auto-login to Salesforce when you click a link in Jetstream. If you have issues with multi-factor authentication when clicking links, enable this."
              onChange={handleFrontdoorLoginChange}
            />

            {recordSyncEnabled && (
              <div className="slds-m-top_large">
                <h2 className="slds-text-heading_medium slds-m-vertical_small">History Data Sync</h2>
                <CheckboxToggle
                  id="enable-record-sync-button"
                  checked={modifiedUser?.preferences?.recordSyncEnabled ?? true}
                  label="Data Sync"
                  labelHelp="Enable to sync Query History with the Jetstream server."
                  onChange={handleRecordSyncChange}
                />
                <button className="slds-button slds-button_text-destructive slds-m-top_small slds-is-relative" onClick={resetSync}>
                  {resetSyncLoading && <Spinner className="slds-spinner slds-spinner_small" />}
                  Reset Sync
                </button>
                <p className=" slds-m-top_small">
                  You can reset your sync history, this will push and pull Query History data from the Jetstream server to make sure both
                  are in sync.
                </p>
              </div>
            )}

            <div className="slds-m-top_large">
              <h2 className="slds-text-heading_medium slds-m-top_x-small">Recent Objects</h2>
              <button
                className="slds-button slds-button_text-destructive slds-m-top_small slds-is-relative"
                disabled={!selectedOrg}
                onClick={() => resetRecentHistoryItems('current')}
              >
                {recentRecentItemLoading === 'current' && <Spinner className="slds-spinner slds-spinner_small" />}
                Reset for Current Org
              </button>
              <button
                className="slds-button slds-button_text-destructive slds-m-top_small slds-is-relative"
                onClick={() => resetRecentHistoryItems('all')}
              >
                {recentRecentItemLoading === 'all' && <Spinner className="slds-spinner slds-spinner_small" />}
                Reset for All Orgs
              </button>
              <p className=" slds-m-top_small">
                Reset your list of recent objects. This will clear the list of objects you have recently viewed in Jetstream.
              </p>
            </div>

            <div className="slds-m-top_large">
              <h2 className="slds-text-heading_medium slds-m-vertical_small">Logging</h2>
              <LoggerConfig />
            </div>

            <div className="slds-m-top_large">
              <h2 className="slds-text-heading_medium slds-m-vertical_small">Analytics</h2>
              <AnalyticsTrackingSetting />
            </div>

            {!userProfile.teamMembership && <SettingsDeleteAccount onDeleteAccount={handleDelete} />}
          </div>
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default Settings;
