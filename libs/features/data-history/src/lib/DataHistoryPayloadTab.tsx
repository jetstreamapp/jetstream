import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { DataHistoryFileKind, DataHistoryItem } from '@jetstream/types';
import { DataTable, ScopedNotification, Spinner } from '@jetstream/ui';
import { readDataHistoryFile } from '@jetstream/ui/data-history';
import { FunctionComponent, useEffect, useState } from 'react';
import { downloadDataHistoryFile, getDataHistoryReadErrorMessage } from './data-history-download';
import { buildDataHistoryPreviewText, DataHistoryTableData, DataHistoryTableRow, parseCsvToTable } from './data-history-page.utils';

/** Parsed payload cached at the modal level so switching tabs does not re-read/re-parse the file. */
export interface LoadedDataHistoryPayload {
  table?: DataHistoryTableData;
  jsonText?: string;
  jsonTruncated?: boolean;
}

export type DataHistoryPayloadCache = Map<DataHistoryFileKind, LoadedDataHistoryPayload>;

export interface DataHistoryPayloadTabProps {
  item: DataHistoryItem;
  kind: DataHistoryFileKind;
  cache: DataHistoryPayloadCache;
  onDownloaded: (kind: DataHistoryFileKind) => void;
}

const tableContainerStyles = css`
  height: 55vh;
  position: relative;
`;

const jsonStyles = css`
  max-height: 55vh;
  overflow: auto;
  background-color: var(--slds-g-color-neutral-base-95, #f3f3f3);
  font-size: 0.75rem;
  white-space: pre;
`;

export const DataHistoryPayloadTab: FunctionComponent<DataHistoryPayloadTabProps> = ({ item, kind, cache, onDownloaded }) => {
  const [payload, setPayload] = useState<LoadedDataHistoryPayload | null>(() => cache.get(kind) ?? null);
  const [loading, setLoading] = useState(!cache.has(kind));
  const [error, setError] = useState<{ theme: 'warning' | 'error'; message: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (cache.has(kind)) {
      setPayload(cache.get(kind) ?? null);
      setLoading(false);
      return;
    }
    let canceled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const file = await readDataHistoryFile(item, kind);
        if (!file) {
          if (!canceled) {
            setError({ theme: 'warning', message: 'This data is no longer available on this device.' });
          }
          return;
        }
        const text = await file.blob.text();
        const loaded: LoadedDataHistoryPayload =
          file.contentType === 'text/csv' ? { table: parseCsvToTable(text) } : buildJsonPreview(text);
        cache.set(kind, loaded);
        if (!canceled) {
          setPayload(loaded);
        }
      } catch (ex) {
        logger.warn('[DATA_HISTORY] Error loading payload', ex);
        if (!canceled) {
          setError({ theme: 'error', message: getDataHistoryReadErrorMessage(ex) });
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [item, kind, cache]);

  async function handleDownload() {
    setDownloading(true);
    try {
      if (await downloadDataHistoryFile(item, kind, { onError: (info) => setError({ theme: info.type, message: info.message }) })) {
        onDownloaded(kind);
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div className="slds-grid slds-grid_align-end slds-m-bottom_x-small">
        <button className="slds-button slds-button_neutral slds-is-relative" disabled={downloading} onClick={handleDownload}>
          {downloading && <Spinner size="x-small" />}
          Download
        </button>
      </div>

      {error && (
        <ScopedNotification theme={error.theme} className="slds-m-bottom_small">
          {error.message}
        </ScopedNotification>
      )}

      {loading && (
        <div className="slds-is-relative slds-p-vertical_large">
          <Spinner />
        </div>
      )}

      {!loading && payload?.table && (
        <div css={tableContainerStyles}>
          <DataTable<DataHistoryTableRow>
            data={payload.table.rows}
            columns={payload.table.columns}
            getRowKey={(row) => row._dhRowKey}
            includeQuickFilter
          />
        </div>
      )}

      {!loading && payload?.jsonText != null && (
        <div>
          {payload.jsonTruncated && (
            <p className="slds-text-color_weak slds-m-bottom_xx-small">Showing a preview — download for the full data.</p>
          )}
          <pre className="slds-p-around_x-small" css={jsonStyles}>
            {payload.jsonText}
          </pre>
        </div>
      )}

      {!loading && !error && !payload && <p className="slds-text-color_weak">No data to display.</p>}
    </div>
  );
};

function buildJsonPreview(text: string): LoadedDataHistoryPayload {
  let formatted = text;
  try {
    formatted = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // not valid JSON — show the raw text
  }
  const { text: jsonText, truncated } = buildDataHistoryPreviewText(formatted);
  return { jsonText, jsonTruncated: truncated };
}
