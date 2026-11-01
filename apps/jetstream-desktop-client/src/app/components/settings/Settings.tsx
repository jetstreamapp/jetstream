import { css } from '@emotion/react';
import { DesktopUserPreferences, UpdatePolicy } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { isEscapeKey, useGlobalEventHandler, useTitle } from '@jetstream/shared/ui-utils';
import { SoqlQueryFormatOptionsSchema } from '@jetstream/types';
import { ariaDisabledButtonProps, AutoFullHeightContainer, BreakablePath, fireToast, Icon, Page } from '@jetstream/ui';
import {
  AccountSummary,
  AppearanceSetting,
  DataHistorySettingsSection,
  DiagnosticLoggingSetting,
  EditorSettingsSection,
  getPreferencesToRestore,
  getSettingsRowIds,
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
  useAnalytics,
} from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue } from 'jotai';
import { useAtomCallback } from 'jotai/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { desktopUserPreferences } from '../core/AppDesktopState';

const HEIGHT_BUFFER = 170;

const SECTIONS: SettingsNavItem[] = [
  { id: 'account', label: 'Account' },
  { id: 'general', label: 'General' },
  { id: 'query', label: 'Query' },
  { id: 'data-storage', label: 'Data & Storage' },
  { id: 'diagnostics', label: 'Diagnostics' },
];

const DOWNLOAD_LOCATION_ROW_ID = 'setting-download-location';
const CHOOSE_FOLDER_BUTTON_ID = `${DOWNLOAD_LOCATION_ROW_ID}-choose-folder`;

const downloadPathCss = css`
  display: block;
  overflow-wrap: anywhere;
`;

export const Settings = () => {
  useTitle(TITLES.SETTINGS);
  const isMounted = useRef(true);
  const { trackEvent } = useAnalytics();
  const [userProfile, setUserProfile] = useAtom(fromAppState.userProfileState);
  const { serverUrl } = useAtomValue(fromAppState.applicationCookieState);
  const { version } = useAtomValue(fromAppState.appInfoState);
  const ability = useAtomValue(fromAppState.abilityState);
  const preferences = useAtomValue(desktopUserPreferences);
  const [updatePolicy, setUpdatePolicy] = useState<UpdatePolicy | null>(null);
  const [isChoosingDownloadFolder, setIsChoosingDownloadFolder] = useState(false);

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
        // Settings is the only page in its window
        window.close();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useGlobalEventHandler('keydown', onKeydown);

  // Shows the change immediately, so controls reflect a click before the save finishes
  const mergePreferences = useAtomCallback(
    useCallback(async (get, set, changes: Partial<DesktopUserPreferences>) => {
      set(desktopUserPreferences, { ...(await get(desktopUserPreferences)), ...changes });
    }, []),
  );

  // What the main process has saved - once a save settles, the settings it tried to change show this again,
  // except for settings changed again since
  const savedPreferencesRef = useRef(preferences);
  const showSavedPreferences = useAtomCallback(
    useCallback(async (get, set, changes: Partial<DesktopUserPreferences>) => {
      const currentPreferences = await get(desktopUserPreferences);
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
        await showSavedPreferences(changes);
        setUserProfile((prev) => ({
          ...prev,
          preferences: savedPreferences,
        }));
        trackEvent(ANALYTICS_KEYS.settings_update_user);
      } catch (ex) {
        await showSavedPreferences(changes);
        logger.warn('Error updating user settings', ex);
        fireToast({
          message: 'There was a problem updating your settings. Try again or file a support ticket for assistance.',
          type: 'error',
        });
      }
    });
  }

  // The folder dialog runs in the main process, which stores the choice itself. The renderer only ever
  // receives the chosen path back for display - it can never supply one (a renderer-chosen path would let
  // any download be written anywhere without a prompt), and the main process drops the field from anything
  // the renderer sends. Queued behind pending saves so the stored preferences it returns are never older
  // than a save in flight. Both download buttons stay disabled until it settles: a change queued behind the
  // dialog would be shown, then replaced on screen by the folder the dialog returns, even though the queued
  // change is what ends up stored.
  function handleChooseDownloadFolder() {
    setIsChoosingDownloadFolder(true);
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        if (!window.electronAPI) {
          return;
        }
        const savedPreferences = await window.electronAPI.pickDownloadFolder();
        // Nothing is returned when the folder selection is canceled
        if (!savedPreferences) {
          return;
        }
        savedPreferencesRef.current = savedPreferences;
        await mergePreferences({ fileDownload: savedPreferences.fileDownload });
        setUserProfile((prev) => ({
          ...prev,
          preferences: savedPreferences,
        }));
        trackEvent(ANALYTICS_KEYS.settings_update_user);
      } catch (ex) {
        logger.warn('Error choosing the download folder', ex);
        fireToast({
          message: 'There was a problem updating your settings. Try again or file a support ticket for assistance.',
          type: 'error',
        });
      } finally {
        if (isMounted.current) {
          setIsChoosingDownloadFolder(false);
        }
      }
    });
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

  return (
    <Page testId="settings-page">
      {/* The window's native title bar names the page, but screen reader users still need a heading to land on */}
      <h1 className="slds-assistive-text">Settings</h1>
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
              <DownloadLocationSetting
                downloadPath={downloadPath}
                isChoosingFolder={isChoosingDownloadFolder}
                onChooseFolder={handleChooseDownloadFolder}
                onAskEveryTime={() => savePreferences({ fileDownload: { omitPrompt: false, downloadPath: '' } })}
              />
            </SettingsGroup>
            <SettingsGroup title="Network">
              <SettingsToggleRow
                id="trust-system-certificates-toggle"
                title="Trust certificates installed on this computer"
                description="Turn this on if your company inspects network traffic and connecting to Salesforce fails with a certificate error. Jetstream will also trust the certificate authorities your IT team installed on this computer, the same way your browser does."
                checked={preferences?.trustSystemCertificates ?? false}
                onChange={(trustSystemCertificates) => savePreferences({ trustSystemCertificates })}
              />
            </SettingsGroup>
            <EditorSettingsSection />
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
  );
};

