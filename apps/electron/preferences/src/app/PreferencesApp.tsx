import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ElectronPreferences } from '@jetstream/types';
import {
  Grid,
  Input,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import { FormEvent, useEffect, useState } from 'react';
import './PreferencesApp.scss';
import PreferenceItem from './PreferenceItem';

const salesforceApiVersionValid = /[0-9]{2,3}\.0/;

export function App() {
  const [loading, setLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [preferences, setPreferences] = useState<ElectronPreferences | undefined>(() => window.electronPreferences?.initialPreferences);
  const [analyticsOptIn, setAnalyticsOptIn] = useState(true);
  const [crashReportingOptIn, setCrashReportingOprIn] = useState(true);
  const [downloadFolderEnabled, setDownloadFolderEnabled] = useState(false);
  const [downloadFolder, setDownloadFolder] = useState<string>('');
  const [salesforceApiVersionEnabled, setSalesforceApiVersionEnabled] = useState(false);
  const [salesforceApiVersion, setSalesforceApiVersion] = useState('');

  useEffect(() => {
    (async () => {
      try {
        if (window.electronPreferences) {
          setLoading(true);
          setPreferences(await window.electronPreferences.loadPreferences());
          setLoading(false);
        }
      } catch (ex) {
        logger.warn('Error picking directory', ex);
      }
    })();
  }, []);

  useEffect(() => {
    if (preferences) {
      setAnalyticsOptIn(preferences.analyticsOptIn);
      setCrashReportingOprIn(preferences.crashReportingOptIn);
      if (preferences.downloadFolder.prompt) {
        setDownloadFolderEnabled(false);
        setDownloadFolder(preferences.downloadFolder.location || '');
      } else {
        setDownloadFolderEnabled(true);
        setDownloadFolder(preferences.downloadFolder.location);
      }
      setSalesforceApiVersionEnabled(preferences.defaultApiVersion.override);
      setSalesforceApiVersion(preferences.defaultApiVersion.overrideValue || '');
    }
  }, [preferences]);

  useEffect(() => {
    setIsValid(
      (!downloadFolderEnabled || !!downloadFolder) && (!salesforceApiVersionEnabled || salesforceApiVersionValid.test(salesforceApiVersion))
    );
  }, [analyticsOptIn, crashReportingOptIn, downloadFolderEnabled, downloadFolder, salesforceApiVersionEnabled, salesforceApiVersion]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    try {
      event.preventDefault();
      if (!preferences || !window.electronPreferences) {
        return;
      }
      setLoading(true);
      setTimeout(async () => {
        setPreferences(
          await window.electronPreferences?.savePreferences({
            isInitialized: true,
            analyticsOptIn,
            crashReportingOptIn,
            downloadFolder: downloadFolderEnabled
              ? { prompt: false, location: downloadFolder }
              : { prompt: true, location: downloadFolder || undefined },
            defaultApiVersion: salesforceApiVersionEnabled ? { override: true, overrideValue: salesforceApiVersion } : { override: false },
          })
        );
        setLoading(false);
      }, 1000);
    } catch (ex) {
      logger.warn('Error saving preferences', ex);
    }
  }

  async function handleChooseDirectory() {
    try {
      const fileSystemDirectoryHandle = await window.electronPreferences?.pickDirectory();
      if (fileSystemDirectoryHandle) {
        setDownloadFolder(fileSystemDirectoryHandle);
      }
    } catch (ex) {
      logger.warn('Error picking directory', ex);
    }
  }

  return (
    <div style={{ height: '100vh' }}>
      <Page>
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle icon={{ type: 'standard', icon: 'bundle_config' }} label="Preferences" />
            <PageHeaderActions colType="actions" buttonType="separate">
              <button form="preferences-form" type="submit" className="slds-button slds-button_brand" disabled={loading}>
                Save
              </button>
            </PageHeaderActions>
          </PageHeaderRow>
        </PageHeader>
        <div className="slds-p-around_medium slds-is-relative h-100">
          {loading && <Spinner />}
          {preferences && !preferences.isInitialized && (
            <ScopedNotification theme="info" className="slds-p-around_small">
              <Grid vertical>
                <p>Welcome to Jetstream!</p>
                <p>Confirm your preferences and close this window to continue.</p>
              </Grid>
            </ScopedNotification>
          )}
          <form id="preferences-form" className="" onSubmit={handleSave}>
            {/* Profile section */}

            <ul className="slds-has-dividers_bottom-space slds-list_vertical-space-medium">
              <PreferenceItem
                label="Analytics"
                subLabel="Share how you use the application with the Jetstream team."
                enabled={analyticsOptIn}
                onChange={setAnalyticsOptIn}
              />
              <PreferenceItem
                label="Crash Reports"
                subLabel="If there is a problem with Jetstream, automatically send information about the crash to the Jetstream team."
                enabled={crashReportingOptIn}
                onChange={setCrashReportingOprIn}
              />
              <PreferenceItem
                label="Choose download folder"
                subLabel="Specify where downloads should be saved."
                enabled={downloadFolderEnabled}
                onChange={setDownloadFolderEnabled}
              >
                {downloadFolderEnabled ? (
                  <Grid verticalAlign="end">
                    <Input label="Choose folder" className="slds-grow">
                      <input className="slds-input" value={downloadFolder} disabled />
                    </Input>
                    <div>
                      <button type="button" className="slds-button slds-button_neutral slds-m-left_small" onClick={handleChooseDirectory}>
                        Choose Directory
                      </button>
                    </div>
                  </Grid>
                ) : (
                  <p>Ask me each time</p>
                )}
                {/* {downloadFolder} */}
              </PreferenceItem>
              <PreferenceItem
                label="Salesforce API Version"
                subLabel="Choose the Salesforce API version you would like to use. (disable for default version)"
                enabled={salesforceApiVersionEnabled}
                onChange={setSalesforceApiVersionEnabled}
              >
                {salesforceApiVersionEnabled && (
                  <Input label="Override default API version" labelHelp="In format of 33.0">
                    <input className="slds-input" required type="text" pattern="[0-9]{2,3}\.0" />
                  </Input>
                )}
              </PreferenceItem>
            </ul>
          </form>
        </div>
      </Page>
    </div>
  );
}

export default App;
