import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { DataHistoryFileKind, DataHistoryItem } from '@jetstream/types';
import { Badge, fireToast, Grid, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { readDataHistoryFile } from '@jetstream/ui/data-history';
import { Fragment, FunctionComponent, useState } from 'react';
import { downloadDataHistoryFile } from './data-history-download';
import {
  buildDataHistoryPreviewText,
  DATA_HISTORY_SOURCE_LABELS,
  DATA_HISTORY_STATUS_LABELS,
  formatDataHistoryCounts,
  formatDataHistoryDate,
  formatDataHistorySize,
  getAvailableFileKinds,
  getDataHistoryStatusBadgeType,
} from './data-history-page.utils';

export interface DataHistoryDetailModalProps {
  item: DataHistoryItem;
  onClose: () => void;
  onDownload: (kind: DataHistoryFileKind) => void;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="slds-m-bottom_xx-small">
      <span className="slds-text-title_caps slds-m-right_x-small">{label}</span>
      <span>{children}</span>
    </div>
  );
}

export const DataHistoryDetailModal: FunctionComponent<DataHistoryDetailModalProps> = ({ item, onClose, onDownload }) => {
  const [loadingKind, setLoadingKind] = useState<DataHistoryFileKind | null>(null);
  const [preview, setPreview] = useState<{ kind: DataHistoryFileKind; text: string; truncated: boolean } | null>(null);

  const availableFiles = getAvailableFileKinds(item);
  const hasProcessingErrors = (item.counts.processingErrors ?? 0) > 0;

  async function handlePreview(kind: DataHistoryFileKind) {
    try {
      setLoadingKind(kind);
      const file = await readDataHistoryFile(item, kind);
      if (!file) {
        fireToast({ type: 'warning', message: 'This data is no longer available on this device.' });
        return;
      }
      setPreview({ kind, ...buildDataHistoryPreviewText(await file.blob.text()) });
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error previewing file', ex);
      fireToast({ type: 'error', message: 'There was a problem reading this data from local storage.' });
    } finally {
      setLoadingKind(null);
    }
  }

  async function handleDownload(kind: DataHistoryFileKind) {
    setLoadingKind(kind);
    try {
      if (await downloadDataHistoryFile(item, kind)) {
        onDownload(kind);
      }
    } finally {
      setLoadingKind(null);
    }
  }

  return (
    <Modal
      header="Data History Detail"
      tagline={`${DATA_HISTORY_SOURCE_LABELS[item.source]} — ${item.orgLabel}`}
      size="lg"
      closeOnEsc
      className="slds-is-relative"
      footer={
        <button className="slds-button slds-button_brand" onClick={onClose}>
          Close
        </button>
      }
      onClose={onClose}
    >
      <div className="slds-p-around_small">
        {item.errorMessage && (
          <ScopedNotification theme="error" className="slds-m-bottom_small">
            {item.errorMessage}
          </ScopedNotification>
        )}
        <Grid wrap gutters>
          <div className="slds-col slds-size_1-of-2">
            <DetailRow label="Status">
              <Badge type={getDataHistoryStatusBadgeType(item.status)}>{DATA_HISTORY_STATUS_LABELS[item.status]}</Badge>
            </DetailRow>
            <DetailRow label="Records">{formatDataHistoryCounts(item)}</DetailRow>
            {hasProcessingErrors && (
              <DetailRow label="Processing Errors">
                {`${item.counts.processingErrors?.toLocaleString()} record(s) failed before being submitted to Salesforce`}
              </DetailRow>
            )}
            <DetailRow label="Object(s)">{item.sobjects.join(', ') || '—'}</DetailRow>
            <DetailRow label="Operation">{item.operation}</DetailRow>
            <DetailRow label="API">{item.api}</DetailRow>
            {item.jobId && <DetailRow label="Bulk Job Id">{item.jobId}</DetailRow>}
          </div>
          <div className="slds-col slds-size_1-of-2">
            <DetailRow label="Started">{formatDataHistoryDate(item.startedAt)}</DetailRow>
            <DetailRow label="Finished">{formatDataHistoryDate(item.finishedAt)}</DetailRow>
            <DetailRow label="Storage Used">{formatDataHistorySize(item.sizeBytes)}</DetailRow>
            {item.inputSource?.fileName && <DetailRow label="Input File">{item.inputSource.fileName}</DetailRow>}
            {item.parentKey && <DetailRow label="Retry Of">{item.parentKey}</DetailRow>}
          </div>
        </Grid>

        <h3 className="slds-text-heading_small slds-m-top_medium slds-m-bottom_x-small">Saved Data</h3>
        {availableFiles.length === 0 && <p className="slds-text-color_weak">No request or result data was saved for this entry.</p>}
        {availableFiles.map(({ kind, label, bytes }) => (
          <Grid key={kind} verticalAlign="center" className="slds-m-bottom_x-small">
            <span
              css={css`
                min-width: 10rem;
              `}
            >
              {label}
              {bytes ? <span className="slds-text-color_weak slds-m-left_x-small">({formatDataHistorySize(bytes)})</span> : null}
            </span>
            <button
              className="slds-button slds-button_neutral slds-m-left_small slds-is-relative"
              disabled={loadingKind === kind}
              onClick={() => handlePreview(kind)}
            >
              {loadingKind === kind && <Spinner size="x-small" />}
              Preview
            </button>
            <button
              className="slds-button slds-button_neutral slds-m-left_x-small"
              disabled={loadingKind === kind}
              onClick={() => handleDownload(kind)}
            >
              Download
            </button>
          </Grid>
        ))}

        {preview && (
          <Fragment>
            <h3 className="slds-text-heading_small slds-m-top_medium slds-m-bottom_x-small">
              Preview — {DATA_HISTORY_SOURCE_LABELS[item.source]} {preview.kind}
              {preview.truncated && (
                <span className="slds-text-color_weak slds-m-left_x-small">(truncated — download for the full data)</span>
              )}
            </h3>
            <pre
              className="slds-p-around_x-small"
              css={css`
                max-height: 300px;
                overflow: auto;
                background-color: var(--slds-g-color-neutral-base-95, #f3f3f3);
                font-size: 0.75rem;
                white-space: pre;
              `}
            >
              {preview.text}
            </pre>
          </Fragment>
        )}

        {Object.keys(item.config).length > 0 && (
          <Fragment>
            <h3 className="slds-text-heading_small slds-m-top_medium slds-m-bottom_x-small">Configuration</h3>
            <pre
              className="slds-p-around_x-small"
              css={css`
                max-height: 200px;
                overflow: auto;
                background-color: var(--slds-g-color-neutral-base-95, #f3f3f3);
                font-size: 0.75rem;
                white-space: pre;
              `}
            >
              {JSON.stringify(item.config, null, 2)}
            </pre>
          </Fragment>
        )}
      </div>
    </Modal>
  );
};
