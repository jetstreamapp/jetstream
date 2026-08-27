import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { DataHistoryItem, FileExtAllTypes, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal, fireToast, Modal, Spinner } from '@jetstream/ui';
import { useAnalytics } from '@jetstream/ui-core';
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
  /** Which surface opened the download — the only thing that differs between hosts in the analytics payload */
  analyticsLocation: 'detail-modal' | 'table';
  onClose: () => void;
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
  analyticsLocation,
  onClose,
  onError = fireToast,
}) => {
  const { trackEvent } = useAnalytics();
  const orgs = useAtomValue(fromAppState.salesforceOrgsState);
  const [view, setView] = useState<DataHistoryPayloadView | null>(null);
  // The org is only used for the generated filename — history outlives org removal, so fall back to the label snapshot
  const org = orgs.find(({ uniqueId }) => uniqueId === item.org) ?? ({ username: item.orgLabel } as SalesforceOrgUi);
  const chosenFormat = useRef<FileExtAllTypes>('csv');

  /** `format` is `raw-csv`/`raw-json` for the stored-format fallback */
  function trackDownloaded(format: string) {
    trackEvent(ANALYTICS_KEYS.data_history_download, {
      kind: target.kind,
      view: target.viewId,
      format,
      source: item.source,
      location: analyticsLocation,
    });
  }

  useEffect(() => {
    // Closing the modal mid-read must cancel it: the raw fallback SAVES A FILE as its side effect, and would
    // otherwise still save (and report a download) seconds after the user dismissed the dialog
    let cancelled = false;
    (async () => {
      try {
        const exportData = await loadDataHistoryExportData(item, target.kind, target);
        if (cancelled) {
          return;
        }
        if (exportData.type === 'missing') {
          onError({ type: 'warning', message: 'This data is no longer available on this device.' });
          onClose();
          return;
        }
        if (exportData.type === 'raw') {
          saveRawDataHistoryFile(item, exportData);
          if (exportData.reason === 'too-large') {
            onError({ type: 'info', message: 'This file is too large to convert, so it was downloaded in its original format.' });
          }
          trackDownloaded(exportData.contentType === 'text/csv' ? 'raw-csv' : 'raw-json');
          onClose();
          return;
        }
        setView(exportData.view);
      } catch (ex) {
        if (cancelled) {
          return;
        }
        logger.warn('[DATA_HISTORY] Error preparing download', ex);
        onError({ type: 'error', message: getDataHistoryReadErrorMessage(ex) });
        onClose();
      }
    })();
    return () => {
      cancelled = true;
    };
    // One read per mount: both hosts mount this modal per download (item/target are fixed for its life) and
    // pass an inline onClose, so listing deps would restart the read on every parent render.
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
          trackDownloaded(chosenFormat.current);
        }
        onClose();
      }}
    />
  );
};
