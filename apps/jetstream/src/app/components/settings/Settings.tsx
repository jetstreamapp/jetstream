import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { deleteUserProfile, updateUserProfile } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { eraseCookies, tracker, useTitle } from '@jetstream/shared/ui-utils';
import { SoqlQueryFormatOptionsSchema, UserProfileUi } from '@jetstream/types';
import { AutoFullHeightContainer, fireToast, Page, PageHeader, PageHeaderRow, PageHeaderTitle, Spinner } from '@jetstream/ui';
import {
  AccountSummary,
  AppearanceSetting,
  DataHistorySettingsSection,
  DiagnosticLoggingSetting,
  getPreferencesToRestore,
  HistorySyncSettings,
  RecentObjectsSetting,
  SalesforceAutoLoginSetting,
  SalesforceCanvasOrgs,
  SettingsGroup,
  SettingsLayout,
  SettingsNavItem,
  SettingsSection,
  SoqlQueryFormatSettings,
  useAmplitude,
} from '@jetstream/ui-core';
import { fromAppState, useFeatureFlag, userProfileState, userProfileSyncState } from '@jetstream/ui/app-state';
import { deleteAllDataHistoryFiles } from '@jetstream/ui/data-history';
import { deleteAllLocalData } from '@jetstream/ui/db';
import { useAtomValue } from 'jotai';
import { useAtomCallback } from 'jotai/utils';
import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AnalyticsTrackingSetting } from './AnalyticsTrackingSetting';
import { SettingsDeleteAccount } from './SettingsDeleteAccount';

const HEIGHT_BUFFER = 170;

type UserPreferences = UserProfileUi['preferences'];

