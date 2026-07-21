import { css } from '@emotion/react';
import { DataHistoryFileKind, DataHistoryItem, UiTabSection } from '@jetstream/types';
import { Badge, Grid, Modal, ScopedNotification, Spinner, Tabs, TabsRef } from '@jetstream/ui';
import { FunctionComponent, useMemo, useRef, useState } from 'react';
import { downloadDataHistoryFile } from './data-history-download';
import {
  DATA_HISTORY_SOURCE_LABELS,
  DATA_HISTORY_STATUS_LABELS,
  formatDataHistoryCounts,
  formatDataHistoryDate,
  formatDataHistorySize,
  getAvailableFileKinds,
  getDataHistoryStatusBadgeType,
} from './data-history-page.utils';
import { DataHistoryPayloadCache, DataHistoryPayloadTab } from './DataHistoryPayloadTab';

export interface DataHistoryDetailModalProps {
  item: DataHistoryItem;
  onClose: () => void;
  onDownload: (kind: DataHistoryFileKind) => void;
}

const jsonStyles = css`
  max-height: 20rem;
  overflow: auto;
  background-color: var(--slds-g-color-neutral-base-95, #f3f3f3);
  font-size: 0.75rem;
  white-space: pre;
`;

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="slds-m-bottom_xx-small">
      <span className="slds-text-title_caps slds-m-right_x-small">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function tabIdForKind(kind: DataHistoryFileKind): string {
  return `payload-${kind}`;
}

export const DataHistoryDetailModal: FunctionComponent<DataHistoryDetailModalProps> = ({ item, onClose, onDownload }) => {
  const tabsRef = useRef<TabsRef>(null);
  // Parsed payloads are cached here (stable Map identity) so switching tabs does not re-read/re-parse the files
  const [payloadCache] = useState<DataHistoryPayloadCache>(() => new Map());
  const [downloadingKind, setDownloadingKind] = useState<DataHistoryFileKind | null>(null);
  // Download errors surface here — a toast would render behind the modal's overlay
  const [fileError, setFileError] = useState<{ theme: 'warning' | 'error'; message: string } | null>(null);

  const availableFiles = useMemo(() => getAvailableFileKinds(item), [item]);
  const hasProcessingErrors = (item.counts.processingErrors ?? 0) > 0;

  async function handleDownload(kind: DataHistoryFileKind) {
    setFileError(null);
    setDownloadingKind(kind);
    try {
      if (await downloadDataHistoryFile(item, kind, { onError: (info) => setFileError({ theme: info.type, message: info.message }) })) {
        onDownload(kind);
      }
    } finally {
      setDownloadingKind(null);
    }
  }

  const summaryContent = (
    <div className="slds-p-around_x-small">
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
            className="slds-button slds-button_neutral slds-m-left_small"
            onClick={() => tabsRef.current?.changeTab(tabIdForKind(kind))}
          >
            Preview
          </button>
          <button
            className="slds-button slds-button_neutral slds-m-left_x-small slds-is-relative"
            disabled={downloadingKind === kind}
            onClick={() => handleDownload(kind)}
          >
            {downloadingKind === kind && <Spinner size="x-small" />}
            Download
          </button>
        </Grid>
      ))}

      {Object.keys(item.config).length > 0 && (
        <>
          <h3 className="slds-text-heading_small slds-m-top_medium slds-m-bottom_x-small">Configuration</h3>
          <pre className="slds-p-around_x-small" css={jsonStyles}>
            {JSON.stringify(item.config, null, 2)}
          </pre>
        </>
      )}
    </div>
  );

  const tabs: UiTabSection[] = [
    { id: 'summary', title: 'Summary', content: summaryContent },
    ...availableFiles.map(({ kind, label }) => ({
      id: tabIdForKind(kind),
      title: label,
      content: (
        <DataHistoryPayloadTab item={item} kind={kind} cache={payloadCache} onDownloaded={(downloadedKind) => onDownload(downloadedKind)} />
      ),
    })),
  ];

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
      {fileError && (
        <ScopedNotification theme={fileError.theme} className="slds-m-around_small">
          {fileError.message}
        </ScopedNotification>
      )}
      <Tabs ref={tabsRef} tabs={tabs} initialActiveId="summary" />
    </Modal>
  );
};