export interface DownloadLocationSettingProps {
  downloadPath?: string;
  /** The folder dialog is open - both buttons wait for it, see `handleChooseDownloadFolder` */
  isChoosingFolder: boolean;
  onChooseFolder: () => void;
  onAskEveryTime: () => void;
}

export const DownloadLocationSetting = ({
  downloadPath,
  isChoosingFolder,
  onChooseFolder,
  onAskEveryTime,
}: DownloadLocationSettingProps) => {
  const { titleId, descriptionId } = getSettingsRowIds(DOWNLOAD_LOCATION_ROW_ID);
  // The button names alone do not say what they change, or which folder is in use
  const ariaDescribedBy = `${titleId} ${descriptionId}`;

  function handleAskEveryTime() {
    onAskEveryTime();
    // Ask Every Time removes itself, the folder button stays (relabeled Choose Folder…) so focus moves there
    // (looked up by id: a ref read in a handler passed to ariaDisabledButtonProps trips the react/refs lint)
    document.getElementById(CHOOSE_FOLDER_BUTTON_ID)?.focus();
  }

  // Both buttons stay focusable while the folder dialog is open (aria-disabled) so focus is not dropped to <body>
  return (
    <SettingsRow
      id={DOWNLOAD_LOCATION_ROW_ID}
      title="Download location"
      description={
        downloadPath ? (
          <>
            Files are saved to this folder without asking:
            <span css={downloadPathCss}>
              <BreakablePath path={downloadPath} />
            </span>
          </>
        ) : (
          'You are asked where to save each download.'
        )
      }
    >
      <button
        id={CHOOSE_FOLDER_BUTTON_ID}
        className="slds-button slds-button_neutral"
        aria-describedby={ariaDescribedBy}
        {...ariaDisabledButtonProps(isChoosingFolder, onChooseFolder)}
      >
        {downloadPath ? 'Change Folder…' : 'Choose Folder…'}
      </button>
      {downloadPath && (
        <button
          className="slds-button slds-button_neutral"
          aria-describedby={ariaDescribedBy}
          {...ariaDisabledButtonProps(isChoosingFolder, handleAskEveryTime)}
        >
          Ask Every Time
        </button>
      )}
    </SettingsRow>
  );
};

export default Settings;
