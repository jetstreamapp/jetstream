import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { DataHistorySettings, Maybe } from '@jetstream/types';
import { ConfirmationModalPromise, fireToast, Spinner, UpgradeToProButton } from '@jetstream/ui';
import { dataHistoryLimitsState } from '@jetstream/ui/app-state';
import {
  DataHistoryStorageHealth,
  deleteAllDataHistory,
  getDataHistorySettings,
  getDataHistoryStorageHealth,
  updateDataHistoryRetentionSettings,
} from '@jetstream/ui/data-history';
import { filesize } from 'filesize';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { useAmplitude } from '../analytics';
import { ViewDataHistoryLink } from '../app/DataHistoryLinks';
import { useRequestPersistentStorage, useSetDataHistoryCaptureEnabled } from './data-history-hooks';
import { DataHistoryStorageLocation } from './DataHistoryStorageLocation';
import { getSettingsRowIds, SettingsGroup, SettingsRow, SettingsToggleRow } from './layout/SettingsSection';

const RETENTION_ROW_ID = 'setting-data-history-retention';

function formatBytes(sizeBytes: number): string {
  return sizeBytes > 0 ? String(filesize(sizeBytes, { round: 1 })) : '—';
}

/**
 * "Data History" settings group, shared by the web app Settings page, the desktop Settings page,
 * and the browser extension Additional Settings page (they are separate components — this keeps
 * one implementation). Renders a `SettingsGroup`, so place it inside a `SettingsSection`.
 */
export interface DataHistorySettingsSectionProps {
  /**
   * Omits the "View Data History" link — used by the browser-extension settings page, which runs
   * outside the main SPA router and has no way to link into the app (the app requires a Salesforce
   * `host` query param that only exists when opened from a Salesforce page). In the extension, Data
   * History is reached from the app header nav instead.
   */
  hideViewHistoryLink?: boolean;
}

