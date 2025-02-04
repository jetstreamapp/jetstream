import { logger } from '@jetstream/shared/client-logger';
import {
  AutoFullHeightContainer,
  CheckboxToggle,
  Page,
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { dexieDataSync } from '@jetstream/ui/db';
import { useState } from 'react';
import { AppWrapper } from '../../core/AppWrapper';
import { useExtensionSettings } from '../../hooks/useExtensionSettings';
import { initAndRenderReact } from '../../utils/web-extension.utils';

initAndRenderReact(
  <AppWrapper allowWithoutSalesforceOrg>
    <AdditionalSettings />
  </AppWrapper>
);

export function AdditionalSettings() {
  const { authTokens, loggedIn, enabled, setEnabled, recordSyncEnabled, setRecordSyncEnabled, authError } = useExtensionSettings();
  const [resetSyncLoading, setResetSyncLoading] = useState(false);

  async function resetSync() {
    try {
      setResetSyncLoading(true);
      await dexieDataSync.reset(recordSyncEnabled);
    } catch (ex) {
      logger.error('[DB] Error resetting sync', ex);
    } finally {
      setResetSyncLoading(false);
    }
  }

  return (
    <div className="slds-p-horizontal_xx-small slds-p-vertical_xx-small" data-testid="content">
      <Page testId="billing-page">
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle icon={{ type: 'standard', icon: 'settings' }} label="Extension Settings" />
          </PageHeaderRow>
        </PageHeader>
        <AutoFullHeightContainer className="slds-p-around_small slds-scrollable_none">
          {authError && (
            <ScopedNotification theme="error" className="slds-m-bottom_x-small">
              {authError}
            </ScopedNotification>
          )}
          {loggedIn && authTokens && (
            <>
              <h2 className="slds-text-heading_medium slds-m-vertical_small">Extension Settings</h2>
              <CheckboxToggle
                id="enable-extension-button"
                checked={enabled}
                label="Jetstream Page Button"
                labelHelp="If disabled, the Jetstream floating button will not be visible when you are on a Salesforce page."
                labelPosition="right"
                onChange={(value) => setEnabled(value)}
              />
            </>
          )}

          <h2 className="slds-text-heading_medium slds-m-vertical_small">Sync Settings</h2>
          <CheckboxToggle
            id="enable-record-sync-button"
            checked={recordSyncEnabled}
            label="Data Sync"
            labelHelp="Enable to sync Query History with the Jetstream server."
            onChange={(value) => setRecordSyncEnabled(value)}
          />
          <button className="slds-button slds-button_text-destructive slds-m-top_small slds-is-relative" onClick={resetSync}>
            {resetSyncLoading && <Spinner className="slds-spinner slds-spinner_small" />}
            Reset Sync
          </button>
          <p className=" slds-m-top_small">
            If you have having an issue with your data syncing from Jetstream to the Extension, you can reset your extension data to pull in
            all your Jetstream data.
          </p>
        </AutoFullHeightContainer>
      </Page>
    </div>
  );
}
