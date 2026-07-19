import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { DataHistorySettings, Maybe } from '@jetstream/types';
import { CheckboxToggle, ConfirmationModalPromise, fireToast, Spinner, UpgradeToProButton } from '@jetstream/ui';
import { dataHistoryCaptureEnabledState, googleDriveAccessState } from '@jetstream/ui/app-state';
import {
  DataHistoryStorageHealth,
  deleteAllDataHistory,
  getDataHistoryLimits,
  getDataHistorySettings,
  getDataHistoryStorageHealth,
  setDataHistoryEnabled,
  updateDataHistoryRetentionSettings,
} from '@jetstream/ui/data-history';
import { filesize } from 'filesize';
import { useAtomValue, useSetAtom } from 'jotai';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { useAmplitude } from '../analytics';
import { ViewDataHistoryLink } from '../app/DataHistoryLinks';
import { DataHistoryStorageLocation } from './DataHistoryStorageLocation';

function formatBytes(sizeBytes: number): string {
  return sizeBytes > 0 ? String(filesize(sizeBytes, { round: 1 })) : '—';
}

/**
 * "Data History" settings section, shared by the web app Settings page, the desktop Settings page,
 * and the browser extension Additional Settings page (they are separate components — this keeps
 * one implementation).
 *
 * IMPORTANT: the enable/disable toggle must update BOTH the persisted setting (service) and the
 * `dataHistoryCaptureEnabledState` jotai atom — the atom is only seeded at app boot and gates the
 * per-run opt-out checkboxes across features.
 */
export interface DataHistorySettingsSectionProps {
  /**
   * When provided, the "View Data History" link renders as a plain anchor to this href instead of
   * a router Link — used by the browser-extension settings page, which runs outside the main SPA
   * router (its MemoryRouter has no routes registered).
   */
  viewHistoryLinkHref?: string;
}

export const DataHistorySettingsSection: FunctionComponent<DataHistorySettingsSectionProps> = ({ viewHistoryLinkHref }) => {
  const { trackEvent } = useAmplitude();
  const setCaptureEnabledAtom = useSetAtom(dataHistoryCaptureEnabledState);
  // Same signal that drives the tier limits — true only for free users on the web app
  const { googleShowUpgradeToPro: showUpgradeToPro } = useAtomValue(googleDriveAccessState);
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

  useEffect(() => {
    loadSettingsAndHealth();
  }, [loadSettingsAndHealth]);

  async function handleEnabledChange(enabled: boolean) {
    try {
      await setDataHistoryEnabled(enabled);
      setCaptureEnabledAtom(enabled);
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { enabled, location: 'settings' });
      await loadSettingsAndHealth();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error updating enabled setting', ex);
      fireToast({ type: 'error', message: 'There was a problem updating your Data History settings.' });
    }
  }

  async function handleRetentionDaysCommit() {
    if (!settings) {
      return;
    }
    const retentionDays = Number.parseInt(retentionDaysInput, 10);
    if (!Number.isFinite(retentionDays) || retentionDays < 1 || retentionDays === settings.retentionDays) {
      setRetentionDaysInput(String(settings.retentionDays));
      return;
    }
    try {
      await updateDataHistoryRetentionSettings({ retentionDays });
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { retentionDays, location: 'settings' });
      await loadSettingsAndHealth();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error updating retention days', ex);
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
      await deleteAllDataHistory();
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

  const limits = getDataHistoryLimits();
  const entryCapped = limits?.maxEntries != null;
  const usagePercent = health && health.maxTotalBytes > 0 ? Math.min(100, Math.round((health.usedBytes / health.maxTotalBytes) * 100)) : 0;

  return (
    <div className="slds-m-top_large">
      <h2 className="slds-text-heading_medium slds-m-vertical_small">Data History</h2>
      <CheckboxToggle
        id="data-history-enabled-toggle"
        checked={settings.enabled}
        label="Data History"
        labelHelp="Keep a history of the data modifications you make with Jetstream, including request and result files. Everything is stored locally on this device and never sent to the Jetstream server."
        onChange={handleEnabledChange}
      />
      {viewHistoryLinkHref ? (
        <a href={viewHistoryLinkHref} className="slds-m-top_x-small d-inline-block" title="View Data History">
          View Data History
        </a>
      ) : (
        <ViewDataHistoryLink className="slds-m-top_x-small" />
      )}

      {health && entryCapped && (
        <p className="slds-m-top_small">
          {`${health.entryCount.toLocaleString()} of ${health.maxEntries?.toLocaleString()} entries used (${formatBytes(health.usedBytes)})`}
        </p>
      )}
      {health && !entryCapped && (
        <p className="slds-m-top_small">
          {`${health.entryCount.toLocaleString()} ${health.entryCount === 1 ? 'entry' : 'entries'} using ${formatBytes(health.usedBytes)}`}
        </p>
      )}
      {!entryCapped && usagePercent >= 80 && (
        <p className="slds-text-color_error slds-m-top_xx-small">
          Storage is {usagePercent}% full — the oldest unpinned entries will be removed automatically as new history is saved.
        </p>
      )}
      {entryCapped && showUpgradeToPro && (
        <div className="slds-m-top_x-small">
          <span className="slds-m-right_small">
            {`Free accounts keep your ${limits?.maxEntries} most recent entries — upgrade for unlimited entries and up to a year of history.`}
          </span>
          <UpgradeToProButton trackEvent={trackEvent} source="data-history-settings" />
        </div>
      )}

      {!entryCapped && (
        <div className="slds-form-element slds-m-top_small">
          <label className="slds-form-element__label" htmlFor="data-history-retention-days">
            Keep history for (days)
          </label>
          <div className="slds-form-element__control">
            <input
              id="data-history-retention-days"
              className="slds-input"
              css={css`
                max-width: 8rem;
              `}
              type="number"
              min={1}
              value={retentionDaysInput}
              onChange={(event) => setRetentionDaysInput(event.target.value)}
              onBlur={handleRetentionDaysCommit}
            />
          </div>
        </div>
      )}

      <DataHistoryStorageLocation onChanged={loadSettingsAndHealth} />

      <button
        className="slds-button slds-button_text-destructive slds-m-top_small slds-is-relative"
        disabled={clearing}
        onClick={handleClearAll}
      >
        {clearing && <Spinner className="slds-spinner slds-spinner_small" />}
        Delete All Data History
      </button>
      <p className="slds-m-top_small">
        Deletes every saved history entry and file from this device, including pinned entries. History on other devices is not affected.
      </p>
    </div>
  );
};
