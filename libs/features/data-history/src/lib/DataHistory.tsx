import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { isBrowserExtension, isCanvasApp, useTitle } from '@jetstream/shared/ui-utils';
import { DataHistoryFileKind, DataHistoryItem, DataHistorySource, DataHistoryStatus, ListItem } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Badge,
  Checkbox,
  ComboboxWithItems,
  ConfirmationModalPromise,
  DropDown,
  EmptyState,
  fireToast,
  Grid,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  UpgradeToProButton,
} from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { dataHistoryCaptureEnabledState, fromAppState, googleDriveAccessState } from '@jetstream/ui/app-state';
import {
  connectHistoryDirectory,
  DATA_HISTORY_FREE_TIER_LIMITS,
  DataHistoryBackendStatus,
  deleteDataHistoryEntry,
  enableNativeHistoryStorage,
  getHistoryBackendStatus,
  reconnectHistoryDirectory,
  setDataHistoryEnabled,
  setDataHistoryPinned,
} from '@jetstream/ui/data-history';
import { dataHistoryDb } from '@jetstream/ui/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtom, useAtomValue } from 'jotai';
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { downloadDataHistoryFile } from './data-history-download';
import {
  DATA_HISTORY_SOURCE_LABELS,
  DATA_HISTORY_STATUS_LABELS,
  DataHistorySort,
  DataHistorySortColumn,
  formatDataHistoryCounts,
  formatDataHistoryDate,
  getAvailableFileKinds,
  getDataHistorySourceListItems,
  getDataHistoryStatusBadgeType,
  getDataHistoryStatusListItems,
  sortDataHistoryItems,
} from './data-history-page.utils';
import { DataHistoryDetailModal } from './DataHistoryDetailModal';

function SortableHeader({
  column,
  label,
  sort,
  onSort,
}: {
  column: DataHistorySortColumn;
  label: string;
  sort: DataHistorySort;
  onSort: (column: DataHistorySortColumn) => void;
}) {
  const isActive = sort.column === column;
  return (
    <th scope="col" aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        className="slds-button slds-button_reset slds-text-link_reset slds-truncate"
        title={`Sort by ${label}`}
        onClick={() => onSort(column)}
      >
        {label}
        {isActive && (
          <Icon
            type="utility"
            icon={sort.direction === 'asc' ? 'arrowup' : 'arrowdown'}
            className="slds-icon slds-icon-text-default slds-icon_xx-small slds-m-left_xx-small"
            omitContainer
          />
        )}
      </button>
    </th>
  );
}

const ALL = '__ALL__';
const HEIGHT_BUFFER = 170;
const LIST_LIMIT = 250;

