import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { CopyAsDataType, DataHistoryFileKind, DataHistoryItem } from '@jetstream/types';
import {
  ButtonGroupContainer,
  DataTable,
  DropDown,
  Icon,
  RadioButton,
  RadioGroup,
  ScopedNotification,
  Spinner,
  Tooltip,
} from '@jetstream/ui';
import { readDataHistoryFile } from '@jetstream/ui/data-history';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { copyDataHistoryPayloadToClipboard, DataHistoryErrorInfo, getDataHistoryReadErrorMessage } from './data-history-download';
import {
  buildDataHistoryPreviewText,
  buildTableFromPayloadView,
  DATA_HISTORY_CSV_PREVIEW_MAX_ROWS,
  DATA_HISTORY_PREVIEW_MAX_BYTES,
  DataHistoryTableData,
  DataHistoryTableRow,
  getDataHistoryExportTargets,
} from './data-history-page.utils';
import { DataHistoryExportTarget, parseDataHistoryPayloadViews } from './data-history-payload-views';

interface LoadedPayloadViewTable {
  id: string;
  label: string;
  table: DataHistoryTableData;
}

/** Parsed payload cached at the modal level so switching tabs does not re-read/re-parse the file. */
export interface LoadedDataHistoryPayload {
  viewTables?: LoadedPayloadViewTable[];
  jsonText?: string;
  jsonTruncated?: boolean;
}

export type DataHistoryPayloadCache = Map<DataHistoryFileKind, LoadedDataHistoryPayload>;

export interface DataHistoryPayloadTabProps {
  item: DataHistoryItem;
  kind: DataHistoryFileKind;
  cache: DataHistoryPayloadCache;
  /**
   * Modal-level record of each tab's selected view. The tab unmounts whenever the detail modal is
   * hidden behind the download modal, so the selection must outlive this component.
   */
  viewStateCache: Map<DataHistoryFileKind, string>;
  /** Open the format download modal for the given target (hosted by the detail modal) */
  onRequestDownload: (target: DataHistoryExportTarget) => void;
  onCopied: (format: CopyAsDataType) => void;
}

const tableContainerStyles = css`
  height: 50vh;
  position: relative;
`;

const jsonStyles = css`
  max-height: 55vh;
  overflow: auto;
  background-color: var(--slds-g-color-neutral-base-95, #f3f3f3);
  font-size: 0.75rem;
  white-space: pre;
`;

