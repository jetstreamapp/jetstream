import { css } from '@emotion/react';
import { DesktopUserPreferences, UpdatePolicy } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { isEscapeKey, useGlobalEventHandler, useTitle } from '@jetstream/shared/ui-utils';
import { SoqlQueryFormatOptionsSchema } from '@jetstream/types';
import { AutoFullHeightContainer, fireToast, Icon, Page } from '@jetstream/ui';
import {
  AccountSummary,
  AppearanceSetting,
  DataHistorySettingsSection,
  DiagnosticLoggingSetting,
  getPreferencesToRestore,
  HistorySyncSettings,
  RecentObjectsSetting,
  SalesforceAutoLoginSetting,
  SettingsGroup,
  SettingsLayout,
  SettingsNavItem,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
  SoqlQueryFormatSettings,
  useAmplitude,
} from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue } from 'jotai';
import { useAtomCallback } from 'jotai/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { desktopUserPreferences, desktopUserPreferencesSyncState } from '../core/AppDesktopState';

const HEIGHT_BUFFER = 170;

const SECTIONS: SettingsNavItem[] = [
  { id: 'account', label: 'Account' },
  { id: 'general', label: 'General' },
  { id: 'query', label: 'Query' },
  { id: 'data-storage', label: 'Data & Storage' },
  { id: 'diagnostics', label: 'Diagnostics' },
];

// The title is centered like a native macOS window title, which keeps it clear of the traffic light
// buttons that sit over the left of this bar (the mac window has a hidden title bar)
const titleBarCss = css`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  min-height: 50px;
  width: 100%;
  padding: 0 0.5rem;
  background-color: var(--slds-g-color-surface-container-1, #fff);
  border-bottom: 1px solid var(--slds-g-color-border-1, #e5e5e5);
  app-region: drag;
`;

const downloadPathCss = css`
  word-break: break-all;
`;

