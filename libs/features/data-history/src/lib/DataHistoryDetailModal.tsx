import { css } from '@emotion/react';
import { DataHistoryFileKind, DataHistoryItem, UiTabSection } from '@jetstream/types';
import { Badge, DropDown, Grid, Icon, Modal, ScopedNotification, Tabs, TabsRef } from '@jetstream/ui';
import { Fragment, FunctionComponent, useMemo, useRef, useState } from 'react';
import { DataHistoryErrorInfo } from './data-history-download';
import {
  DATA_HISTORY_API_LABELS,
  DATA_HISTORY_OPERATION_LABELS,
  DATA_HISTORY_SOURCE_LABELS,
  DATA_HISTORY_STATUS_LABELS,
  formatDataHistoryCounts,
  formatDataHistoryDate,
  formatDataHistorySize,
  getAvailableFileKinds,
  getDataHistoryConfigDisplayItems,
  getDataHistoryEntryFolderPath,
  getDataHistoryExportTargets,
  getDataHistoryStatusBadgeType,
} from './data-history-page.utils';
import { DataHistoryExportTarget } from './data-history-payload-views';
import { DataHistoryFormatDownloadModal } from './DataHistoryFormatDownloadModal';
import { DataHistoryPayloadCache, DataHistoryPayloadTab } from './DataHistoryPayloadTab';

export interface DataHistoryDetailModalProps {
  item: DataHistoryItem;
  onClose: () => void;
  /** Open another entry in this modal (used by the "Retry Of" link to jump to the original run) */
  onViewEntry?: (key: string) => void;
}

/** One label/value pair — render inside a `<dl className="slds-dl_horizontal">` */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Fragment>
      <dt className="slds-dl_horizontal__label slds-m-bottom_xx-small">
        <strong>{label}</strong>
      </dt>
      <dd className="slds-dl_horizontal__detail slds-m-bottom_xx-small">{children}</dd>
    </Fragment>
  );
}

function tabIdForKind(kind: DataHistoryFileKind): string {
  return `payload-${kind}`;
}