export const DataHistoryPayloadTab: FunctionComponent<DataHistoryPayloadTabProps> = ({
  item,
  kind,
  cache,
  viewStateCache,
  onRequestDownload,
  onCopied,
}) => {
  const [payload, setPayload] = useState<LoadedDataHistoryPayload | null>(() => cache.get(kind) ?? null);
  const [loading, setLoading] = useState(!cache.has(kind));
  const [error, setError] = useState<DataHistoryErrorInfo | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(() => viewStateCache.get(kind) ?? null);
  const [copying, setCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const targets = getDataHistoryExportTargets(item).filter((target) => target.kind === kind);
  const viewTables = payload?.viewTables ?? [];
  const activeViewTable = viewTables.find((viewTable) => viewTable.id === activeViewId) ?? viewTables[0];
  // For multi-view payloads the download/copy acts on the view the user is looking at
  const activeTarget = targets.find((target) => target.viewId === activeViewTable?.id) ?? targets[0];

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
            setError({ type: 'warning', message: 'This data is no longer available on this device.' });
          }
          return;
        }
        // Read only the HEAD of the payload. Request payloads hold every submitted record (a large
        // mass update runs to hundreds of MB), and materializing that as one string — let alone
        // parsing it — freezes or crashes the tab. Downloads always read the full file.
        const isPartialRead = file.blob.size > DATA_HISTORY_PREVIEW_MAX_BYTES;
        const text = await (isPartialRead ? file.blob.slice(0, DATA_HISTORY_PREVIEW_MAX_BYTES) : file.blob).text();
        const loaded = buildPayloadPreview(text, file.contentType, isPartialRead);
        cache.set(kind, loaded);
        if (!canceled) {
          setPayload(loaded);
        }
      } catch (ex) {
        logger.warn('[DATA_HISTORY] Error loading payload', ex);
        if (!canceled) {
          setError({ type: 'error', message: getDataHistoryReadErrorMessage(ex) });
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

  async function handleCopy(format: CopyAsDataType) {
    setCopying(true);
    setCopySuccess(false);
    setError(null);
    try {
      const { success, error: copyError } = await copyDataHistoryPayloadToClipboard(item, kind, format, activeTarget);
      if (success) {
        setCopySuccess(true);
        onCopied(format);
      } else if (copyError) {
        setError(copyError);
      }
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="slds-p-around_x-small">
      <div className="slds-grid slds-grid_vertical-align-center slds-m-bottom_x-small">
        {viewTables.length > 1 && (
          <RadioGroup isButtonGroup className="slds-m-right_x-small">
            {viewTables.map(({ id, label }) => (
              <RadioButton
                key={id}
                id={`payload-view-${kind}-${id}`}
                name={`payload-view-${kind}`}
                label={label}
                value={id}
                checked={id === activeViewTable?.id}
                onChange={(value) => {
                  setActiveViewId(value);
                  viewStateCache.set(kind, value);
                  setCopySuccess(false);
                }}
              />
            ))}
          </RadioGroup>
        )}
        <button className="slds-button slds-button_neutral" disabled={loading || !!error} onClick={() => onRequestDownload(activeTarget)}>
          <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
          Download
        </button>
        <ButtonGroupContainer className="slds-m-left_x-small">
          <Tooltip
            openDelay={1000}
            content="This will copy in a format compatible with a spreadsheet program, such as Excel or Google Sheets. Use the dropdown for additional options."
          >
            <button
              className="slds-button slds-button_neutral slds-button_first slds-is-relative"
              disabled={loading || copying || !!error}
              onClick={() => handleCopy('excel')}
            >
              {copying && <Spinner size="x-small" />}
              <Icon type="utility" icon="copy_to_clipboard" className="slds-button__icon slds-button__icon_left" omitContainer />
              Copy to Clipboard
            </button>
          </Tooltip>
          <DropDown
            className="slds-button_last"
            dropDownClassName="slds-dropdown_actions"
            position="left"
            disabled={loading || copying || !!error}
            items={[
              { id: 'csv', value: 'Copy as CSV' },
              { id: 'json', value: 'Copy as JSON' },
            ]}
            onSelected={(id) => handleCopy(id as CopyAsDataType)}
          />
        </ButtonGroupContainer>
        {copySuccess && (
          <span className="slds-text-color_success slds-m-left_x-small">
            <Icon
              type="utility"
              icon="success"
              className="slds-icon slds-icon-text-success slds-icon_xx-small slds-m-right_xx-small"
              omitContainer
            />
            Copied to clipboard
          </span>
        )}
      </div>

      {error && (
        <ScopedNotification theme={error.type} className="slds-m-bottom_small">
          {error.message}
        </ScopedNotification>
      )}

      {loading && (
        <div className="slds-is-relative slds-p-vertical_large">
          <Spinner />
        </div>
      )}

      {!loading && activeViewTable && (
        <Fragment>
          {activeViewTable.table.truncated && (
            <p className="slds-text-color_weak slds-m-bottom_xx-small">
              Showing the first {activeViewTable.table.rows.length.toLocaleString()} rows. Download the file to see everything.
            </p>
          )}
          <div css={tableContainerStyles}>
            <DataTable<DataHistoryTableRow>
              data={activeViewTable.table.rows}
              columns={activeViewTable.table.columns}
              getRowKey={(row) => row._dhRowKey}
              includeQuickFilter
              autoRowHeight
            />
          </div>
        </Fragment>
      )}

      {!loading && !activeViewTable && payload?.jsonText != null && (
        <div>
          {payload.jsonTruncated && (
            <p className="slds-text-color_weak slds-m-bottom_xx-small">Showing a preview. Download the file to see everything.</p>
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

/**
 * Build the preview representation from the payload's head: tabular views become tables (capped at
 * `DATA_HISTORY_CSV_PREVIEW_MAX_ROWS`), everything else falls back to (pretty-printed) JSON text.
 *
 * A partially-read JSON payload cannot parse (it is a fragment of a larger document), and
 * `JSON.parse` + re-`stringify` on a multi-MB string is exactly the main-thread spike the capped
 * read exists to avoid — so partial JSON reads always show the raw text fragment.
 */
function buildPayloadPreview(text: string, contentType: 'text/csv' | 'application/json', isPartialRead: boolean): LoadedDataHistoryPayload {
  if (contentType === 'text/csv') {
    // Read one extra row so truncation can be detected (and reported) without parsing the whole file
    const views = parseDataHistoryPayloadViews(text, contentType, { maxCsvRows: DATA_HISTORY_CSV_PREVIEW_MAX_ROWS + 1 });
    if (views.length > 0) {
      return {
        viewTables: views.map((view) => ({
          id: view.id,
          label: view.label,
          table: buildTableFromPayloadView(view, DATA_HISTORY_CSV_PREVIEW_MAX_ROWS, isPartialRead),
        })),
      };
    }
    const { text: jsonText, truncated } = buildDataHistoryPreviewText(text);
    return { jsonText, jsonTruncated: isPartialRead || truncated };
  }

  if (!isPartialRead) {
    const views = parseDataHistoryPayloadViews(text, contentType);
    if (views.length > 0) {
      return {
        viewTables: views.map((view) => ({
          id: view.id,
          label: view.label,
          table: buildTableFromPayloadView(view, DATA_HISTORY_CSV_PREVIEW_MAX_ROWS),
        })),
      };
    }
  }

  let formatted = text;
  if (!isPartialRead) {
    try {
      formatted = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // not valid JSON — show the raw text
    }
  }
  const { text: jsonText, truncated } = buildDataHistoryPreviewText(formatted);
  return { jsonText, jsonTruncated: isPartialRead || truncated };
}