export const DataHistorySettingsSection: FunctionComponent<DataHistorySettingsSectionProps> = ({ hideViewHistoryLink }) => {
  const { trackEvent } = useAmplitude();
  const setCaptureEnabled = useSetDataHistoryCaptureEnabled({ analyticsLocation: 'settings' });
  // Seeded (non-null) by AppInitializer once initDataHistory() resolves — a hard refresh landing
  // directly here mounts before that finishes, so we gate the first load on it instead of bailing
  // to null forever
  const limits = useAtomValue(dataHistoryLimitsState);
  const [settings, setSettings] = useState<Maybe<DataHistorySettings>>(null);
  const [health, setHealth] = useState<Maybe<DataHistoryStorageHealth>>(null);
  const [retentionDaysInput, setRetentionDaysInput] = useState('');
  const [clearing, setClearing] = useState(false);

  const loadSettingsAndHealth = useCallback(async () => {
    try {
      const [currentSettings, currentHealth] = await Promise.all([getDataHistorySettings(), getDataHistoryStorageHealth()]);
      setSettings(currentSettings);
      setHealth(currentHealth);
      setRetentionDaysInput(currentSettings ? String(currentSettings.retentionDays) : '');
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error loading settings', ex);
    }
  }, []);

  const { persistPromptEligible, persisted, requestingPersist, requestPersist } = useRequestPersistentStorage({
    analyticsLocation: 'settings',
  });

  useEffect(() => {
    if (limits != null) {
      loadSettingsAndHealth();
    }
  }, [limits, loadSettingsAndHealth]);

  async function handleEnabledChange(enabled: boolean) {
    if (await setCaptureEnabled(enabled)) {
      await loadSettingsAndHealth();
    }
  }

  async function handleRetentionDaysCommit() {
    if (!settings || !limits) {
      return;
    }
    const parsedDays = Number.parseInt(retentionDaysInput, 10);
    // Below 1 is rejected rather than clamped up — lowering retention sweeps entries immediately, so a
    // stray "0" must not silently become the most aggressive setting there is
    if (!Number.isFinite(parsedDays) || parsedDays < 1) {
      setRetentionDaysInput(String(settings.retentionDays));
      return;
    }
    // Cap at the tier's maximum up front so what is saved is what the field shows — the service clamps
    // the effective value anyway, but persisting the raw number would make the field snap back to a
    // different value on the next load with no explanation
    const retentionDays = Math.min(parsedDays, limits.retentionDaysMax);
    if (retentionDays === settings.retentionDays) {
      setRetentionDaysInput(String(settings.retentionDays));
      return;
    }
    try {
      await updateDataHistoryRetentionSettings({ retentionDays });
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { retentionDays, location: 'settings' });
      await loadSettingsAndHealth();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error updating retention days', ex);
      fireToast({ type: 'error', message: 'There was a problem updating your Data History settings.' });
      setRetentionDaysInput(String(settings.retentionDays));
    }
  }

  async function handleClearAll() {
    if (
      !(await ConfirmationModalPromise({
        content: 'This will permanently delete ALL saved data history from this device, including pinned entries. This cannot be undone.',
      }))
    ) {
      return;
    }
    try {
      setClearing(true);
      const { skipped } = await deleteAllDataHistory();
      if (skipped > 0) {
        fireToast({
          type: 'warning',
          message: `${skipped} ${skipped === 1 ? 'entry is' : 'entries are'} still being written and ${
            skipped === 1 ? 'was' : 'were'
          } kept — clear again once the current load finishes.`,
        });
      }
      trackEvent(ANALYTICS_KEYS.data_history_delete_all);
      await loadSettingsAndHealth();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error clearing data history', ex);
      fireToast({ type: 'error', message: 'There was a problem clearing your data history.' });
    } finally {
      setClearing(false);
    }
  }

  // Settings resolve to null when the feature has not initialized for this session
  if (!settings) {
    return null;
  }

  const entryCapped = limits?.maxEntries != null;
  const usagePercent = health && health.maxTotalBytes > 0 ? Math.min(100, Math.round((health.usedBytes / health.maxTotalBytes) * 100)) : 0;

  let usageText: string | null = null;
  if (health && entryCapped) {
    usageText = `${health.entryCount.toLocaleString()} of ${health.maxEntries?.toLocaleString()} entries used`;
  } else if (health?.entryCount === 0) {
    usageText = 'No entries saved yet';
  } else if (health) {
    usageText = `${health.entryCount.toLocaleString()} ${health.entryCount === 1 ? 'entry' : 'entries'} using ${formatBytes(health.usedBytes)}`;
  }
  const showStorageWarning = !entryCapped && usagePercent >= 80;
  const showPersistedNote = persistPromptEligible && persisted === true;

  return (
    <SettingsGroup
      testId="data-history-settings"
      title="Data History"
      description="Everything is stored on this device and never sent to the Jetstream server."
      actions={!hideViewHistoryLink && <ViewDataHistoryLink />}
    >
      <SettingsToggleRow
        id="data-history-enabled-toggle"
        title="Save data history"
        description="Keep a history of the data changes you make with Jetstream, including request and result files."
        details={
          (usageText || showStorageWarning || showPersistedNote) && (
            <>
              {usageText && <p className="slds-text-body_small">{usageText}</p>}
              {showStorageWarning && (
                <p className="slds-text-body_small slds-text-color_error slds-m-top_xxx-small">
                  Storage is {usagePercent}% full — the oldest unpinned entries will be removed automatically as new history is saved.
                </p>
              )}
              {showPersistedNote && (
                <p className="slds-text-body_small slds-text-color_weak slds-m-top_xxx-small">
                  Your browser has been asked to keep this history and won’t remove it automatically.
                </p>
              )}
            </>
          )
        }
        checked={settings.enabled}
        onChange={handleEnabledChange}
      />

      {/* The tier itself is the free/paid signal — desktop/extension/canvas always resolve to the top tier */}
      {entryCapped && (
        <SettingsRow
          id="setting-data-history-limit"
          title="History limit"
          description={`Free accounts keep your ${limits?.maxEntries} most recent entries. Upgrade for unlimited entries and up to a year of history.`}
        >
          <UpgradeToProButton trackEvent={trackEvent} source="data-history-settings" />
        </SettingsRow>
      )}

      {!entryCapped && (
        <SettingsRow
          id={RETENTION_ROW_ID}
          title="Keep history for"
          labelFor="data-history-retention-days"
          description={`Older entries are deleted automatically. Up to ${limits?.retentionDaysMax?.toLocaleString()} days.`}
        >
          <input
            id="data-history-retention-days"
            className="slds-input"
            css={css`
              width: 6rem;
            `}
            type="number"
            min={1}
            max={limits?.retentionDaysMax}
            aria-describedby={getSettingsRowIds(RETENTION_ROW_ID).descriptionId}
            value={retentionDaysInput}
            onChange={(event) => setRetentionDaysInput(event.target.value)}
            onBlur={handleRetentionDaysCommit}
          />
          <span>days</span>
        </SettingsRow>
      )}

      {persistPromptEligible && persisted === false && (
        <SettingsRow
          id="setting-data-history-persist"
          title="Protect saved history"
          description="Your browser may remove this saved history to free up space unless you ask it to keep it."
        >
          <button className="slds-button slds-button_neutral" disabled={requestingPersist} onClick={requestPersist}>
            Keep History on This Device
          </button>
        </SettingsRow>
      )}

      <DataHistoryStorageLocation onChanged={loadSettingsAndHealth} />

      <SettingsRow
        id="setting-data-history-delete"
        title="Delete all data history"
        description="Deletes every saved entry and file from this device, including pinned entries. History on other devices is not affected."
      >
        <button className="slds-button slds-button_text-destructive slds-is-relative" disabled={clearing} onClick={handleClearAll}>
          {clearing && <Spinner size="x-small" />}
          Delete All Data History
        </button>
      </SettingsRow>
    </SettingsGroup>
  );
};