export const Settings = () => {
  useTitle(TITLES.SETTINGS);
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useAtom(fromAppState.userProfileState);
  const { serverUrl } = useAtomValue(fromAppState.applicationCookieState);
  const { version } = useAtomValue(fromAppState.appInfoState);
  const ability = useAtomValue(fromAppState.abilityState);
  const preferences = useAtomValue(desktopUserPreferences);
  const [updatePolicy, setUpdatePolicy] = useState<UpdatePolicy | null>(null);

  const recordSyncEntitled = ability.can('access', 'RecordSync');
  const downloadPath = preferences?.fileDownload?.downloadPath;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    window.electronAPI
      ?.getUpdatePolicy()
      .then((policy) => {
        if (isMounted.current) {
          setUpdatePolicy(policy);
        }
      })
      // Leaving the policy null just renders the toggle as an ordinary editable setting, which is
      // the right fallback - better than an unhandled rejection over a purely informational read.
      .catch((ex) => logger.warn('Unable to read the update policy', ex));
  }, []);

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (isEscapeKey(event as any)) {
        event.stopPropagation();
        event.preventDefault();
        navigate(-1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useGlobalEventHandler('keydown', onKeydown);

  // Shows the change immediately, so controls reflect a click before the save finishes
  const mergePreferences = useAtomCallback(
    useCallback((get, set, changes: Partial<DesktopUserPreferences>) => {
      set(desktopUserPreferences, { ...get(desktopUserPreferencesSyncState), ...changes });
    }, []),
  );

  // What the main process has saved - once a save settles, the settings it tried to change show this again,
  // except for settings changed again since
  const savedPreferencesRef = useRef(preferences);
  const showSavedPreferences = useAtomCallback(
    useCallback((get, set, changes: Partial<DesktopUserPreferences>) => {
      const currentPreferences = get(desktopUserPreferencesSyncState);
      set(desktopUserPreferences, {
        ...currentPreferences,
        ...getPreferencesToRestore(currentPreferences, changes, savedPreferencesRef.current),
      });
    }, []),
  );

  // Saves carry only the changed settings and are sent one at a time - the main process merges each one into
  // what it has stored, so quick changes (or settings the main process owns) cannot overwrite each other
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  function savePreferences(changes: Partial<DesktopUserPreferences>) {
    mergePreferences(changes);
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      if (!window.electronAPI) {
        return;
      }
      try {
        const savedPreferences = await window.electronAPI.setPreferences(changes);
        savedPreferencesRef.current = savedPreferences;
        // The main process logs a change it cannot store and resolves anyway, so show what it actually kept
        showSavedPreferences(changes);
        setUserProfile((prev) => ({
          ...prev,
          preferences: savedPreferences,
        }));
        trackEvent(ANALYTICS_KEYS.settings_update_user);
      } catch (ex) {
        showSavedPreferences(changes);
        logger.warn('Error updating user settings', ex);
        fireToast({
          message: 'There was a problem updating your settings. Try again or file a support ticket for assistance.',
          type: 'error',
        });
      }
    });
  }

  async function handleChooseDownloadFolder() {
    const selectedPath = await window.electronAPI?.selectFolder();
    // Nothing is returned when the folder selection is canceled
    if (selectedPath) {
      savePreferences({ fileDownload: { omitPrompt: true, downloadPath: selectedPath } });
    }
  }

  /** The desktop app has no profile or team pages of its own, so these open the web app in the default browser */
  function openWebAppPage(route: string) {
    // `/app` is the web client's router basename
    window.open(`${serverUrl}/app${route}`, '_blank');
  }

  let updatePolicyNote: string | null = null;
  if (updatePolicy?.managed) {
    updatePolicyNote =
      updatePolicy.source === 'portable'
        ? 'The portable version does not update itself. Download a new copy to move to a newer version.'
        : 'Updates are managed by your organization and cannot be changed here.';
  } else if (updatePolicy?.perMachineInstall) {
    updatePolicyNote =
      'Jetstream is installed for all users on this computer, so installing an update requires administrator approval. Updates are never installed automatically - you will be asked first.';
  }

  // TODO: animate in and out like discord
  return (
    <div
      css={css`
        position: fixed;
        width: 100%;
        top: 0;
        left: 0;
        z-index: 101;
      `}
    >
      <div css={titleBarCss}>
        <h1
          className="slds-text-heading_medium"
          css={css`
            grid-column: 2;
          `}
        >
          Settings
        </h1>
        <button
          css={css`
            justify-self: end;
            app-region: no-drag;
          `}
          className="slds-button slds-button_icon slds-button_icon-large"
          title="Close"
          onClick={() => navigate(APP_ROUTES.HOME.ROUTE)}
        >
          <Icon type="utility" icon="close" className="slds-button__icon slds-button__icon_large" omitContainer />
          <span className="slds-assistive-text">Close</span>
        </button>
      </div>
      <Page testId="settings-page">
        <AutoFullHeightContainer className="slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
          <SettingsLayout sections={SECTIONS}>
            <SettingsSection id="account" title="Account">
              <AccountSummary
                userProfile={userProfile}
                actions={
                  <>
                    <button
                      className="slds-button slds-button_neutral"
                      title="Opens your Jetstream profile in your browser"
                      onClick={() => openWebAppPage(APP_ROUTES.PROFILE.ROUTE)}
                    >
                      Manage Account
                      <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_right" omitContainer />
                    </button>
                    {ability.can('read', 'Team') && (
                      <button
                        className="slds-button slds-button_neutral"
                        title="Opens the Team Dashboard in your browser"
                        onClick={() => openWebAppPage(APP_ROUTES.TEAM_DASHBOARD.ROUTE)}
                      >
                        Team Dashboard
                        <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_right" omitContainer />
                      </button>
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
                <SettingsToggleRow
                  id="auto-update-toggle"
                  title="Download updates automatically"
                  description="Jetstream checks for new versions in the background and downloads them. You can always update with File > Check for Updates."
                  details={updatePolicyNote && <p className="slds-text-body_small">{updatePolicyNote}</p>}
                  // A managed policy can pin updates on as well as off, so show what it decided rather than the stored preference
                  checked={updatePolicy?.managed ? updatePolicy.autoUpdateEnabled : (preferences?.autoUpdateEnabled ?? true)}
                  disabled={updatePolicy?.managed ?? false}
                  onChange={(autoUpdateEnabled) => savePreferences({ autoUpdateEnabled })}
                />
                <SettingsRow
                  id="setting-download-location"
                  title="Download location"
                  description={
                    downloadPath ? (
                      <>
                        Files are saved to <span css={downloadPathCss}>{downloadPath}</span> without asking.
                      </>
                    ) : (
                      'You are asked where to save each download.'
                    )
                  }
                >
                  <button className="slds-button slds-button_neutral" onClick={handleChooseDownloadFolder}>
                    {downloadPath ? 'Change Folder…' : 'Choose Folder…'}
                  </button>
                  {downloadPath && (
                    <button
                      className="slds-button slds-button_neutral"
                      onClick={() => savePreferences({ fileDownload: { omitPrompt: false, downloadPath: '' } })}
                    >
                      Ask Every Time
                    </button>
                  )}
                </SettingsRow>
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
                    enabled={preferences?.recordSyncEnabled ?? false}
                    onChange={(recordSyncEnabled) => savePreferences({ recordSyncEnabled })}
                  />
                </SettingsGroup>
              )}
              <SettingsGroup>
                <RecentObjectsSetting />
              </SettingsGroup>
            </SettingsSection>

            <SettingsSection id="diagnostics" title="Diagnostics">
              <SettingsGroup>
                <DiagnosticLoggingSetting />
                <SettingsRow id="setting-app-version" title="App version" description="Include this when contacting Jetstream Support.">
                  <span className="slds-text-font_monospace">{version}</span>
                </SettingsRow>
              </SettingsGroup>
            </SettingsSection>
          </SettingsLayout>
        </AutoFullHeightContainer>
      </Page>
    </div>
  );
};

export default Settings;
