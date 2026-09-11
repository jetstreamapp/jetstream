import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { isBrowserExtension, isCanvasApp, setItemInLocalStorage, useTitle } from '@jetstream/shared/ui-utils';
import { DataHistoryItem } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ConfirmationModalPromise,
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
  useAnnouncer,
} from '@jetstream/ui';
import {
  openHistoryFolder,
  useAmplitude,
  useDataHistoryStorage,
  useRequestPersistentStorage,
  useSetDataHistoryCaptureEnabled,
} from '@jetstream/ui-core';
import { dataHistoryCaptureEnabledState, fromAppState } from '@jetstream/ui/app-state';
import { deleteDataHistoryEntry, getDataHistoryStorageLocation, setDataHistoryPinned } from '@jetstream/ui/data-history';
import { dataHistoryDb } from '@jetstream/ui/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { DataHistoryExportTarget } from './data-history-payload-views';
import { DataHistoryDetailModal } from './DataHistoryDetailModal';
import { DataHistoryFilters, DataHistoryFilterValue } from './DataHistoryFilters';
import { DataHistoryFormatDownloadModal } from './DataHistoryFormatDownloadModal';
import { DataHistoryTable } from './DataHistoryTable';

/**
 * "Files are saved to: <folder>" page-header indicator. Rendered as a button when the folder can be
 * opened in the file manager (native/desktop backend), otherwise as plain text (browsers cannot
 * open a user-chosen directory).
 */
