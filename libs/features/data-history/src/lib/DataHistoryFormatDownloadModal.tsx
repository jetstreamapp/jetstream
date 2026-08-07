import { logger } from '@jetstream/shared/client-logger';
import { DataHistoryItem, FileExtAllTypes, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal, fireToast, Modal, Spinner } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import {
  DataHistoryErrorInfo,
  getDataHistoryReadErrorMessage,
  loadDataHistoryExportData,
  saveRawDataHistoryFile,
} from './data-history-download';
import { DataHistoryExportTarget, DataHistoryPayloadView, flattenPayloadRows } from './data-history-payload-views';

export interface DataHistoryFormatDownloadModalProps {
  item: DataHistoryItem;
  target: DataHistoryExportTarget;
  onClose: () => void;
  /** Fired after the file was saved. `format` is `raw-csv`/`raw-json` for the stored-format fallback. */
  onDownloaded: (target: DataHistoryExportTarget, format: string) => void;
  /** Report failures here instead of a toast — used by the detail modal, where toasts render behind the overlay */
  onError?: (info: DataHistoryErrorInfo) => void;
}

/**
 * Download flow for a saved payload: reads the full payload, then opens the standard file download
 * modal (CSV / Excel / JSON) — the same experience as query results and load results downloads.
 * Payloads that cannot be format-converted (nested JSON, or too large to parse) are saved in their
 * stored format instead.
 */
export const DataHistoryFormatDownloadModal: FunctionComponent<DataHistoryFormatDownloadModalProps> = ({
  item,
  target,
  onClose,
  onDownloaded,
  onError = fireToast,
}) => {
  const { trackEvent } = useAmplitude();
  const orgs = useAtomValue(fromAppState.salesforceOrgsState);
  const [view, setView] = useState<DataHistoryPayloadView | null>(null);
  // The org is only used for the generated filename — history outlives org removal, so fall back to the label snapshot
  const org = orgs.find(({ uniqueId }) => uniqueId === item.org) ?? ({ username: item.orgLabel } as SalesforceOrgUi);
  const chosenFormat = useRef<FileExtAllTypes>('csv');
  // Guards the load effect from re-running (e.g. React StrictMode) — the raw fallback SAVES A FILE as its side effect
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    (async () => {
      try {
        const exportData = await loadDataHistoryExportData(item, target.kind, target);
        if (exportData.type === 'missing') {
          onError({ type: 'warning', message: 'This data is no longer available on this device.' });
          onClose();
          return;
        }
        if (exportData.type === 'raw') {
          saveRawDataHistoryFile(item, exportData);
          if (exportData.reason === 'too-large') {
            fireToast({ type: 'info', message: 'This file is too large to convert, so it was downloaded in its original format.' });
          }
          onDownloaded(target, exportData.contentType === 'text/csv' ? 'raw-csv' : 'raw-json');
          onClose();
          return;
        }
        setView(exportData.view);
      } catch (ex) {
        logger.warn('[DATA_HISTORY] Error preparing download', ex);
        onError({ type: 'error', message: getDataHistoryReadErrorMessage(ex) });
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!view) {
    return (
      <Modal header="Download" overrideZIndex={1001} onClose={onClose}>
        <div className="slds-is-relative slds-p-vertical_large">
          <Spinner />
        </div>
      </Modal>
    );
  }

  return (
    <FileDownloadModal
      org={org}
      googleIntegrationEnabled={false}
      googleShowUpgradeToPro={false}
      modalHeader={`Download ${target.label}`}
      allowedTypes={['xlsx', 'csv', 'json']}
      data={view.rows}
      header={view.header}
      fileNameParts={[item.source, ...item.sobjects.slice(0, 2), target.slug]}
      // JSON keeps the raw row objects; spreadsheet formats get flattened/normalized columns
      transformData={({ fileFormat, data }) =>
        fileFormat === 'json' ? data : flattenPayloadRows(data as Record<string, unknown>[], view.header)
      }
      source="data_history"
      trackEvent={trackEvent}
      onChange={({ fileFormat }) => {
        chosenFormat.current = fileFormat;
      }}
      onModalClose={(canceled) => {
        if (!canceled) {
          onDownloaded(target, chosenFormat.current);
        }
        onClose();
      }}
    />
  );
};
