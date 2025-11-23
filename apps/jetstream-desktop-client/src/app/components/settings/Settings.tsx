import { css } from '@emotion/react';
import { DesktopUserPreferences } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { isEscapeKey, useGlobalEventHandler, useTitle } from '@jetstream/shared/ui-utils';
import { AutoFullHeightContainer, CheckboxToggle, Grid, Icon, Input, Page, Spinner, fireToast } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { dexieDataSync, recentHistoryItemsDb } from '@jetstream/ui/db';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { desktopUserPreferences } from '../core/AppDesktopState';
import LoggerConfig from './LoggerConfig';

const HEIGHT_BUFFER = 170;

export const Settings = () => {
  useTitle(TITLES.SETTINGS);
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const navigate = useNavigate();
  const setUserProfile = useSetAtom(fromAppState.userProfileState);
  const ability = useAtomValue(fromAppState.abilityState);
  const [preferences, setPreferences] = useAtom(desktopUserPreferences);
  const [modifiedPreferences, setModifiedPreferences] = useState<DesktopUserPreferences>(() => ({ ...preferences }));
  const selectedOrg = useAtomValue(fromAppState.selectedOrgState);

  const [resetSyncLoading, setResetSyncLoading] = useState(false);
  const [recentRecentItemLoading, setRecentRecentItemLoading] = useState<false | 'all' | 'current'>(false);

  const recordSyncEnabled = ability.can('access', 'RecordSync');

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
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

  useEffect(() => {
    if (preferences) {
      setModifiedPreferences({ ...preferences });
    }
  }, [preferences]);

  async function handleSave(_preferences?: DesktopUserPreferences) {
    try {
      _preferences = _preferences || modifiedPreferences;
      if (!_preferences || !window.electronAPI) {
        return;
      }
      const updatedPreferences = await window.electronAPI.setPreferences(_preferences);
      setPreferences(updatedPreferences);
      setModifiedPreferences(updatedPreferences);
      // Ensure app state is updated to match user preference changes
      setUserProfile((prev) => ({
        ...prev,
        preferences: updatedPreferences,
      }));
      trackEvent(ANALYTICS_KEYS.settings_update_user);
    } catch (ex) {
      logger.warn('Error updating user settings', ex);
      fireToast({
        message: 'There was a problem updating your settings. Try again or file a support ticket for assistance.',
        type: 'error',
      });
    }
  }

  function handleFrontdoorLoginChange(skipFrontdoorLogin: boolean) {
    const _modifiedPreferences = { ...preferences, skipFrontdoorLogin };
    setModifiedPreferences(_modifiedPreferences);
    handleSave(_modifiedPreferences);
  }

  async function handleChooseFolder() {
    if (!window.electronAPI) {
      return;
    }
    const downloadPath = await window.electronAPI.selectFolder();
    if (!downloadPath) {
      // user canceled the folder selection
      return;
    }
    const _modifiedPreferences = { ...preferences, fileDownload: { omitPrompt: true, downloadPath } };
    setModifiedPreferences(_modifiedPreferences);
    handleSave(_modifiedPreferences);
  }

  async function handleClearFolder() {
    if (!window.electronAPI) {
      return;
    }
    const _modifiedPreferences = { ...preferences, fileDownload: { omitPrompt: false, downloadPath: '' } };
    setModifiedPreferences(_modifiedPreferences);
    handleSave(_modifiedPreferences);
  }

  function handleRecordSyncChange(recordSyncEnabled: boolean) {
    const _modifiedPreferences = { ...preferences, recordSyncEnabled };
    setModifiedPreferences(_modifiedPreferences);
    handleSave(_modifiedPreferences);
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
      <div
        css={css`
          min-height: 50px;
          width: 100%;
          background-color: white;
          app-region: drag;
        `}
      >
        {/* Close button */}
        <Grid align="end" verticalAlign="center">
          <button
            css={css`
              app-region: no-drag;
              margin-top: 17px;
              margin-right: 15px;
            `}
            className="slds-button slds-button_icon slds-modal__close"
            title="Close"
            disabled={false}
            onClick={() => navigate(-1)}
          >
            <Icon type="utility" icon="close" className="slds-button__icon slds-button__icon_large" omitContainer />
            <span className="slds-assistive-text">Close</span>
          </button>
        </Grid>
      </div>
      <Page testId="settings-page">
        <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
          {/* Settings */}
          <div className="slds-m-top_medium">
            <h2 className="slds-text-heading_medium slds-m-vertical_small">General Settings</h2>
            <CheckboxToggle
              id="frontdoor-toggle"
              checked={modifiedPreferences?.skipFrontdoorLogin ?? false}
              label="Don't Auto-Login on Link Clicks"
              labelHelp="When enabled, Jetstream will not attempt to auto-login to Salesforce when you click a link in Jetstream. If you have issues with multi-factor authentication when clicking links, enable this."
              onChange={handleFrontdoorLoginChange}
            />

            <Grid verticalAlign="end">
              <Input
                id="download-path"
                label="Save Download Without Prompt Location"
                labelHelp="Specify the location to download saved files to. If provided, the file save dialog will not be shown."
                className="slds-grow"
              >
                <input id="download-path" className="slds-input" value={modifiedPreferences?.fileDownload?.downloadPath || ''} disabled />
              </Input>
              <div className="slds-m-left_xx-small">
                <button
                  aria-label="Query History"
                  className="slds-button slds-button_icon slds-button_icon-border-filled"
                  onClick={() => handleChooseFolder()}
                >
                  <Icon type="utility" icon="file" className="slds-button__icon" omitContainer />
                </button>
              </div>
              {modifiedPreferences?.fileDownload?.downloadPath && (
                <div className="slds-m-left_xx-small">
                  <button
                    aria-label="Query History"
                    className="slds-button slds-button_icon slds-button_icon-border-filled"
                    onClick={() => handleClearFolder()}
                  >
                    <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
                  </button>
                </div>
              )}
            </Grid>

            {recordSyncEnabled && (
              <div className="slds-m-top_large">
                <h2 className="slds-text-heading_medium slds-m-vertical_small">History Data Sync</h2>
                <CheckboxToggle
                  id="enable-record-sync-button"
                  checked={modifiedPreferences?.recordSyncEnabled ?? false}
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
          </div>
        </AutoFullHeightContainer>
      </Page>
    </div>
  );
};

export default Settings;
