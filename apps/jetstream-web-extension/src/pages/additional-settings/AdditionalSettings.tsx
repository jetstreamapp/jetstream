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
import { DataHistorySettingsSection, EditorSettingsSection, SoqlQueryFormatConfig } from '@jetstream/ui-core';
import { dexieDataSync } from '@jetstream/ui/db';
import { useEffect, useState } from 'react';
import { AppWrapper } from '../../core/AppWrapper';
import { applyExtensionThemeBeforeMount } from '../../core/ExtensionThemeApplier';
import { useExtensionSettings } from '../../hooks/useExtensionSettings';
import { initAndRenderReact } from '../../utils/web-extension.utils';

applyExtensionThemeBeforeMount().finally(() => {
  initAndRenderReact(
    <AppWrapper allowWithoutSalesforceOrg>
      <AdditionalSettings />
    </AppWrapper>,
  );
});

export function AdditionalSettings() {
  const {
    authTokens,
    loggedIn,
    enabled,
    setEnabled,
    recordSyncEnabled,
    setRecordSyncEnabled,
    // TEMPORARILY DISABLED - see the commented-out toggle below
    // crashReportingEnabled,
    // setCrashReportingEnabled,
    soqlQueryFormatOptions,
    setSoqlQueryFormatOptions,
    authError,
  } = useExtensionSettings();
  const [resetSyncLoading, setResetSyncLoading] = useState(false);

  // This page lives outside the SPA router, so the `#data-history` deep link from Data History has
  // no FocusMainContentOnRouteChange to land it. The target section mounts after its settings load
  // asynchronously — the browser's native fragment jump misses it — so poll briefly, then focus and
  // scroll it the same way the in-app deep link does.
  useEffect(() => {
    const { hash } = window.location;
    if (!hash) {
      return;
    }
    let attemptsRemaining = 20;
    let cancelled = false;
    const tryFocusHashTarget = () => {
      if (cancelled) {
        return;
      }
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView?.({ block: 'start' });
        target.focus();
        return;
      }
      attemptsRemaining--;
      if (attemptsRemaining > 0) {
        window.setTimeout(tryFocusHashTarget, 50);
      }
    };
    tryFocusHashTarget();
    return () => {
      cancelled = true;
    };
  }, []);

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

              {/* TEMPORARILY DISABLED alongside the error tracker itself - there is nothing to opt out of
                  while crash reporting is off, and offering the toggle would imply reports are still sent.
              <CheckboxToggle
                id="enable-crash-reporting"
                checked={crashReportingEnabled}
                label="Send crash reports to Jetstream"
                labelHelp="Automatically send error and crash reports to help us diagnose and fix issues."
                labelPosition="right"
                onChange={(value) => setCrashReportingEnabled(value)}
              /> */}

              <SoqlQueryFormatConfig
                className="slds-m-top_large"
                location="AdditionalSettings"
                value={soqlQueryFormatOptions}
                onChange={setSoqlQueryFormatOptions}
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

          {/* No link into the app — this page has no Salesforce `host` param, so Data History is reached from the app nav */}
          <DataHistorySettingsSection hideViewHistoryLink />
          <EditorSettingsSection />
        </AutoFullHeightContainer>
      </Page>
    </div>
  );
}
