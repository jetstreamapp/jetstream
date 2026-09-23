import { css } from '@emotion/react';
import { AutoFullHeightContainer, Page, PageHeader, PageHeaderRow, PageHeaderTitle, ScopedNotification } from '@jetstream/ui';
import {
  DataHistorySettingsSection,
  HistorySyncSettings,
  SettingsGroup,
  SettingsSection,
  SettingsToggleRow,
  SoqlQueryFormatSettings,
} from '@jetstream/ui-core';
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

const contentCss = css`
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
  max-width: 52rem;
  margin: 0 auto;
  padding: 1rem 0 3rem;
`;

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
          <div css={contentCss}>
            {loggedIn && authTokens && (
              <>
                <SettingsSection id="extension" title="Extension">
                  <SettingsGroup>
                    <SettingsToggleRow
                      id="enable-extension-button"
                      title="Jetstream page button"
                      description="Show the floating Jetstream button when you are on a Salesforce page."
                      checked={enabled}
                      onChange={(value) => setEnabled(value)}
                    />

                    {/* TEMPORARILY DISABLED alongside the error tracker itself - there is nothing to opt out of
                        while crash reporting is off, and offering the toggle would imply reports are still sent.
                    <SettingsToggleRow
                      id="enable-crash-reporting"
                      title="Send crash reports to Jetstream"
                      description="Automatically send error and crash reports to help us diagnose and fix issues."
                      checked={crashReportingEnabled}
                      onChange={(value) => setCrashReportingEnabled(value)}
                    /> */}
                  </SettingsGroup>
                </SettingsSection>

                <SettingsSection id="query" title="Query">
                  <SoqlQueryFormatSettings
                    location="AdditionalSettings"
                    value={soqlQueryFormatOptions}
                    onChange={setSoqlQueryFormatOptions}
                  />
                </SettingsSection>
              </>
            )}

            <SettingsSection id="data-storage" title="Data & Storage">
              {/* No link into the app — this page has no Salesforce `host` param, so Data History is reached from the app nav */}
              <DataHistorySettingsSection hideViewHistoryLink />
              <SettingsGroup title="Sync">
                <HistorySyncSettings enabled={recordSyncEnabled} onChange={(value) => setRecordSyncEnabled(value)} />
              </SettingsGroup>
            </SettingsSection>
          </div>
        </AutoFullHeightContainer>
      </Page>
    </div>
  );
}