export const DataHistoryDetailModal: FunctionComponent<DataHistoryDetailModalProps> = ({ item, onClose, onViewEntry }) => {
  const tabsRef = useRef<TabsRef>(null);
  // Parsed payloads are cached here (stable Map identity) so switching tabs does not re-read/re-parse the files
  const [payloadCache] = useState<DataHistoryPayloadCache>(() => new Map());
  // The modal is HIDDEN (children unmounted) while the download modal is open, so anything the user
  // would notice resetting is lifted here: the active tab, and each payload tab's selected view
  const [activeTabId, setActiveTabId] = useState('summary');
  const [viewStateCache] = useState<Map<DataHistoryFileKind, string>>(() => new Map());
  // When set, the format download modal (CSV/Excel/JSON) is open for this payload
  const [downloadTarget, setDownloadTarget] = useState<DataHistoryExportTarget | null>(null);
  // Download errors surface here — a toast would render behind the modal's overlay
  const [fileError, setFileError] = useState<DataHistoryErrorInfo | null>(null);

  const availableFiles = useMemo(() => getAvailableFileKinds(item), [item]);
  const exportTargets = useMemo(() => getDataHistoryExportTargets(item), [item]);
  const configItems = useMemo(() => getDataHistoryConfigDisplayItems(item), [item]);
  const entryFolderPath = getDataHistoryEntryFolderPath(item);
  const hasProcessingErrors = (item.counts.processingErrors ?? 0) > 0;

  function openDownload(target: DataHistoryExportTarget) {
    setFileError(null);
    setDownloadTarget(target);
  }

  // Every Saved Data row renders identical "Preview"/"Download" buttons — the accessible names carry
  // the row's label (e.g. "Download Request data") so screen reader users know which file they act on
  function renderDownloadControl(kind: DataHistoryFileKind, label: string) {
    const targets = exportTargets.filter((target) => target.kind === kind);
    if (targets.length === 0) {
      return null;
    }
    if (targets.length === 1) {
      return (
        <button
          className="slds-button slds-button_neutral slds-m-left_x-small"
          aria-label={`Download ${label}`}
          onClick={() => openDownload(targets[0])}
        >
          <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
          Download
        </button>
      );
    }
    return (
      <DropDown
        className="slds-m-left_x-small"
        buttonClassName="slds-button slds-button_neutral"
        buttonContent={
          <span>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download
            <span className="slds-assistive-text"> {label}</span>
            <Icon
              type="utility"
              icon="down"
              className="slds-button__icon slds-button__icon_right slds-button__icon_x-small"
              omitContainer
            />
          </span>
        }
        actionText={`Download ${label}`}
        items={targets.map((target) => ({ id: `${target.kind}:${target.viewId ?? ''}`, value: target.label, metadata: target }))}
        onSelected={(_, target) => openDownload(target as DataHistoryExportTarget)}
      />
    );
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
          <dl className="slds-dl_horizontal">
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
            <DetailRow label="Operation">{DATA_HISTORY_OPERATION_LABELS[item.operation]}</DetailRow>
            <DetailRow label="API">{DATA_HISTORY_API_LABELS[item.api]}</DetailRow>
            {item.jobId && <DetailRow label="Bulk Job Id">{item.jobId}</DetailRow>}
          </dl>
        </div>
        <div className="slds-col slds-size_1-of-2">
          <dl className="slds-dl_horizontal">
            <DetailRow label="Started">{formatDataHistoryDate(item.startedAt)}</DetailRow>
            <DetailRow label="Finished">{formatDataHistoryDate(item.finishedAt)}</DetailRow>
            <DetailRow label="Storage Used">{formatDataHistorySize(item.sizeBytes)}</DetailRow>
            {item.inputSource?.fileName && <DetailRow label="Input File">{item.inputSource.fileName}</DetailRow>}
            <DetailRow label="History Id">{item.key}</DetailRow>
            {entryFolderPath && <DetailRow label="Folder">{entryFolderPath}</DetailRow>}
            {item.parentKey && (
              <DetailRow label="Retry Of">
                {onViewEntry ? (
                  <button className="slds-button" title="View the original run" onClick={() => onViewEntry(item.parentKey as string)}>
                    {item.parentKey}
                  </button>
                ) : (
                  item.parentKey
                )}
              </DetailRow>
            )}
          </dl>
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
            aria-label={`Preview ${label}`}
            onClick={() => tabsRef.current?.changeTab(tabIdForKind(kind))}
          >
            Preview
          </button>
          {renderDownloadControl(kind, label)}
        </Grid>
      ))}

      {configItems.length > 0 && (
        <div>
          <h3 className="slds-text-heading_small slds-m-top_medium slds-m-bottom_x-small">Configuration</h3>
          <dl className="slds-dl_horizontal slds-size_1-of-2">
            {configItems.map(({ label, value }) => (
              <DetailRow key={label} label={label}>
                {value}
              </DetailRow>
            ))}
          </dl>
        </div>
      )}
    </div>
  );

  const tabs: UiTabSection[] = [
    { id: 'summary', title: 'Summary', content: summaryContent },
    ...availableFiles.map(({ kind, label }) => ({
      id: tabIdForKind(kind),
      title: label,
      content: (
        // Keyed so each payload kind is its own instance — the tab only renders the active content, and
        // without a key switching Input -> Output would reuse one component (and its error/copied state)
        <DataHistoryPayloadTab
          key={kind}
          item={item}
          kind={kind}
          cache={payloadCache}
          viewStateCache={viewStateCache}
          onRequestDownload={openDownload}
        />
      ),
    })),
  ];

  return (
    <Fragment>
      {/* Hidden (not unmounted from this component's perspective) while the download modal is open —
          two visible modals would fight over z-index/backdrop. State the user would notice resetting
          lives above the Modal, so everything is restored when the download modal closes. */}
      <Modal
        header="Data History Detail"
        tagline={`${DATA_HISTORY_SOURCE_LABELS[item.source]} • ${item.orgLabel}`}
        size="lg"
        closeOnEsc
        hide={!!downloadTarget}
        className="slds-is-relative"
        footer={
          <button className="slds-button slds-button_brand" onClick={onClose}>
            Close
          </button>
        }
        onClose={onClose}
      >
        {fileError && (
          <ScopedNotification theme={fileError.type} className="slds-m-around_small">
            {fileError.message}
          </ScopedNotification>
        )}
        <Tabs ref={tabsRef} tabs={tabs} initialActiveId={activeTabId} onChange={setActiveTabId} />
      </Modal>
      {downloadTarget && (
        <DataHistoryFormatDownloadModal
          item={item}
          target={downloadTarget}
          analyticsLocation="detail-modal"
          onClose={() => setDownloadTarget(null)}
          onError={setFileError}
        />
      )}
    </Fragment>
  );
};