export const DataHistory: FunctionComponent = () => {
  useTitle(TITLES.DATA_HISTORY);
  const { trackEvent } = useAmplitude();
  const orgs = useAtomValue(fromAppState.salesforceOrgsState);
  const selectedOrg = useAtomValue(fromAppState.selectedOrgState);
  const [captureEnabled, setCaptureEnabled] = useAtom(dataHistoryCaptureEnabledState);
  // Same signal that drives the storage tier limits — true only for free users on the web app
  const { googleShowUpgradeToPro: showUpgradeToPro } = useAtomValue(googleDriveAccessState);

  const [orgFilter, setOrgFilter] = useState<string>(() => selectedOrg?.uniqueId || ALL);
  const [sourceFilter, setSourceFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [detailItem, setDetailItem] = useState<DataHistoryItem | null>(null);
  const [sort, setSort] = useState<DataHistorySort>({ column: 'date', direction: 'desc' });
  const [backendStatus, setBackendStatus] = useState<DataHistoryBackendStatus | null>(null);
  const [storageWorking, setStorageWorking] = useState(false);

  useEffect(() => {
    trackEvent(ANALYTICS_KEYS.data_history_page_view);
  }, [trackEvent]);

  const loadBackendStatus = useCallback(async () => {
    try {
      setBackendStatus(await getHistoryBackendStatus());
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Unable to load storage backend status', ex);
    }
  }, []);

  useEffect(() => {
    loadBackendStatus();
  }, [loadBackendStatus]);

  const canStoreInFolder =
    !!backendStatus &&
    ((backendStatus.nativeSupported && backendStatus.active !== 'native') ||
      (backendStatus.directorySupported && backendStatus.active !== 'directory'));

  async function handleStoreInFolder() {
    setStorageWorking(true);
    try {
      if (backendStatus?.nativeSupported) {
        await enableNativeHistoryStorage();
        fireToast({ type: 'success', message: 'Your history is now stored on disk — manage the folder from Settings.' });
      } else {
        const result = await connectHistoryDirectory();
        if (result) {
          fireToast({ type: 'success', message: 'Your history is now stored in the selected folder.' });
        }
      }
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { backend: 'folder', location: 'data-history-page' });
      await loadBackendStatus();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error switching history storage', ex);
      fireToast({ type: 'error', message: 'There was a problem changing the Data History storage location.' });
    } finally {
      setStorageWorking(false);
    }
  }

  async function handleReconnectFolder() {
    try {
      if (await reconnectHistoryDirectory()) {
        fireToast({ type: 'success', message: 'Folder re-connected — new history will be saved there.' });
      } else {
        fireToast({ type: 'warning', message: 'Permission was not granted.' });
      }
      await loadBackendStatus();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error re-connecting folder', ex);
    }
  }

  const entries = useLiveQuery(
    () =>
      dataHistoryDb.getEntries({
        org: orgFilter !== ALL ? orgFilter : undefined,
        source: sourceFilter !== ALL ? (sourceFilter as DataHistorySource) : undefined,
        status: statusFilter !== ALL ? (statusFilter as DataHistoryStatus) : undefined,
        pinnedOnly: pinnedOnly || undefined,
        limit: LIST_LIMIT,
      }),
    [orgFilter, sourceFilter, statusFilter, pinnedOnly],
  );

  const orgListItems = useMemo<ListItem[]>(
    () => [
      { id: ALL, label: 'All Orgs', value: ALL },
      ...orgs.map(({ uniqueId, label }) => ({ id: uniqueId, label: label || uniqueId, value: uniqueId })),
    ],
    [orgs],
  );
  const sourceListItems = useMemo<ListItem[]>(
    () => [{ id: ALL, label: 'All Features', value: ALL }, ...getDataHistorySourceListItems()],
    [],
  );
  const statusListItems = useMemo<ListItem[]>(
    () => [{ id: ALL, label: 'All Statuses', value: ALL }, ...getDataHistoryStatusListItems()],
    [],
  );
  // Salesforce org ids for the org column — entries only store the uniqueId + label snapshot
  const orgIdByUniqueId = useMemo(() => new Map(orgs.map(({ uniqueId, organizationId }) => [uniqueId, organizationId])), [orgs]);
  const sortedEntries = useMemo(() => (entries ? sortDataHistoryItems(entries, sort) : entries), [entries, sort]);

  function handleSortColumn(column: DataHistorySortColumn) {
    setSort((currentSort) =>
      currentSort.column === column
        ? { column, direction: currentSort.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: column === 'date' ? 'desc' : 'asc' },
    );
  }

  async function handleRowDownload(item: DataHistoryItem, kind: DataHistoryFileKind) {
    if (await downloadDataHistoryFile(item, kind)) {
      trackEvent(ANALYTICS_KEYS.data_history_download, { kind, source: item.source, location: 'table' });
    }
  }

  async function handleEnableCapture() {
    try {
      await setDataHistoryEnabled(true);
      setCaptureEnabled(true);
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { enabled: true, location: 'data-history-page' });
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error enabling data history', ex);
    }
  }

  async function handleTogglePin(item: DataHistoryItem) {
    try {
      await setDataHistoryPinned(item.key, !item.pinned);
      trackEvent(ANALYTICS_KEYS.data_history_pin, { pinned: !item.pinned });
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error pinning entry', ex);
    }
  }

  async function handleDelete(item: DataHistoryItem) {
    try {
      if (
        await ConfirmationModalPromise({
          content: 'This will permanently delete this history entry and its saved data from this device. This cannot be undone.',
        })
      ) {
        await deleteDataHistoryEntry(item.key);
        trackEvent(ANALYTICS_KEYS.data_history_delete, { source: item.source });
      }
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error deleting entry', ex);
      fireToast({ type: 'error', message: 'There was a problem deleting this history entry.' });
    }
  }

  return (
    <Page testId="data-history-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'asset_audit' }}
            label={APP_ROUTES.DATA_HISTORY.TITLE}
            docsPath={APP_ROUTES.DATA_HISTORY.DOCS}
          />
          <PageHeaderActions colType="actions" buttonType="separate">
            {backendStatus?.active === 'directory' && backendStatus.directoryName && (
              <Badge
                type="light"
                title={`History is stored in the "${backendStatus.directoryName}" folder you selected on this computer. Browsers show only the folder's name, not its full path — manage it from Settings.`}
              >
                <Icon type="utility" icon="open_folder" className="slds-icon slds-icon_xx-small slds-m-right_xx-small" omitContainer />
                {backendStatus.directoryName}
              </Badge>
            )}
            {backendStatus?.active === 'native' && backendStatus.nativePath && (
              <Badge
                type="light"
                title={`History is stored at ${backendStatus.nativePath} — manage it from Settings.`}
                css={css`
                  max-width: 20rem;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                `}
              >
                <Icon type="utility" icon="open_folder" className="slds-icon slds-icon_xx-small slds-m-right_xx-small" omitContainer />
                {backendStatus.nativePath}
              </Badge>
            )}
            {canStoreInFolder && (
              <button
                className="slds-button slds-button_neutral"
                disabled={storageWorking}
                onClick={handleStoreInFolder}
                title="Store history as regular files in a folder — visible, backed up with your other files, and kept when browser data is cleared"
              >
                <Icon type="utility" icon="open_folder" className="slds-button__icon slds-button__icon_left" omitContainer />
                Store History in a Folder…
              </button>
            )}
            {/* Canvas has no settings surface; the extension's settings live on a separate html page outside the SPA router */}
            {!isCanvasApp() &&
              (isBrowserExtension() ? (
                <a className="slds-button slds-button_neutral" href="/additional-settings.html" target="_blank" rel="noreferrer">
                  <Icon type="utility" icon="settings" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Data History Settings
                </a>
              ) : (
                <Link className="slds-button slds-button_neutral" to={APP_ROUTES.SETTINGS.ROUTE}>
                  <Icon type="utility" icon="settings" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Data History Settings
                </Link>
              ))}
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer
        bottomBuffer={10}
        className="slds-p-horizontal_x-small slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        <p className="slds-text-color_weak slds-m-vertical_x-small">
          {backendStatus?.active === 'directory' && backendStatus.directoryName
            ? `Data History is stored in your selected folder ("${backendStatus.directoryName}") on this device and is never sent to Jetstream.`
            : backendStatus?.active === 'native'
              ? `Data History is stored on this computer (${backendStatus.nativePath}) and is never sent to Jetstream.`
              : `Data History is stored locally on this device and is never sent to Jetstream. Clearing your browser's site data permanently deletes it — download anything you need to keep long-term.`}
        </p>
        {backendStatus?.permissionNeeded && (
          <ScopedNotification theme="warning" className="slds-m-vertical_x-small">
            <Grid verticalAlign="center">
              <span>Jetstream no longer has permission to your history folder — new history is temporarily saved to browser storage.</span>
              <button className="slds-button slds-button_neutral slds-m-left_small" onClick={handleReconnectFolder}>
                Re-connect Folder
              </button>
            </Grid>
          </ScopedNotification>
        )}
        {showUpgradeToPro && (
          <ScopedNotification theme="info" className="slds-m-vertical_x-small">
            <Grid verticalAlign="center">
              <span className="slds-m-right_small">
                {`Free accounts keep your ${DATA_HISTORY_FREE_TIER_LIMITS.maxEntries} most recent history entries — upgrade for unlimited entries and up to a year of history.`}
              </span>
              <UpgradeToProButton trackEvent={trackEvent} source="data-history" />
            </Grid>
          </ScopedNotification>
        )}
        {isCanvasApp() && (
          <ScopedNotification theme="info" className="slds-m-vertical_x-small">
            History is stored per Salesforce domain when Jetstream runs inside Salesforce and may be cleared by your browser. For a durable
            history, use the Jetstream web or desktop app.
          </ScopedNotification>
        )}
        {!captureEnabled && (
          <ScopedNotification theme="warning" className="slds-m-vertical_x-small">
            <Grid verticalAlign="center">
              <span>Data History is currently disabled — new data modifications are not being saved.</span>
              <button className="slds-button slds-button_neutral slds-m-left_small" onClick={handleEnableCapture}>
                Enable Data History
              </button>
            </Grid>
          </ScopedNotification>
        )}
        <Grid verticalAlign="end" wrap className="slds-m-bottom_x-small">
          <div className="slds-m-right_small slds-size_1-of-1 slds-medium-size_3-of-12">
            <ComboboxWithItems
              comboboxProps={{ label: 'Salesforce Org', itemLength: 10 }}
              items={orgListItems}
              selectedItemId={orgFilter}
              onSelected={(item) => setOrgFilter(item.id)}
            />
          </div>
          <div className="slds-m-right_small slds-size_1-of-1 slds-medium-size_3-of-12">
            <ComboboxWithItems
              comboboxProps={{ label: 'Feature', itemLength: 10 }}
              items={sourceListItems}
              selectedItemId={sourceFilter}
              onSelected={(item) => setSourceFilter(item.id)}
            />
          </div>
          <div className="slds-m-right_small slds-size_1-of-1 slds-medium-size_2-of-12">
            <ComboboxWithItems
              comboboxProps={{ label: 'Status', itemLength: 10 }}
              items={statusListItems}
              selectedItemId={statusFilter}
              onSelected={(item) => setStatusFilter(item.id)}
            />
          </div>
          <div className="slds-m-bottom_xx-small">
            <Checkbox id="data-history-pinned-only" checked={pinnedOnly} label="Pinned only" onChange={setPinnedOnly} />
          </div>
        </Grid>

        {entries && entries.length === 0 && (
          <EmptyState headline="No data history found" subHeading="Data modifications you make with Jetstream will show up here.">
            {(orgFilter !== ALL || sourceFilter !== ALL || statusFilter !== ALL || pinnedOnly) && (
              <button
                className="slds-button slds-button_neutral"
                onClick={() => {
                  setOrgFilter(ALL);
                  setSourceFilter(ALL);
                  setStatusFilter(ALL);
                  setPinnedOnly(false);
                }}
              >
                Clear Filters
              </button>
            )}
          </EmptyState>
        )}

        {entries && entries.length > 0 && (
          <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped" aria-label="Data history">
            <thead>
              <tr className="slds-line-height_reset">
                <SortableHeader column="date" label="Date" sort={sort} onSort={handleSortColumn} />
                <SortableHeader column="org" label="Org" sort={sort} onSort={handleSortColumn} />
                <SortableHeader column="source" label="Feature" sort={sort} onSort={handleSortColumn} />
                <SortableHeader column="sobjects" label="Object(s)" sort={sort} onSort={handleSortColumn} />
                <SortableHeader column="status" label="Status" sort={sort} onSort={handleSortColumn} />
                <SortableHeader column="records" label="Records" sort={sort} onSort={handleSortColumn} />
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(sortedEntries || []).map((item) => (
                <tr key={item.key} className="slds-hint-parent">
                  <td>{formatDataHistoryDate(item.createdAt)}</td>
                  <td className="slds-cell-wrap">
                    <div>{item.orgLabel}</div>
                    <div className="slds-text-body_small slds-text-color_weak" title={item.org}>
                      {orgIdByUniqueId.get(item.org) || item.org}
                    </div>
                  </td>
                  <td>{DATA_HISTORY_SOURCE_LABELS[item.source]}</td>
                  <td className="slds-cell-wrap">{item.sobjects.join(', ') || '—'}</td>
                  <td>
                    <Badge type={getDataHistoryStatusBadgeType(item.status)}>{DATA_HISTORY_STATUS_LABELS[item.status]}</Badge>
                  </td>
                  <td>{formatDataHistoryCounts(item)}</td>
                  <td>
                    <Grid verticalAlign="center" noWrap>
                      <button
                        className="slds-button slds-button_neutral slds-m-right_x-small"
                        onClick={() => {
                          setDetailItem(item);
                          trackEvent(ANALYTICS_KEYS.data_history_view_detail, { source: item.source });
                        }}
                      >
                        View
                      </button>
                      {getAvailableFileKinds(item).length > 0 && (
                        <DropDown
                          className="slds-m-right_x-small"
                          buttonClassName="slds-button slds-button_icon slds-button_icon-border"
                          position="right"
                          usePortal
                          leadingIcon={{ type: 'utility', icon: 'download' }}
                          actionText="Download saved data"
                          description="Download saved data"
                          items={getAvailableFileKinds(item).map(({ kind, label }) => ({ id: kind, value: `Download ${label}` }))}
                          onSelected={(id) => handleRowDownload(item, id as DataHistoryFileKind)}
                        />
                      )}
                      <button
                        className="slds-button slds-button_icon slds-button_icon-border slds-m-right_x-small"
                        title={item.pinned ? 'Unpin (allow automatic cleanup)' : 'Pin (exclude from automatic cleanup)'}
                        onClick={() => handleTogglePin(item)}
                      >
                        <Icon
                          type="utility"
                          icon={item.pinned ? 'pinned' : 'pin'}
                          className="slds-button__icon"
                          omitContainer
                          description={item.pinned ? 'Unpin' : 'Pin'}
                        />
                      </button>
                      <button
                        className="slds-button slds-button_icon slds-button_icon-border"
                        title="Delete this entry"
                        onClick={() => handleDelete(item)}
                      >
                        <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer description="Delete" />
                      </button>
                    </Grid>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {entries && entries.length >= LIST_LIMIT && (
          <p className="slds-text-color_weak slds-m-top_x-small">
            Showing (and sorting) the most recent {LIST_LIMIT.toLocaleString()} entries — use the filters to narrow your results.
          </p>
        )}

        {detailItem && (
          <DataHistoryDetailModal
            item={detailItem}
            onClose={() => setDetailItem(null)}
            onDownload={(kind: DataHistoryFileKind) =>
              trackEvent(ANALYTICS_KEYS.data_history_download, { kind, source: detailItem.source })
            }
          />
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};
