import { logger } from '@jetstream/shared/client-logger';
import { fireToast, Spinner } from '@jetstream/ui';
import { dexieDataSync } from '@jetstream/ui/db';
import { useState } from 'react';
import { SettingsRow, SettingsToggleRow } from './layout/SettingsSection';

export interface HistorySyncSettingsProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

/** Rows for the Jetstream server sync of query history and the other syncable local tables */
export const HistorySyncSettings = ({ enabled, onChange }: HistorySyncSettingsProps) => {
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    try {
      setResetting(true);
      await dexieDataSync.reset(enabled);
      fireToast({ message: 'Sync reset successfully', type: 'success' });
    } catch (ex) {
      logger.error('[DB] Error resetting sync', ex);
      fireToast({ message: 'There was a problem resetting sync. Try again or file a support ticket for assistance.', type: 'error' });
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <SettingsToggleRow
        id="setting-history-sync"
        title="Sync across devices"
        description="Keep your query history, saved load mappings, recent objects, and API request history in sync between the Jetstream web app, desktop app, and browser extension."
        checked={enabled}
        onChange={onChange}
      />
      <SettingsRow
        id="setting-history-sync-reset"
        title="Reset sync"
        description="If your history looks different on another device, push and pull everything again from the Jetstream server."
      >
        <button className="slds-button slds-button_neutral slds-is-relative" disabled={resetting} onClick={handleReset}>
          {resetting && <Spinner size="x-small" />}
          Reset Sync
        </button>
      </SettingsRow>
    </>
  );
};
