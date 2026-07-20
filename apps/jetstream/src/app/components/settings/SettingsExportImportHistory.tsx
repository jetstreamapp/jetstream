import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, INPUT_ACCEPT_FILETYPES, MIME_TYPES } from '@jetstream/shared/constants';
import { saveFile } from '@jetstream/shared/ui-utils';
import { InputReadFileContent } from '@jetstream/types';
import { FileSelector, fireToast, Spinner } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { exportClientHistoryData, importClientHistoryData, ImportResultSummary } from '@jetstream/ui/db';
import { useState } from 'react';

function getImportedTotal(summary: ImportResultSummary): number {
  return Object.values(summary).reduce((total, count) => total + count, 0);
}

export const SettingsExportImportHistory = () => {
  const { trackEvent } = useAmplitude();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    try {
      setExporting(true);
      const envelope = await exportClientHistoryData();
      saveFile(JSON.stringify(envelope, null, 2), `jetstream-history-${Date.now()}.json`, MIME_TYPES.JSON);
      trackEvent(ANALYTICS_KEYS.settings_export_history);
      fireToast({ message: 'Your history was exported successfully.', type: 'success' });
    } catch (ex) {
      logger.error('[SETTINGS] Error exporting history', ex);
      fireToast({
        message: 'There was a problem exporting your history. Try again or file a support ticket for assistance.',
        type: 'error',
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleImport({ content }: InputReadFileContent) {
    try {
      setImporting(true);
      // FileSelector reads non-text extensions as an ArrayBuffer, so normalize to a string before parsing.
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      const summary = await importClientHistoryData(JSON.parse(text));
      trackEvent(ANALYTICS_KEYS.settings_import_history, summary);
      fireToast({
        message: `Imported ${getImportedTotal(summary)} history record(s). Refresh the page to see imported Apex, API, and deployment history.`,
        type: 'success',
      });
    } catch (ex) {
      logger.error('[SETTINGS] Error importing history', ex);
      fireToast({
        message: 'We could not import that file. Make sure it is an unmodified Jetstream history export and try again.',
        type: 'error',
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="slds-m-top_large">
      <h2 className="slds-text-heading_medium slds-m-vertical_small">Export / Import History</h2>
      <p className="slds-m-bottom_small">
        Export your query, load mapping, API, Apex, deployment, and recent record history to a file to back it up or move it to another
        browser. Importing merges the file into your existing history without creating duplicates.
      </p>
      <button className="slds-button slds-button_neutral slds-is-relative" disabled={exporting} onClick={handleExport}>
        {exporting && <Spinner className="slds-spinner slds-spinner_small" />}
        Export History
      </button>
      <div className="slds-m-top_small slds-size_1-of-1 slds-medium-size_1-of-2">
        <FileSelector
          id="import-history-file"
          label="Import History"
          buttonLabel="Choose Export File"
          accept={[INPUT_ACCEPT_FILETYPES.JSON]}
          disabled={importing}
          userHelpText="Select a previously exported Jetstream history file (.json)."
          onReadFile={handleImport}
        />
        {importing && <Spinner className="slds-spinner slds-spinner_small" />}
      </div>
    </div>
  );
};

export default SettingsExportImportHistory;