export const Settings = () => {
  useTitle(TITLES.SETTINGS);
  const { trackEvent } = useAmplitude();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const userProfile = useAtomValue(userProfileState);
  const ability = useAtomValue(fromAppState.abilityState);
  const { preferences } = userProfile;

  const recordSyncEntitled = ability.can('access', 'RecordSync');
  // Canvas org management: gated by the feature flag + entitlement, and only for individual (non-team)
  // users — team members manage authorized orgs from the Team Dashboard.
  const canvasEnabled = useFeatureFlag('salesforce-canvas');
  const showCanvasOrgs = canvasEnabled && userProfile.entitlements.salesforceCanvas && !userProfile.teamMembership;
  const showDeleteAccount = !userProfile.teamMembership;

  const sections: SettingsNavItem[] = [
    { id: 'account', label: 'Account' },
    { id: 'general', label: 'General' },
    { id: 'query', label: 'Query' },
    { id: 'data-storage', label: 'Data & Storage' },
    { id: 'privacy-diagnostics', label: 'Privacy & Diagnostics' },
    ...(showCanvasOrgs ? [{ id: 'integrations', label: 'Integrations' }] : []),
    ...(showDeleteAccount ? [{ id: 'danger-zone', label: 'Danger Zone' }] : []),
  ];

  // Reads the resolved profile at call time - a functional update on `userProfileState` would receive the
  // atom's initial Promise rather than the profile
  const mergePreferences = useAtomCallback(
    useCallback((get, set, changes: Partial<UserPreferences>) => {
      const currentProfile = get(userProfileSyncState);
      set(userProfileState, { ...currentProfile, preferences: { ...currentProfile.preferences, ...changes } });
    }, []),
  );

  // What the server has confirmed - a failed save rolls back to this, except for settings changed again since
  const savedPreferencesRef = useRef(preferences);
  const rollbackPreferences = useAtomCallback(
    useCallback((get, _set, changes: Partial<UserPreferences>) => {
      return getPreferencesToRestore(get(userProfileSyncState).preferences, changes, savedPreferencesRef.current);
    }, []),
  );

  // Saves are sent one at a time so they reach the server in the order they were made - two quick changes to the
  // same setting could otherwise arrive in reverse and leave the older value saved
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  /**
   * Applies the change right away and saves it in the background. The server writes only the preferences it
   * is sent, so only the changed keys are sent - and only those keys are rolled back if the save fails.
   */
  function savePreferences(changes: Partial<UserPreferences>) {
    mergePreferences(changes);
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        await updateUserProfile({ preferences: changes });
        savedPreferencesRef.current = { ...savedPreferencesRef.current, ...changes };
        trackEvent(ANALYTICS_KEYS.settings_update_user);
      } catch (ex) {
        mergePreferences(rollbackPreferences(changes));
        fireToast({
          message: 'There was a problem saving your settings. Try again or file a support ticket for assistance.',
          type: 'error',
        });
        tracker.error('Settings: Error updating user', ex);
      }
    });
  }

  async function handleDeleteAccount(reason?: string) {
    /**
     * FUTURE:
     * Send email from server letting user know we are sorry to see them go!
     */
    trackEvent(ANALYTICS_KEYS.settings_delete_account, { reason });
    setDeletingAccount(true);
    try {
      await deleteUserProfile(reason);
    } catch {
      // error deleting everything from server
      fireToast({
        message: 'There was a problem deleting your account. Try again or file a support ticket for assistance.',
        type: 'error',
      });
      setDeletingAccount(false);
      return;
    }

    // Only wipe local data once the server-side delete succeeded — deleteAllLocalData unbinds the
    // local stores, so doing it before a delete that then fails would leave the still-running app
    // unable to read local storage. The redirect below immediately replaces the page.
    // Data history payload files live outside the databases deleteAllLocalData removes and are rooted
    // under the user scope it unbinds, so they go first. Both are best-effort and never throw.
    await deleteAllDataHistoryFiles();
    try {
      await deleteAllLocalData(userProfile.id);
    } catch {
      // error clearing local storage
    }
    eraseCookies();
    window.location.href = '/goodbye/';
  }

  return (
    <Page testId="settings-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'settings' }} label="Settings" docsPath={APP_ROUTES.SETTINGS.DOCS} />
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {deletingAccount && <Spinner />}
        <SettingsLayout sections={sections}>
          <SettingsSection id="account" title="Account">
            <AccountSummary
              userProfile={userProfile}
              actions={
                <>
                  {ability.can('read', 'Profile') && (
                    <Link className="slds-button slds-button_neutral" to={APP_ROUTES.PROFILE.ROUTE}>
                      Edit Profile
                    </Link>
                  )}
                  {ability.can('read', 'Team') && (
                    <Link className="slds-button slds-button_neutral" to={APP_ROUTES.TEAM_DASHBOARD.ROUTE}>
                      Team Dashboard
                    </Link>
                  )}
                </>
              }
            />
          </SettingsSection>

          <SettingsSection id="general" title="General">
            <SettingsGroup>
              <AppearanceSetting />
              <SalesforceAutoLoginSetting
                skipFrontdoorLogin={preferences?.skipFrontdoorLogin ?? false}
                onChange={(skipFrontdoorLogin) => savePreferences({ skipFrontdoorLogin })}
              />
            </SettingsGroup>
          </SettingsSection>

          <SettingsSection id="query" title="Query">
            <SoqlQueryFormatSettings
              value={preferences?.soqlQueryFormatOptions ?? SoqlQueryFormatOptionsSchema.parse({})}
              onChange={(soqlQueryFormatOptions) => savePreferences({ soqlQueryFormatOptions })}
            />
          </SettingsSection>

          <SettingsSection id="data-storage" title="Data & Storage">
            <DataHistorySettingsSection />
            {recordSyncEntitled && (
              <SettingsGroup title="Sync">
                <HistorySyncSettings
                  enabled={preferences?.recordSyncEnabled ?? true}
                  onChange={(recordSyncEnabled) => savePreferences({ recordSyncEnabled })}
                />
              </SettingsGroup>
            )}
            <SettingsGroup>
              <RecentObjectsSetting />
            </SettingsGroup>
          </SettingsSection>

          <SettingsSection id="privacy-diagnostics" title="Privacy & Diagnostics">
            <SettingsGroup>
              <AnalyticsTrackingSetting />
              <DiagnosticLoggingSetting />
            </SettingsGroup>
          </SettingsSection>

          {showCanvasOrgs && (
            <SettingsSection id="integrations" title="Integrations">
              <SalesforceCanvasOrgs scope={{ type: 'user' }} />
            </SettingsSection>
          )}

          {showDeleteAccount && (
            <SettingsSection id="danger-zone" title="Danger Zone">
              <SettingsDeleteAccount onDeleteAccount={handleDeleteAccount} />
            </SettingsSection>
          )}
        </SettingsLayout>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default Settings;