function StorageFolderIndicator({ name, title, onClick }: { name?: string; title: string; onClick?: () => void }) {
  const content = (
    <Fragment>
      <Icon
        type="utility"
        icon="open_folder"
        className="slds-icon slds-icon-text-default slds-icon_xx-small slds-m-right_xx-small"
        omitContainer
      />
      <span
        className="slds-truncate"
        css={css`
          max-width: 22rem;
        `}
      >
        Files are saved to: <strong>{name}</strong>
      </span>
    </Fragment>
  );
  if (onClick) {
    return (
      <button
        className="slds-button slds-m-right_small"
        css={css`
          align-self: center;
        `}
        title={title}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }
  return (
    <div
      className="slds-grid slds-grid_vertical-align-center slds-text-color_weak slds-m-right_small"
      css={css`
        align-self: center;
        height: 100%;
      `}
      title={title}
    >
      {content}
    </div>
  );
}

const HEIGHT_BUFFER = 170;
const LIST_LIMIT = 1000;
const UPGRADE_BANNER_DISMISSED_KEY = 'DATA_HISTORY_UPGRADE_BANNER_DISMISSED';
const PERSIST_BANNER_DISMISSED_KEY = 'DATA_HISTORY_PERSIST_BANNER_DISMISSED';

function getBannerDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

// Scoped-notification themes (e.g. slds-theme_warning) restyle bare buttons — force our neutral buttons back to the normal look
const scopedNotificationNeutralButtonCss = css`
  color: var(--slds-c-button-text-color, #0176d3) !important;
  &,
  &:hover,
  &:focus {
    text-decoration: none !important;
  }
  &:hover,
  &:focus {
    color: var(--slds-c-button-text-color-hover, #014486) !important;
  }
`;

export const DataHistory: FunctionComponent = () => {
  useTitle(TITLES.DATA_HISTORY);
  const { trackEvent } = useAmplitude();
  const orgs = useAtomValue(fromAppState.salesforceOrgsState);
  const captureEnabled = useAtomValue(dataHistoryCaptureEnabledState);
  const setCaptureEnabled = useSetDataHistoryCaptureEnabled({ analyticsLocation: 'data-history-page' });
  const limits = useAtomValue(fromAppState.dataHistoryLimitsState);
  // The resolved tier is the free/paid signal — entry-capped means the free tier is active
  const showUpgradeToPro = limits?.maxEntries != null;
  const [upgradeBannerDismissed, setUpgradeBannerDismissed] = useState(() => getBannerDismissed(UPGRADE_BANNER_DISMISSED_KEY));
  // Also set when the browser declines: Chromium decides `persist()` heuristically (site engagement,
  // bookmarks, an installed PWA) with no prompt, so a declined request will not succeed on retry and
  // an undismissable banner would nag forever. Settings keeps offering the button.
  const [persistBannerDismissed, setPersistBannerDismissed] = useState(() => getBannerDismissed(PERSIST_BANNER_DISMISSED_KEY));

  // Track the detail entry by key so the modal reflects live updates (e.g. an in-progress load that
  // finishes while open); `detailFallback` is the open-time snapshot, used while the live query is
  // still loading or if the entry is deleted while the modal is open.
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [detailFallback, setDetailFallback] = useState<DataHistoryItem | null>(null);
  // Format download modal opened from a table row (the detail modal hosts its own)
  const [rowDownload, setRowDownload] = useState<{ item: DataHistoryItem; target: DataHistoryExportTarget } | null>(null);

  useEffect(() => {
    trackEvent(ANALYTICS_KEYS.data_history_page_view);
  }, [trackEvent]);

  const { persistPromptEligible, persisted, requestingPersist, requestPersist } = useRequestPersistentStorage({
    analyticsLocation: 'data-history-page',
  });
  const {
    backendStatus,
    storeInFolder,
    reconnectFolder,
    available: canStoreInFolder,
    working: storageWorking,
  } = useDataHistoryStorage({ analyticsLocation: 'data-history-page' });

  // The three-way "where do history files live" decision, shared with the Settings panel so the two
  // surfaces can never give the user contradictory answers — see `getDataHistoryStorageLocation`.
  const storageLocation = getDataHistoryStorageLocation(backendStatus);

  const [filters, setFilters] = useState<DataHistoryFilterValue>({});
  // Narrowed in Dexie (via the `[org+createdAt]` / `createdAt` indexes) rather than after the fact, so
  // LIST_LIMIT caps each FILTERED view instead of capping history itself — without this, entries past
  // the newest 1000 were unreachable no matter what the user searched for.
  const entries = useLiveQuery(
    () => dataHistoryDb.getEntries({ ...filters, limit: LIST_LIMIT }),
    [filters.org, filters.createdAfter?.getTime(), filters.createdBefore?.getTime()],
  );
  const hasActiveFilter = !!(filters.org || filters.createdAfter || filters.createdBefore);
  const pinnedCount = useLiveQuery(() => dataHistoryDb.getPinnedCount(), []);
  // On the free tier the entry cap is enforced oldest-unpinned-first, so once every slot is pinned a
  // new capture is pruned right back out — warn the user their history is effectively frozen.
  const allEntriesPinned = limits?.maxEntries != null && pinnedCount != null && pinnedCount >= limits.maxEntries;

  // Every banner above the table, decided ONCE: the JSX renders from these, and the table's
  // `recalculateKey` is derived from the same object, so a banner can never be added to one and
  // missed by the other (the grid measures its height from its own top edge and the banners mount
  // asynchronously — status/persist/limits load after first paint).
  const banners = {
    permissionNeeded: !!backendStatus?.permissionNeeded,
    folderUnavailable: !!backendStatus?.folderUnavailable,
    persistPrompt: persistPromptEligible && persisted === false && !persistBannerDismissed,
    allEntriesPinned,
    upgrade: showUpgradeToPro && !upgradeBannerDismissed && !allEntriesPinned,
    canvas: isCanvasApp(),
    // Gated on initialization (`limits` stays null until then) — rendering earlier would flash a
    // false "disabled" warning on a hard refresh (and offer an Enable button that cannot persist
    // the setting yet)
    captureDisabled: limits != null && !captureEnabled,
  };

  // Subscribe to the open entry directly (not through the limited list) so the modal keeps updating
  // even when the entry falls outside the visible window. `useLiveQuery` returns undefined while
  // loading (and when the entry has been deleted), so the open-time snapshot fills those windows and
  // the modal never flashes closed mid-view.
  const liveDetailItem = useLiveQuery(() => (detailKey ? dataHistoryDb.getEntry(detailKey) : undefined), [detailKey]);
  const detailItem = detailKey ? (liveDetailItem ?? detailFallback) : null;

  const openDetail = useCallback(
    (item: DataHistoryItem) => {
      setDetailKey(item.key);
      setDetailFallback(item);
      trackEvent(ANALYTICS_KEYS.data_history_view_detail, { source: item.source });
    },
    [trackEvent],
  );

  function closeDetail() {
    setDetailKey(null);
    setDetailFallback(null);
  }

  const handleRowDownload = useCallback((item: DataHistoryItem, target: DataHistoryExportTarget) => {
    setRowDownload({ item, target });
  }, []);

  // "Retry Of" link in the detail modal — jump to the original run's entry
  const handleViewEntry = useCallback(
    async (key: string) => {
      const entry = await dataHistoryDb.getEntry(key);
      if (entry) {
        openDetail(entry);
      } else {
        setDetailKey(null);
        setDetailFallback(null);
        fireToast({ type: 'warning', message: 'That history entry no longer exists on this device.' });
      }
    },
    [openDetail],
  );

  function handleDismissUpgradeBanner() {
    setUpgradeBannerDismissed(true);
    setItemInLocalStorage(UPGRADE_BANNER_DISMISSED_KEY, 'true');
  }

  function handleDismissPersistBanner() {
    setPersistBannerDismissed(true);
    setItemInLocalStorage(PERSIST_BANNER_DISMISSED_KEY, 'true');
  }

  async function handleRequestPersist() {
    if (!(await requestPersist())) {
      handleDismissPersistBanner();
    }
  }

  // The grid activates the pin toggle while focus stays on the cell (single-control cells are
  // clicked in place), so the state change must be announced through a live region
  const { announce, announcer } = useAnnouncer();

  const handleTogglePin = useCallback(
    async (item: DataHistoryItem) => {
      try {
        await setDataHistoryPinned(item.key, !item.pinned);
        trackEvent(ANALYTICS_KEYS.data_history_pin, { pinned: !item.pinned });
        announce(!item.pinned ? 'Entry pinned' : 'Entry unpinned');
      } catch (ex) {
        logger.warn('[DATA_HISTORY] Error pinning entry', ex);
        fireToast({ type: 'error', message: 'There was a problem updating the pinned state.' });
      }
    },
    [announce, trackEvent],
  );

  const handleDelete = useCallback(
    async (item: DataHistoryItem) => {
      try {
        if (
          await ConfirmationModalPromise({
            content: 'This will permanently delete this history entry and its saved data from this device. This cannot be undone.',
          })
        ) {
          const { deleted } = await deleteDataHistoryEntry(item.key);
          if (!deleted) {
            // Refused for a live capture AND for a recent in-progress entry a closed tab left behind —
            // the latter only becomes deletable once the sweep marks it incomplete
            fireToast({
              type: 'warning',
              message:
                'This entry is still being written, or its load was interrupted less than 24 hours ago. Try again once the load finishes, or after 24 hours.',
            });
            return;
          }
          trackEvent(ANALYTICS_KEYS.data_history_delete, { source: item.source });
        }
      } catch (ex) {
        logger.warn('[DATA_HISTORY] Error deleting entry', ex);
        fireToast({ type: 'error', message: 'There was a problem deleting this history entry.' });
      }
    },
    [trackEvent],
  );

  return (
    <Page testId="data-history-page">
      {announcer}
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'asset_audit' }}
            label={APP_ROUTES.DATA_HISTORY.TITLE}
            docsPath={APP_ROUTES.DATA_HISTORY.DOCS}
          />
          <PageHeaderActions colType="actions" buttonType="separate">
            {storageLocation.kind === 'directory' && (
              <StorageFolderIndicator
                name={storageLocation.name}
                title={`History files are saved to the "${storageLocation.name}" folder you selected on this computer. Browsers show only the folder's name (never its full path) and cannot open it in your file manager. Manage the folder from Settings.`}
              />
            )}
            {storageLocation.kind === 'native' && (
              <StorageFolderIndicator
                name={storageLocation.path}
                title={`Open ${storageLocation.path} in your file manager`}
                onClick={() => openHistoryFolder(storageLocation.path)}
              />
            )}
            {canStoreInFolder && (
              <button
                className="slds-button slds-button_neutral"
                disabled={storageWorking}
                onClick={storeInFolder}
                title="Store history as regular files in a folder. The files are visible, backed up with your other files, and kept when browser data is cleared"
              >
                <Icon type="utility" icon="open_folder" className="slds-button__icon slds-button__icon_left" omitContainer />
                Store History in a Folder…
              </button>
            )}
            {/* Canvas has no settings surface; the extension's settings live on a separate html page outside the SPA router */}
            {!isCanvasApp() &&
              (isBrowserExtension() ? (
                <a
                  className="slds-button slds-button_neutral"
                  href="/additional-settings.html#data-history"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon type="utility" icon="settings" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Data History Settings
                </a>
              ) : (
                <Link className="slds-button slds-button_neutral" to={`${APP_ROUTES.SETTINGS.ROUTE}#data-history`}>
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
          Data History keeps a local copy of the record modifications you make in Salesforce with Jetstream, including data loads, mass
          updates, and record edits.{' '}
          {storageLocation.kind === 'directory'
            ? `Your history is stored in your selected folder ("${storageLocation.name}") on this device and is never sent to Jetstream.`
            : storageLocation.kind === 'native'
              ? `Your history is stored on this computer (${storageLocation.path}) and is never sent to Jetstream.`
              : `Your history is stored locally on this device and is never sent to Jetstream. Clearing your browser's site data permanently deletes it, so download anything you need to keep long-term.`}
        </p>
        {banners.permissionNeeded && (
          <ScopedNotification theme="warning" className="slds-m-vertical_x-small">
            <Grid verticalAlign="center">
              <span>Jetstream no longer has permission to your history folder. New history is temporarily saved to browser storage.</span>
              <button
                className="slds-button slds-button_neutral slds-m-left_small"
                css={scopedNotificationNeutralButtonCss}
                disabled={storageWorking}
                onClick={reconnectFolder}
              >
                Re-connect Folder
              </button>
            </Grid>
          </ScopedNotification>
        )}
        {banners.folderUnavailable && (
          <ScopedNotification theme="warning" className="slds-m-vertical_x-small">
            <Grid verticalAlign="center">
              <span>
                Your history folder can’t be opened — it may have been moved or deleted. New history is temporarily saved to{' '}
                {backendStatus?.nativeSupported ? 'app-managed' : 'browser'} storage. Choose a different folder or switch back from Data
                History Settings.
              </span>
            </Grid>
          </ScopedNotification>
        )}
        {banners.persistPrompt && (
          <ScopedNotification theme="info" className="slds-m-vertical_x-small">
            <Grid verticalAlign="center" align="spread">
              <Grid verticalAlign="center">
                <span className="slds-m-right_small">
                  Your browser may automatically delete this history to free up space. Ask it to keep your history saved on this device.
                </span>
                <button className="slds-button slds-button_neutral" disabled={requestingPersist} onClick={handleRequestPersist}>
                  Keep My History
                </button>
              </Grid>
              <button className="slds-button slds-button_icon" title="Dismiss" onClick={handleDismissPersistBanner}>
                <Icon type="utility" icon="close" className="slds-button__icon" omitContainer description="Dismiss" />
              </button>
            </Grid>
          </ScopedNotification>
        )}
        {banners.allEntriesPinned && (
          <ScopedNotification theme="warning" className="slds-m-vertical_x-small">
            <Grid verticalAlign="center">
              <span className="slds-m-right_small">
                {`All ${limits?.maxEntries} of your free plan's history entries are pinned, so new data modifications will not be kept in your history. Unpin or delete an entry, or upgrade for unlimited entries.`}
              </span>
              <UpgradeToProButton trackEvent={trackEvent} source="data-history-pinned-cap" />
            </Grid>
          </ScopedNotification>
        )}
        {banners.upgrade && (
          <ScopedNotification theme="info" className="slds-m-vertical_x-small">
            <Grid verticalAlign="center" align="spread">
              <Grid verticalAlign="center">
                <span className="slds-m-right_small">
                  {`Free accounts keep your ${limits?.maxEntries} most recent history entries. Upgrade for unlimited entries and up to a year of history.`}
                </span>
                <UpgradeToProButton trackEvent={trackEvent} source="data-history" />
              </Grid>
              <button className="slds-button slds-button_icon" title="Dismiss" onClick={handleDismissUpgradeBanner}>
                <Icon type="utility" icon="close" className="slds-button__icon" omitContainer description="Dismiss" />
              </button>
            </Grid>
          </ScopedNotification>
        )}
        {banners.canvas && (
          <ScopedNotification theme="info" className="slds-m-vertical_x-small">
            History is stored per Salesforce domain when Jetstream runs inside Salesforce and may be cleared by your browser. For a durable
            history, use the Jetstream web or desktop app.
          </ScopedNotification>
        )}
        {banners.captureDisabled && (
          <ScopedNotification theme="warning" className="slds-m-vertical_x-small">
            <Grid verticalAlign="center">
              <span>Data History is currently disabled. New data modifications are not being saved.</span>
              <button
                className="slds-button slds-button_neutral slds-m-left_small"
                css={scopedNotificationNeutralButtonCss}
                onClick={() => setCaptureEnabled(true)}
              >
                Enable Data History
              </button>
            </Grid>
          </ScopedNotification>
        )}

        {(hasActiveFilter || (entries && entries.length > 0)) && <DataHistoryFilters orgs={orgs} value={filters} onChange={setFilters} />}

        {entries && entries.length === 0 && (
          <EmptyState
            headline={hasActiveFilter ? 'No history matches your filters' : 'No data history found'}
            subHeading={
              hasActiveFilter
                ? 'Try widening the date range or choosing a different org.'
                : 'Data modifications you make with Jetstream will show up here.'
            }
          />
        )}

        {entries && entries.length > 0 && (
          <DataHistoryTable
            items={entries}
            orgs={orgs}
            // Re-measure when any banner above (or the filter bar) toggles — see `banners`
            recalculateKey={[...Object.values(banners), hasActiveFilter].join('|')}
            onView={openDetail}
            onDownload={handleRowDownload}
            onTogglePin={handleTogglePin}
            onDelete={handleDelete}
          />
        )}
        {entries && entries.length >= LIST_LIMIT && (
          <p className="slds-text-color_weak slds-m-top_x-small">
            Showing the most recent {LIST_LIMIT.toLocaleString()} entries{hasActiveFilter ? ' that match your filters' : ''}. Narrow the org
            or date range to see older history.
          </p>
        )}

        {detailItem && (
          <DataHistoryDetailModal key={detailItem.key} item={detailItem} onClose={closeDetail} onViewEntry={handleViewEntry} />
        )}
        {rowDownload && (
          <DataHistoryFormatDownloadModal
            item={rowDownload.item}
            target={rowDownload.target}
            analyticsLocation="table"
            onClose={() => setRowDownload(null)}
          />
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};
