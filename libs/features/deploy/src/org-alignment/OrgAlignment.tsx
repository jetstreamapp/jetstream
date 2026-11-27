import { css } from '@emotion/react';
import { COMMON_METADATA_TYPES } from '@jetstream/connected-ui';
import { MIME_TYPES, TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { formatNumber, getFilenameWithoutOrg, isBrowserExtension, isCanvasApp, saveFile, useTitle } from '@jetstream/shared/ui-utils';
import {
  FileExtAllTypes,
  ListMetadataResult,
  OrgAlignmentRunSummaryCounts,
  OrgAlignmentSavedComparison,
  OrgAlignmentSelectionMode,
  SalesforceOrgUi,
  UiTabSection,
} from '@jetstream/types';
import {
  Badge,
  ButtonGroupContainer,
  Checkbox,
  DisabledReasonButton,
  DropDown,
  EmptyState,
  FileDownloadModal,
  Grid,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ProgressIndicator,
  RadioButton,
  RadioGroup,
  ScopedNotification,
  SearchInput,
  Spinner,
  Tabs,
  TabsRef,
  Toast,
  Tooltip,
  UpgradeToProButton,
} from '@jetstream/ui';
import {
  ConfirmPageChange,
  fromJetstreamEvents,
  GroupScopedOrgsCombobox,
  OrgLabelBadge,
  ProBadge,
  RequireMetadataApiBanner,
} from '@jetstream/ui-core';
import {
  applicationCookieState,
  googleDriveAccessState,
  orgAlignmentAccessState,
  salesforceOrgsById,
  salesforceOrgsState,
  selectedOrgStateWithoutPlaceholder,
  useOperationAccess,
} from '@jetstream/ui/app-state';
import { hasDexieDb, orgAlignmentDb } from '@jetstream/ui/db';
import copyToClipboard from 'copy-to-clipboard';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import OrgAlignmentDeployModal from './OrgAlignmentDeployModal';
import OrgAlignmentDiffModal from './OrgAlignmentDiffModal';
import OrgAlignmentSavedComparisonsModal, { FREE_ORG_ALIGNMENT_SAVED_LIMIT } from './OrgAlignmentSavedComparisonsModal';
import OrgAlignmentTypeSelectorModal from './OrgAlignmentTypeSelectorModal';
import {
  OrgAlignmentComponentItem,
  OrgAlignmentDeployDirection,
  OrgAlignmentDiffStatus,
  OrgAlignmentExportContext,
} from './orgAlignmentTypes';
import {
  aggregateSummaryCounts,
  buildChangeReviewMarkdown,
  buildDriftReportFlatRows,
  buildDriftReportWorkbookData,
  getStatusLabel,
  isComponentDeployableInDirection,
} from './orgAlignmentUtils';
import { useOrgAlignmentCompare } from './useOrgAlignmentCompare';

const FREE_REPORT_STORAGE_KEY = 'JETSTREAM_ORG_ALIGNMENT_FREE_REPORTS_USED';
const FREE_REPORT_LIMIT = 1;

const EXPORT_ACTION_XLSX = 'export-xlsx';
const EXPORT_ACTION_CSV = 'export-csv';
const EXPORT_ACTION_JSON = 'export-json';
const EXPORT_ACTION_MD_DOWNLOAD = 'export-md-download';
const EXPORT_ACTION_MD_COPY = 'export-md-copy';

function getFreeReportsUsedCount(): number {
  try {
    const raw = localStorage.getItem(FREE_REPORT_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function incrementFreeReportsUsedCount(): number {
  const next = getFreeReportsUsedCount() + 1;
  try {
    localStorage.setItem(FREE_REPORT_STORAGE_KEY, String(next));
  } catch {
    // ignore storage quota / privacy mode failures
  }
  return next;
}

export const OrgAlignment: FunctionComponent = () => {
  useTitle(TITLES.ORG_ALIGNMENT);

  const [isSingleOrgMode] = useState(() => isBrowserExtension() || isCanvasApp());
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const { hasOrgAlignmentProAccess, orgAlignmentShowUpgradeToPro } = useAtomValue(orgAlignmentAccessState);
  const deployAccess = useOperationAccess('metadata.deploy');

  const allOrgs = useAtomValue(salesforceOrgsState);
  const orgsById = useAtomValue(salesforceOrgsById);
  const defaultSelectedOrg = useAtomValue(selectedOrgStateWithoutPlaceholder);

  // `undefined` defers to the globally selected org until the user picks Org A explicitly
  const [userSelectedSourceOrg, setUserSelectedSourceOrg] = useState<SalesforceOrgUi | null | undefined>(undefined);
  const sourceOrg = userSelectedSourceOrg === undefined ? (defaultSelectedOrg ?? null) : userSelectedSourceOrg;
  const setSourceOrg = setUserSelectedSourceOrg;
  const [targetOrg, setTargetOrg] = useState<SalesforceOrgUi | null>(null);
  const [selectionMode, setSelectionMode] = useState<OrgAlignmentSelectionMode>('common');
  const [customMetadataTypes, setCustomMetadataTypes] = useState<string[]>(() => [...COMMON_METADATA_TYPES]);
  const [includeManaged, setIncludeManaged] = useState(false);
  const [normalizePermissionXml, setNormalizePermissionXml] = useState(true);
  const [skipRequestCache, setSkipRequestCache] = useState(false);

  const [freeReportsUsed, setFreeReportsUsed] = useState<number>(() => getFreeReportsUsedCount());
  const [savedComparisons, setSavedComparisons] = useState<OrgAlignmentSavedComparison[]>([]);
  const [activeSavedKey, setActiveSavedKey] = useState<string | null>(null);

  const [typeSelectorModalOpen, setTypeSelectorModalOpen] = useState(false);
  const [savedModalMode, setSavedModalMode] = useState<'BROWSE' | 'SAVE' | null>(null);
  const [activeDiffComponent, setActiveDiffComponent] = useState<OrgAlignmentComponentItem | null>(null);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployModalComponents, setDeployModalComponents] = useState<OrgAlignmentComponentItem[]>([]);
  const [deployModalDirection, setDeployModalDirection] = useState<OrgAlignmentDeployDirection>('A_TO_B');

  const [deployDirection, setDeployDirection] = useState<OrgAlignmentDeployDirection>('A_TO_B');
  const [selectedComponentKeys, setSelectedComponentKeys] = useState<Set<string>>(() => new Set());
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrgAlignmentDiffStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [componentSearch, setComponentSearch] = useState('');
  const [typeSummarySearch, setTypeSummarySearch] = useState('');
  const [hideIdenticalTypes, setHideIdenticalTypes] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [exportModalConfig, setExportModalConfig] = useState<{
    open: boolean;
    data: Record<string, unknown>[] | Record<string, unknown[]> | null;
    allowedTypes: FileExtAllTypes[];
    fileNameParts: string[];
  }>({
    open: false,
    data: null,
    allowedTypes: [],
    fileNameParts: [],
  });

  const tabsRef = useRef<TabsRef>(null);

  const {
    typeResults,
    progress,
    fatalError,
    lastCompletedAt,
    runComparison,
    retryTypes,
    cancelComparison,
    recomputeNormalization,
    loadComponentFilesOnDemand,
    reset: resetComparison,
  } = useOrgAlignmentCompare();

  const refreshSavedComparisons = useCallback(async () => {
    if (!hasDexieDb()) {
      return;
    }
    try {
      const items = await orgAlignmentDb.getAll();
      setSavedComparisons(items);
    } catch {
      // ignore if IndexedDB is unavailable in test/private browsing
    }
  }, []);

  useEffect(() => {
    if (!hasDexieDb()) {
      return;
    }
    let active = true;
    orgAlignmentDb
      .getAll()
      .then((items) => {
        if (active) {
          setSavedComparisons(items);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const targetOrgOptions = useMemo(
    () => (sourceOrg ? allOrgs.filter((org) => org.uniqueId !== sourceOrg.uniqueId) : allOrgs),
    [allOrgs, sourceOrg],
  );

  const sourceOrgOptions = useMemo(
    () => (targetOrg ? allOrgs.filter((org) => org.uniqueId !== targetOrg.uniqueId) : allOrgs),
    [allOrgs, targetOrg],
  );

  const summaryCounts = useMemo<OrgAlignmentRunSummaryCounts>(() => aggregateSummaryCounts(typeResults), [typeResults]);

  const allComponents = useMemo(() => typeResults.flatMap((typeResult) => typeResult.components), [typeResults]);

  const failedTypeNames = useMemo(
    () =>
      typeResults.filter(({ executionStatus }) => executionStatus === 'error' || executionStatus === 'canceled').map(({ type }) => type),
    [typeResults],
  );

  const uncomparableTypesCount = useMemo(
    () => typeResults.filter(({ executionStatus }) => executionStatus === 'uncomparable').length,
    [typeResults],
  );

  // Build destination inventory map for dependency checking based on chosen deploy direction
  const getDestinationInventoryByType = useCallback(
    (direction: OrgAlignmentDeployDirection): Record<string, ListMetadataResult[]> => {
      const inventory: Record<string, ListMetadataResult[]> = {};
      for (const typeResult of typeResults) {
        if (typeResult.executionStatus !== 'complete') {
          continue;
        }
        inventory[typeResult.type] = direction === 'A_TO_B' ? typeResult.targetListItems : typeResult.sourceListItems;
      }
      return inventory;
    },
    [typeResults],
  );

  const freeLimitReached = !hasOrgAlignmentProAccess && freeReportsUsed >= FREE_REPORT_LIMIT;
  const canRun = Boolean(sourceOrg && targetOrg && sourceOrg.uniqueId !== targetOrg.uniqueId) && !progress.running && !freeLimitReached;

  const executeComparison = useCallback(
    (override?: {
      source: SalesforceOrgUi;
      target: SalesforceOrgUi;
      mode: OrgAlignmentSelectionMode;
      types: string[];
      managed: boolean;
      normalize: boolean;
      savedKey?: string | null;
    }) => {
      const activeSource = override?.source ?? sourceOrg;
      const activeTarget = override?.target ?? targetOrg;
      if (!activeSource || !activeTarget) {
        return;
      }
      const mode = override?.mode ?? selectionMode;
      const types = override?.types ?? customMetadataTypes;
      const managed = override?.managed ?? includeManaged;
      const normalize = override?.normalize ?? normalizePermissionXml;
      const savedKeyForRun = override !== undefined ? override.savedKey : activeSavedKey;

      setSelectedComponentKeys(new Set());
      setStatusFilter('ALL');
      setTypeFilter('ALL');

      runComparison({
        sourceOrg: activeSource,
        targetOrg: activeTarget,
        selectionMode: mode,
        selectedMetadataTypes: types,
        includeManaged: managed,
        normalizePermissionXml: normalize,
        skipRequestCache,
        onComplete: (summary) => {
          if (!hasOrgAlignmentProAccess) {
            setFreeReportsUsed(incrementFreeReportsUsedCount());
          }
          if (savedKeyForRun && hasDexieDb()) {
            orgAlignmentDb
              .recordRunSummary(savedKeyForRun, summary, new Date())
              .then(refreshSavedComparisons)
              .catch(() => undefined);
          }
        },
      });
    },
    [
      activeSavedKey,
      customMetadataTypes,
      hasOrgAlignmentProAccess,
      includeManaged,
      normalizePermissionXml,
      refreshSavedComparisons,
      runComparison,
      selectionMode,
      skipRequestCache,
      sourceOrg,
      targetOrg,
    ],
  );

  function handleSwapOrgs() {
    if (progress.running) {
      return;
    }
    const previousSource = sourceOrg;
    const previousTarget = targetOrg;
    setSourceOrg(previousTarget);
    setTargetOrg(previousSource);
    setActiveSavedKey(null);
    setSelectedComponentKeys(new Set());
    resetComparison();
  }

  function handleNormalizeToggle(enabled: boolean) {
    setNormalizePermissionXml(enabled);
    if (typeResults.length > 0) {
      recomputeNormalization(enabled);
    }
  }

  function handleDirectionChange(nextDirection: OrgAlignmentDeployDirection) {
    setDeployDirection(nextDirection);
    // Keep only selected components that are valid in the newly chosen direction
    setSelectedComponentKeys((previous) => {
      const next = new Set<string>();
      for (const component of allComponents) {
        if (previous.has(component.key) && isComponentDeployableInDirection(component, nextDirection)) {
          next.add(component.key);
        }
      }
      return next;
    });
  }

  async function handleSaveComparison(payload: { key?: string; name: string; description?: string }) {
    if (!sourceOrg || !targetOrg || !hasDexieDb()) {
      return;
    }
    const now = new Date();
    const existing = payload.key ? savedComparisons.find(({ key }) => key === payload.key) : undefined;
    const record: OrgAlignmentSavedComparison = {
      key: existing?.key ?? orgAlignmentDb.generateKey(),
      name: payload.name,
      description: payload.description,
      sourceOrgId: sourceOrg.uniqueId,
      sourceOrgLabel: sourceOrg.label,
      targetOrgId: targetOrg.uniqueId,
      targetOrgLabel: targetOrg.label,
      selectionMode,
      selectedMetadataTypes: selectionMode === 'custom' ? customMetadataTypes : [],
      includeManaged,
      normalizePermissionXml,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastRunAt: lastCompletedAt ?? existing?.lastRunAt ?? null,
      lastRunSummary: typeResults.length > 0 ? summaryCounts : (existing?.lastRunSummary ?? null),
    };
    await orgAlignmentDb.save(record);
    setActiveSavedKey(record.key);
    await refreshSavedComparisons();
    setToastMessage(`Saved comparison "${record.name}"`);
  }

  function handleLoadSavedComparison(comparison: OrgAlignmentSavedComparison, autoRun: boolean) {
    const resolvedSource = orgsById[comparison.sourceOrgId] ?? null;
    const resolvedTarget = orgsById[comparison.targetOrgId] ?? null;
    setSourceOrg(resolvedSource);
    setTargetOrg(resolvedTarget);
    setSelectionMode(comparison.selectionMode);
    if (comparison.selectedMetadataTypes.length > 0) {
      setCustomMetadataTypes(comparison.selectedMetadataTypes);
    }
    setIncludeManaged(comparison.includeManaged);
    setNormalizePermissionXml(comparison.normalizePermissionXml);
    setActiveSavedKey(comparison.key);
    setSelectedComponentKeys(new Set());
    resetComparison();

    if (autoRun && resolvedSource && resolvedTarget && !freeLimitReached) {
      executeComparison({
        source: resolvedSource,
        target: resolvedTarget,
        mode: comparison.selectionMode,
        types: comparison.selectedMetadataTypes,
        managed: comparison.includeManaged,
        normalize: comparison.normalizePermissionXml,
        savedKey: comparison.key,
      });
    }
  }

  async function handleDeleteSavedComparison(key: string) {
    if (!hasDexieDb()) {
      return;
    }
    await orgAlignmentDb.deleteComparison(key);
    if (activeSavedKey === key) {
      setActiveSavedKey(null);
    }
    await refreshSavedComparisons();
  }

  function buildExportContext(): OrgAlignmentExportContext | null {
    if (!sourceOrg || !targetOrg || typeResults.length === 0) {
      return null;
    }
    return {
      sourceOrg,
      targetOrg,
      generatedAt: lastCompletedAt ?? new Date(),
      normalizePermissionXml,
      includeManaged,
      typeResults,
    };
  }

  function handleExportAction(actionId: string) {
    const context = buildExportContext();
    if (!context) {
      return;
    }
    const baseParts = ['org-alignment', context.sourceOrg.label, 'vs', context.targetOrg.label];
    if (actionId === EXPORT_ACTION_XLSX) {
      setExportModalConfig({
        open: true,
        data: buildDriftReportWorkbookData(context),
        allowedTypes: ['xlsx'],
        fileNameParts: baseParts,
      });
    } else if (actionId === EXPORT_ACTION_CSV) {
      setExportModalConfig({
        open: true,
        data: buildDriftReportFlatRows(context, false),
        allowedTypes: ['csv'],
        fileNameParts: baseParts,
      });
    } else if (actionId === EXPORT_ACTION_JSON) {
      setExportModalConfig({
        open: true,
        data: buildDriftReportFlatRows(context, false),
        allowedTypes: ['json'],
        fileNameParts: baseParts,
      });
    } else if (actionId === EXPORT_ACTION_MD_DOWNLOAD) {
      const markdown = buildChangeReviewMarkdown(context);
      saveFile(markdown, `${getFilenameWithoutOrg(baseParts)}.md`, MIME_TYPES.PLAN_TEXT);
      setToastMessage('Downloaded Markdown change-review summary');
    } else if (actionId === EXPORT_ACTION_MD_COPY) {
      const markdown = buildChangeReviewMarkdown(context);
      copyToClipboard(markdown);
      setToastMessage('Copied Markdown change-review summary to clipboard');
    }
  }

  function handleInspectType(metadataType: string) {
    setTypeFilter(metadataType);
    setStatusFilter('ALL');
    tabsRef.current?.changeTab('components');
  }

  function handleKpiClick(filter: 'ALL' | OrgAlignmentDiffStatus) {
    setStatusFilter(filter);
    tabsRef.current?.changeTab('components');
  }

  const filteredTypeResults = useMemo(() => {
    const query = typeSummarySearch.trim().toLowerCase();
    return typeResults.filter((entry) => {
      if (
        hideIdenticalTypes &&
        entry.executionStatus === 'complete' &&
        entry.counts.different === 0 &&
        entry.counts.onlyInSource === 0 &&
        entry.counts.onlyInTarget === 0
      ) {
        return false;
      }
      if (!query) {
        return true;
      }
      return entry.type.toLowerCase().includes(query) || entry.typeLabel.toLowerCase().includes(query);
    });
  }, [hideIdenticalTypes, typeResults, typeSummarySearch]);

  const filteredComponents = useMemo(() => {
    const query = componentSearch.trim().toLowerCase();
    return allComponents.filter((component) => {
      if (statusFilter !== 'ALL' && component.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== 'ALL' && component.type !== typeFilter) {
        return false;
      }
      if (query) {
        return (
          component.fullName.toLowerCase().includes(query) ||
          component.type.toLowerCase().includes(query) ||
          component.typeLabel.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [allComponents, componentSearch, statusFilter, typeFilter]);

  const visibleDeployableComponents = useMemo(
    () => filteredComponents.filter((component) => isComponentDeployableInDirection(component, deployDirection)),
    [deployDirection, filteredComponents],
  );

  const selectedDeployableComponents = useMemo(
    () => allComponents.filter((component) => selectedComponentKeys.has(component.key)),
    [allComponents, selectedComponentKeys],
  );

  function toggleComponentSelection(key: string, checked: boolean) {
    setSelectedComponentKeys((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function handleSelectAllVisible() {
    setSelectedComponentKeys((previous) => {
      const next = new Set(previous);
      for (const component of visibleDeployableComponents) {
        next.add(component.key);
      }
      return next;
    });
  }

  function handleOpenDeploySelected() {
    if (!sourceOrg || !targetOrg || selectedDeployableComponents.length === 0) {
      return;
    }
    setDeployModalComponents(selectedDeployableComponents);
    setDeployModalDirection(deployDirection);
    setDeployModalOpen(true);
  }

  function handleDeploySingleFromDiff(component: OrgAlignmentComponentItem, direction: OrgAlignmentDeployDirection) {
    setActiveDiffComponent(null);
    setDeployModalComponents([component]);
    setDeployModalDirection(direction);
    setDeployModalOpen(true);
  }

  if (isSingleOrgMode) {
    return (
      <Page testId="org-alignment-page">
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle
              icon={{ type: 'standard', icon: 'asset_relationship' }}
              label="Org Alignment"
              docsPath={APP_ROUTES.ORG_ALIGNMENT.DOCS}
            />
          </PageHeaderRow>
        </PageHeader>
        <div className="slds-p-around_large">
          <EmptyState
            headline="Org Alignment requires two connected Salesforce orgs"
            subHeading="Open Jetstream on the web or desktop application to compare metadata across two orgs and deploy differences in either direction."
          />
        </div>
      </Page>
    );
  }

  const progressPercent =
    progress.totalTypes > 0 ? Math.round((progress.completedTypes / progress.totalTypes) * 100) : progress.running ? 10 : 0;

  const hasResults = typeResults.length > 0;
  const sourceLabel = sourceOrg?.label || 'Org A';
  const targetLabel = targetOrg?.label || 'Org B';

  const tabs: UiTabSection[] = [
    {
      id: 'summary',
      title: `Summary by Type (${formatNumber(typeResults.length)})`,
      titleText: 'Summary by Type',
      content: (
        <div>
          <Grid align="spread" verticalAlign="center" wrap className="slds-m-bottom_small">
            <Grid verticalAlign="center" wrap>
              <div className="slds-m-right_small">
                <SearchInput
                  id="org-alignment-type-summary-search"
                  placeholder="Filter metadata types..."
                  value={typeSummarySearch}
                  onChange={(value) => setTypeSummarySearch(value || '')}
                />
              </div>
              <Checkbox
                id="org-alignment-hide-identical-types"
                label="Hide Identical / Empty Types"
                checked={hideIdenticalTypes}
                onChange={setHideIdenticalTypes}
              />
            </Grid>
            {failedTypeNames.length > 0 && !progress.running && (
              <button type="button" className="slds-button slds-button_neutral" onClick={() => retryTypes(failedTypeNames)}>
                <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
                Retry {formatNumber(failedTypeNames.length)} Incomplete {failedTypeNames.length === 1 ? 'Type' : 'Types'}
              </button>
            )}
          </Grid>

          <div className="slds-scrollable_x">
            <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped">
              <thead>
                <tr className="slds-line-height_reset">
                  <th scope="col">Metadata Type</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="slds-text-align_right">
                    Different
                  </th>
                  <th scope="col" className="slds-text-align_right">
                    Only in {sourceLabel}
                  </th>
                  <th scope="col" className="slds-text-align_right">
                    Only in {targetLabel}
                  </th>
                  <th scope="col" className="slds-text-align_right">
                    Same
                  </th>
                  <th scope="col" className="slds-text-align_right">
                    Skipped / Uncomp.
                  </th>
                  <th scope="col" className="slds-text-align_right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTypeResults.map((entry) => {
                  const isActive =
                    entry.executionStatus === 'listing' || entry.executionStatus === 'retrieving' || entry.executionStatus === 'comparing';
                  const skippedTotal = entry.counts.uncomparable + entry.counts.managedSkipped;
                  return (
                    <tr key={entry.type}>
                      <td>
                        <strong>{entry.typeLabel}</strong>
                        {entry.typeLabel !== entry.type && (
                          <span className="slds-text-body_small slds-text-color_weak slds-m-left_xx-small">({entry.type})</span>
                        )}
                      </td>
                      <td>
                        {isActive && <span className="slds-text-color_weak">{entry.progressMessage || 'Processing...'}</span>}
                        {entry.executionStatus === 'pending' && <Badge type="light">Pending</Badge>}
                        {entry.executionStatus === 'complete' && <Badge type="success">Complete</Badge>}
                        {entry.executionStatus === 'canceled' && <Badge type="warning">Canceled</Badge>}
                        {entry.executionStatus === 'uncomparable' && (
                          <Tooltip id={`summary-uncomp-${entry.type}`} content={entry.uncomparableReason || 'Cannot be compared reliably'}>
                            <Badge type="light">Uncomparable</Badge>
                          </Tooltip>
                        )}
                        {entry.executionStatus === 'error' && (
                          <Tooltip id={`summary-err-${entry.type}`} content={entry.errorMessage || 'Failed to compare this type'}>
                            <Badge type="error">Failed</Badge>
                          </Tooltip>
                        )}
                      </td>
                      <td className="slds-text-align_right">
                        {entry.counts.different > 0 ? (
                          <Badge type="warning">{formatNumber(entry.counts.different)}</Badge>
                        ) : (
                          formatNumber(entry.counts.different)
                        )}
                      </td>
                      <td className="slds-text-align_right">{formatNumber(entry.counts.onlyInSource)}</td>
                      <td className="slds-text-align_right">{formatNumber(entry.counts.onlyInTarget)}</td>
                      <td className="slds-text-align_right">{formatNumber(entry.counts.same)}</td>
                      <td className="slds-text-align_right">
                        {skippedTotal > 0 ? (
                          <Tooltip
                            id={`summary-skip-${entry.type}`}
                            content={`${formatNumber(entry.counts.uncomparable)} uncomparable, ${formatNumber(entry.counts.managedSkipped)} managed skipped`}
                          >
                            <span>{formatNumber(skippedTotal)}</span>
                          </Tooltip>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="slds-text-align_right">
                        {entry.executionStatus === 'complete' && entry.components.length > 0 && (
                          <button type="button" className="slds-button slds-button_neutral" onClick={() => handleInspectType(entry.type)}>
                            Inspect
                          </button>
                        )}
                        {(entry.executionStatus === 'error' || entry.executionStatus === 'canceled') && !progress.running && (
                          <button type="button" className="slds-button slds-button_neutral" onClick={() => retryTypes([entry.type])}>
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredTypeResults.length === 0 && (
                  <tr>
                    <td colSpan={8} className="slds-text-align_center slds-p-around_medium slds-text-color_weak">
                      No metadata types match your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: 'components',
      title: `Components & Deploy (${formatNumber(allComponents.length)})`,
      titleText: 'Components & Deploy',
      content: (
        <div>
          <Grid align="spread" verticalAlign="center" wrap className="slds-box slds-box_x-small slds-theme_shade slds-m-bottom_small">
            <Grid verticalAlign="center" wrap>
              <span className="slds-text-title_caps slds-m-right_x-small">Deploy Direction:</span>
              <RadioGroup label="Deploy direction" hideLabel isButtonGroup>
                <RadioButton
                  name="org-alignment-deploy-direction"
                  label={`${sourceLabel} → ${targetLabel}`}
                  value="A_TO_B"
                  checked={deployDirection === 'A_TO_B'}
                  onChange={() => handleDirectionChange('A_TO_B')}
                />
                <RadioButton
                  name="org-alignment-deploy-direction"
                  label={`${targetLabel} → ${sourceLabel}`}
                  value="B_TO_A"
                  checked={deployDirection === 'B_TO_A'}
                  onChange={() => handleDirectionChange('B_TO_A')}
                />
              </RadioGroup>
            </Grid>
            <Grid verticalAlign="center">
              <span className="slds-text-body_small slds-text-color_weak slds-m-right_small">
                {formatNumber(selectedDeployableComponents.length)} selected
              </span>
              <DisabledReasonButton
                className="slds-button slds-button_brand"
                disabled={!deployAccess.allowed || selectedDeployableComponents.length === 0}
                disabledReason={
                  !deployAccess.allowed ? deployAccess.deniedReason : 'Select at least one differing or one-sided component to deploy'
                }
                onClick={handleOpenDeploySelected}
              >
                <Icon type="utility" icon="share" className="slds-button__icon slds-button__icon_left" omitContainer />
                Review &amp; Deploy ({formatNumber(selectedDeployableComponents.length)})
              </DisabledReasonButton>
            </Grid>
          </Grid>

          <Grid align="spread" verticalAlign="center" wrap className="slds-m-bottom_small">
            <Grid verticalAlign="center" wrap>
              <div className="slds-m-right_x-small slds-m-bottom_xx-small">
                <RadioGroup label="Filter by status" hideLabel isButtonGroup>
                  <RadioButton
                    name="org-alignment-status-filter"
                    label="All"
                    value="ALL"
                    checked={statusFilter === 'ALL'}
                    onChange={() => setStatusFilter('ALL')}
                  />
                  <RadioButton
                    name="org-alignment-status-filter"
                    label={`Different (${formatNumber(summaryCounts.different)})`}
                    value="different"
                    checked={statusFilter === 'different'}
                    onChange={() => setStatusFilter('different')}
                  />
                  <RadioButton
                    name="org-alignment-status-filter"
                    label={`Only in A (${formatNumber(summaryCounts.onlyInSource)})`}
                    value="onlyInSource"
                    checked={statusFilter === 'onlyInSource'}
                    onChange={() => setStatusFilter('onlyInSource')}
                  />
                  <RadioButton
                    name="org-alignment-status-filter"
                    label={`Only in B (${formatNumber(summaryCounts.onlyInTarget)})`}
                    value="onlyInTarget"
                    checked={statusFilter === 'onlyInTarget'}
                    onChange={() => setStatusFilter('onlyInTarget')}
                  />
                  <RadioButton
                    name="org-alignment-status-filter"
                    label={`Same (${formatNumber(summaryCounts.same)})`}
                    value="same"
                    checked={statusFilter === 'same'}
                    onChange={() => setStatusFilter('same')}
                  />
                  <RadioButton
                    name="org-alignment-status-filter"
                    label={`Uncomp. (${formatNumber(summaryCounts.uncomparable)})`}
                    value="uncomparable"
                    checked={statusFilter === 'uncomparable'}
                    onChange={() => setStatusFilter('uncomparable')}
                  />
                </RadioGroup>
              </div>
              <div className="slds-m-right_x-small slds-m-bottom_xx-small">
                <select
                  aria-label="Filter by metadata type"
                  className="slds-select"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="ALL">All Types ({formatNumber(typeResults.length)})</option>
                  {typeResults
                    .filter(({ components }) => components.length > 0)
                    .map(({ type, typeLabel, components }) => (
                      <option key={type} value={type}>
                        {typeLabel} ({formatNumber(components.length)})
                      </option>
                    ))}
                </select>
              </div>
              <div className="slds-m-bottom_xx-small">
                <SearchInput
                  id="org-alignment-component-search"
                  placeholder="Search components..."
                  value={componentSearch}
                  onChange={(value) => setComponentSearch(value || '')}
                />
              </div>
            </Grid>
            <Grid verticalAlign="center">
              <button
                type="button"
                className="slds-button slds-button_neutral slds-m-right_xx-small"
                disabled={visibleDeployableComponents.length === 0}
                onClick={handleSelectAllVisible}
              >
                Select Visible ({formatNumber(visibleDeployableComponents.length)})
              </button>
              <button
                type="button"
                className="slds-button slds-button_neutral"
                disabled={selectedComponentKeys.size === 0}
                onClick={() => setSelectedComponentKeys(new Set())}
              >
                Clear
              </button>
            </Grid>
          </Grid>

          <div className="slds-scrollable_x">
            <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped">
              <thead>
                <tr className="slds-line-height_reset">
                  <th scope="col" style={{ width: '2.5rem' }}>
                    <span className="slds-assistive-text">Select</span>
                  </th>
                  <th scope="col">Type</th>
                  <th scope="col">Component</th>
                  <th scope="col">Drift Status</th>
                  <th scope="col">{sourceLabel} Modified</th>
                  <th scope="col">{targetLabel} Modified</th>
                  <th scope="col" className="slds-text-align_right">
                    Diff
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredComponents.slice(0, 500).map((component) => {
                  const deployable = isComponentDeployableInDirection(component, deployDirection);
                  const statusLabel = getStatusLabel(component.status, sourceLabel, targetLabel);
                  const badgeType =
                    component.status === 'different'
                      ? 'warning'
                      : component.status === 'same'
                        ? 'success'
                        : component.status === 'onlyInSource' || component.status === 'onlyInTarget'
                          ? 'inverse'
                          : 'light';

                  return (
                    <tr key={component.key}>
                      <td>
                        <Checkbox
                          id={`select-comp-${component.key}`}
                          label={`Select ${component.fullName}`}
                          hideLabel
                          disabled={!deployable}
                          checked={selectedComponentKeys.has(component.key)}
                          onChange={(checked) => toggleComponentSelection(component.key, checked)}
                        />
                      </td>
                      <td>{component.typeLabel}</td>
                      <td>
                        <strong>{component.fullName}</strong>
                        {component.isManaged && (
                          <Badge type="light" className="slds-m-left_xx-small">
                            Managed
                          </Badge>
                        )}
                      </td>
                      <td>
                        {component.uncomparableReason ? (
                          <Tooltip id={`comp-status-${component.key}`} content={component.uncomparableReason}>
                            <Badge type={badgeType}>{statusLabel}</Badge>
                          </Tooltip>
                        ) : (
                          <Badge type={badgeType}>{statusLabel}</Badge>
                        )}
                      </td>
                      <td className="slds-text-body_small slds-text-color_weak">
                        {component.sourceItem?.lastModifiedDate
                          ? `${component.sourceItem.lastModifiedByName || 'Unknown'} · ${new Date(component.sourceItem.lastModifiedDate).toLocaleDateString()}`
                          : '—'}
                      </td>
                      <td className="slds-text-body_small slds-text-color_weak">
                        {component.targetItem?.lastModifiedDate
                          ? `${component.targetItem.lastModifiedByName || 'Unknown'} · ${new Date(component.targetItem.lastModifiedDate).toLocaleDateString()}`
                          : '—'}
                      </td>
                      <td className="slds-text-align_right">
                        {component.status !== 'uncomparable' && (
                          <button
                            type="button"
                            className="slds-button slds-button_neutral"
                            onClick={() => setActiveDiffComponent(component)}
                          >
                            <Icon type="utility" icon="preview" className="slds-button__icon slds-button__icon_left" omitContainer />
                            {component.status === 'onlyInSource' || component.status === 'onlyInTarget' ? 'View' : 'Diff'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredComponents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="slds-text-align_center slds-p-around_medium slds-text-color_weak">
                      No components match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {filteredComponents.length > 500 && (
              <div className="slds-p-around_small slds-text-body_small slds-text-color_weak slds-text-align_center">
                Showing first 500 of {formatNumber(filteredComponents.length)} matching components. Narrow your search or type filter to see
                more, or export the full drift report.
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <Page testId="org-alignment-page">
      <ConfirmPageChange actionInProgress={progress.running} />
      <RequireMetadataApiBanner />

      {toastMessage && (
        <Toast type="success" onClose={() => setToastMessage(null)}>
          {toastMessage}
        </Toast>
      )}

      {typeSelectorModalOpen && sourceOrg && targetOrg && (
        <OrgAlignmentTypeSelectorModal
          sourceOrg={sourceOrg}
          targetOrg={targetOrg}
          initialSelectedTypes={customMetadataTypes}
          onApply={(selected) => {
            setCustomMetadataTypes(selected);
            setSelectionMode('custom');
            setTypeSelectorModalOpen(false);
          }}
          onClose={() => setTypeSelectorModalOpen(false)}
        />
      )}

      {savedModalMode && (
        <OrgAlignmentSavedComparisonsModal
          mode={savedModalMode}
          savedComparisons={savedComparisons}
          orgsById={orgsById}
          hasProAccess={hasOrgAlignmentProAccess}
          showUpgradeToPro={orgAlignmentShowUpgradeToPro}
          activeSavedKey={activeSavedKey}
          currentSourceOrg={sourceOrg}
          currentTargetOrg={targetOrg}
          onSave={handleSaveComparison}
          onLoad={handleLoadSavedComparison}
          onDelete={handleDeleteSavedComparison}
          onClose={() => setSavedModalMode(null)}
        />
      )}

      {activeDiffComponent && sourceOrg && targetOrg && (
        <OrgAlignmentDiffModal
          key={activeDiffComponent.key}
          component={activeDiffComponent}
          sourceOrg={sourceOrg}
          targetOrg={targetOrg}
          normalizePermissionXml={normalizePermissionXml}
          onNormalizePermissionXmlChange={handleNormalizeToggle}
          onLoadComponentFiles={loadComponentFilesOnDemand}
          onDeploySingle={handleDeploySingleFromDiff}
          onClose={() => setActiveDiffComponent(null)}
        />
      )}

      {deployModalOpen && sourceOrg && targetOrg && (
        <OrgAlignmentDeployModal
          sourceOrg={sourceOrg}
          targetOrg={targetOrg}
          direction={deployModalDirection}
          initialSelectedComponents={deployModalComponents}
          allComponents={allComponents}
          destinationInventoryByType={getDestinationInventoryByType(deployModalDirection)}
          onClose={() => setDeployModalOpen(false)}
        />
      )}

      {exportModalConfig.open && exportModalConfig.data && sourceOrg && (
        <FileDownloadModal
          org={sourceOrg}
          googleIntegrationEnabled={hasGoogleDriveAccess}
          googleShowUpgradeToPro={googleShowUpgradeToPro}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          modalHeader="Export Org Alignment Drift Report"
          data={exportModalConfig.data}
          fileNameParts={exportModalConfig.fileNameParts}
          allowedTypes={exportModalConfig.allowedTypes}
          escapeCsvFormulas
          onModalClose={() => setExportModalConfig({ open: false, data: null, allowedTypes: [], fileNameParts: [] })}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}

      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'asset_relationship' }}
            label="Org Alignment"
            titleDropDown={<ProBadge className="slds-m-left_x-small" />}
            docsPath={APP_ROUTES.ORG_ALIGNMENT.DOCS}
          />
          <PageHeaderActions colType="actions" buttonType="separate">
            <ButtonGroupContainer>
              <button type="button" className="slds-button slds-button_neutral" onClick={() => setSavedModalMode('BROWSE')}>
                <Icon type="utility" icon="favorite" className="slds-button__icon slds-button__icon_left" omitContainer />
                Saved ({formatNumber(savedComparisons.length)})
              </button>
              <button
                type="button"
                className="slds-button slds-button_neutral"
                disabled={!sourceOrg || !targetOrg}
                onClick={() => setSavedModalMode('SAVE')}
              >
                <Icon type="utility" icon="save" className="slds-button__icon slds-button__icon_left" omitContainer />
                {activeSavedKey ? 'Update Saved' : 'Save'}
              </button>
              <DropDown
                className="slds-button_last"
                position="right"
                buttonContent={
                  <span>
                    <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Export Report
                  </span>
                }
                disabled={!hasResults || progress.running}
                items={[
                  {
                    id: EXPORT_ACTION_XLSX,
                    subheader: 'Change-Review Exports',
                    icon: { type: 'utility', icon: 'file' },
                    value: 'Download Excel Workbook (.xlsx)',
                  },
                  {
                    id: EXPORT_ACTION_CSV,
                    icon: { type: 'utility', icon: 'download' },
                    value: 'Download CSV (.csv)',
                  },
                  {
                    id: EXPORT_ACTION_JSON,
                    icon: { type: 'utility', icon: 'download' },
                    value: 'Download JSON (.json)',
                    trailingDivider: true,
                  },
                  {
                    id: EXPORT_ACTION_MD_COPY,
                    subheader: 'Meeting Summary (Markdown)',
                    icon: { type: 'utility', icon: 'copy_to_clipboard' },
                    value: 'Copy Markdown Summary',
                  },
                  {
                    id: EXPORT_ACTION_MD_DOWNLOAD,
                    icon: { type: 'utility', icon: 'download' },
                    value: 'Download Markdown (.md)',
                  },
                ]}
                onSelected={handleExportAction}
              />
            </ButtonGroupContainer>

            {progress.running ? (
              <button type="button" className="slds-button slds-button_destructive" onClick={cancelComparison}>
                <Icon type="utility" icon="close" className="slds-button__icon slds-button__icon_left" omitContainer />
                Cancel
              </button>
            ) : (
              <button type="button" className="slds-button slds-button_brand" disabled={!canRun} onClick={() => executeComparison()}>
                <Icon type="utility" icon="sync" className="slds-button__icon slds-button__icon_left" omitContainer />
                Compare Orgs
              </button>
            )}
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>

      <div className="slds-p-around_small">
        {!hasOrgAlignmentProAccess && (
          <ScopedNotification theme={freeLimitReached ? 'warning' : 'light'} className="slds-m-bottom_small">
            <Grid align="spread" verticalAlign="center" wrap>
              <div className="slds-m-right_small">
                {freeLimitReached ? (
                  <span>
                    You have used your {FREE_REPORT_LIMIT} free Org Alignment drift report. Upgrade to Jetstream Pro for unlimited org-wide
                    drift reports and saved comparisons. Per-component compare in{' '}
                    <Link to={APP_ROUTES.DEPLOY_METADATA.ROUTE}>Deploy and Compare Metadata</Link> remains free.
                  </span>
                ) : (
                  <span>
                    Org Alignment includes {FREE_REPORT_LIMIT} free org-wide drift report and {FREE_ORG_ALIGNMENT_SAVED_LIMIT} saved
                    comparison. Upgrade to Jetstream Pro for unlimited reports and saved definitions.
                  </span>
                )}
              </div>
              {orgAlignmentShowUpgradeToPro && <UpgradeToProButton />}
            </Grid>
          </ScopedNotification>
        )}

        <div className="slds-box slds-theme_default slds-m-bottom_small">
          <Grid verticalAlign="end" wrap className="slds-gutters_small">
            <div className="slds-col slds-size_1-of-1 slds-medium-size_5-of-12">
              <GroupScopedOrgsCombobox
                label="Org A (Source / Baseline)"
                hideLabel={false}
                placeholder="Select Org A"
                orgs={sourceOrgOptions}
                selectedOrg={sourceOrg}
                disabled={progress.running}
                minWidth={0}
                onSelected={(org) => {
                  setSourceOrg(org);
                  setActiveSavedKey(null);
                  resetComparison();
                }}
              />
            </div>
            <div className="slds-col slds-grow-none slds-p-bottom_xxx-small">
              <Tooltip id="org-alignment-swap-orgs" content="Swap Org A and Org B">
                <button
                  type="button"
                  className="slds-button slds-button_icon slds-button_icon-border-filled"
                  aria-label="Swap Org A and Org B"
                  disabled={progress.running || (!sourceOrg && !targetOrg)}
                  onClick={handleSwapOrgs}
                >
                  <Icon type="utility" icon="switch" className="slds-button__icon" omitContainer />
                </button>
              </Tooltip>
            </div>
            <div className="slds-col slds-size_1-of-1 slds-medium-size_5-of-12">
              <GroupScopedOrgsCombobox
                label="Org B (Compare Against)"
                hideLabel={false}
                placeholder="Select Org B"
                orgs={targetOrgOptions}
                selectedOrg={targetOrg}
                disabled={progress.running}
                minWidth={0}
                onSelected={(org) => {
                  setTargetOrg(org);
                  setActiveSavedKey(null);
                  resetComparison();
                }}
              />
            </div>
          </Grid>

          <Grid align="spread" verticalAlign="center" wrap className="slds-m-top_small slds-p-top_small slds-border_top">
            <Grid verticalAlign="center" wrap>
              <span className="slds-text-title_caps slds-m-right_x-small">Metadata Scope:</span>
              <RadioGroup label="Metadata scope" hideLabel isButtonGroup className="slds-m-right_x-small">
                <RadioButton
                  name="org-alignment-scope"
                  label={`Common (${COMMON_METADATA_TYPES.length})`}
                  value="common"
                  checked={selectionMode === 'common'}
                  disabled={progress.running}
                  onChange={() => setSelectionMode('common')}
                />
                <RadioButton
                  name="org-alignment-scope"
                  label="All Comparable"
                  value="all"
                  checked={selectionMode === 'all'}
                  disabled={progress.running}
                  onChange={() => setSelectionMode('all')}
                />
                <RadioButton
                  name="org-alignment-scope"
                  label={`Custom (${customMetadataTypes.length})`}
                  value="custom"
                  checked={selectionMode === 'custom'}
                  disabled={progress.running}
                  onChange={() => setSelectionMode('custom')}
                />
              </RadioGroup>
              <button
                type="button"
                className="slds-button slds-button_neutral"
                disabled={progress.running || !sourceOrg || !targetOrg}
                onClick={() => setTypeSelectorModalOpen(true)}
              >
                Choose Types...
              </button>
            </Grid>

            <Grid verticalAlign="center" wrap>
              <Checkbox
                id="org-alignment-normalize-xml"
                className="slds-m-right_medium"
                label="Normalize Profile & PermSet XML"
                labelHelp="Sort Profile and Permission Set XML child elements before comparing to remove ordering noise."
                checked={normalizePermissionXml}
                onChange={handleNormalizeToggle}
              />
              <Checkbox
                id="org-alignment-include-managed"
                className="slds-m-right_medium"
                label="Show Managed (Uncomparable)"
                labelHelp="By default managed package components are skipped. Enable to list them explicitly as Uncomparable."
                checked={includeManaged}
                disabled={progress.running}
                onChange={setIncludeManaged}
              />
              <Checkbox
                id="org-alignment-skip-cache"
                label="Bypass Cache"
                labelHelp="Fetch fresh metadata lists directly from Salesforce instead of using cached listMetadata results."
                checked={skipRequestCache}
                disabled={progress.running}
                onChange={setSkipRequestCache}
              />
            </Grid>
          </Grid>
        </div>

        {fatalError && (
          <ScopedNotification theme="error" className="slds-m-bottom_small">
            Comparison failed: {fatalError}
          </ScopedNotification>
        )}

        {(progress.running || progress.phase === 'canceled') && (
          <div className="slds-box slds-theme_default slds-m-bottom_small">
            <Grid align="spread" verticalAlign="center" className="slds-m-bottom_xx-small">
              <Grid verticalAlign="center">
                {progress.running && (
                  <div
                    className="slds-is-relative slds-m-right_small"
                    css={css`
                      width: 1.25rem;
                      height: 1.25rem;
                    `}
                  >
                    <Spinner size="x-small" />
                  </div>
                )}
                <strong>{progress.detailMessage || 'Comparing orgs...'}</strong>
              </Grid>
              <span className="slds-text-body_small slds-text-color_weak">
                {formatNumber(progress.completedTypes)} / {formatNumber(progress.totalTypes)} types ({progressPercent}%)
              </span>
            </Grid>
            <ProgressIndicator
              label="Org alignment comparison progress"
              currentValue={progressPercent}
              isIndeterminate={progress.phase === 'describing'}
            />
          </div>
        )}

        {hasResults && (
          <Fragment>
            <div
              className="slds-m-bottom_small"
              css={css`
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                gap: 0.5rem;
              `}
            >
              <button
                type="button"
                className="slds-box slds-box_small slds-theme_default slds-text-align_left cursor-pointer"
                onClick={() => handleKpiClick('different')}
              >
                <div className="slds-text-title_caps slds-text-color_weak">Different</div>
                <div className="slds-text-heading_large slds-text-color_error">{formatNumber(summaryCounts.different)}</div>
              </button>
              <button
                type="button"
                className="slds-box slds-box_small slds-theme_default slds-text-align_left cursor-pointer"
                onClick={() => handleKpiClick('onlyInSource')}
              >
                <div className="slds-text-title_caps slds-text-color_weak slds-truncate" title={`Only in ${sourceLabel}`}>
                  Only in {sourceLabel}
                </div>
                <div className="slds-text-heading_large">{formatNumber(summaryCounts.onlyInSource)}</div>
              </button>
              <button
                type="button"
                className="slds-box slds-box_small slds-theme_default slds-text-align_left cursor-pointer"
                onClick={() => handleKpiClick('onlyInTarget')}
              >
                <div className="slds-text-title_caps slds-text-color_weak slds-truncate" title={`Only in ${targetLabel}`}>
                  Only in {targetLabel}
                </div>
                <div className="slds-text-heading_large">{formatNumber(summaryCounts.onlyInTarget)}</div>
              </button>
              <button
                type="button"
                className="slds-box slds-box_small slds-theme_default slds-text-align_left cursor-pointer"
                onClick={() => handleKpiClick('same')}
              >
                <div className="slds-text-title_caps slds-text-color_weak">Same</div>
                <div className="slds-text-heading_large slds-text-color_success">{formatNumber(summaryCounts.same)}</div>
              </button>
              <button
                type="button"
                className="slds-box slds-box_small slds-theme_default slds-text-align_left cursor-pointer"
                onClick={() => handleKpiClick('uncomparable')}
              >
                <div className="slds-text-title_caps slds-text-color_weak">Uncomparable / Skipped</div>
                <div className="slds-text-heading_large slds-text-color_weak">
                  {formatNumber(summaryCounts.uncomparable + summaryCounts.managedSkipped)}
                </div>
                {uncomparableTypesCount > 0 && (
                  <div className="slds-text-body_small slds-text-color_weak">
                    +{formatNumber(uncomparableTypesCount)} skipped {uncomparableTypesCount === 1 ? 'type' : 'types'}
                  </div>
                )}
              </button>
            </div>

            {sourceOrg && targetOrg && (
              <div className="slds-m-bottom_x-small slds-text-body_small slds-text-color_weak slds-grid slds-grid_vertical-align-center slds-wrap">
                <span className="slds-m-right_xx-small">Comparing:</span>
                <OrgLabelBadge org={sourceOrg} />
                <span className="slds-m-horizontal_xx-small">vs</span>
                <OrgLabelBadge org={targetOrg} />
                {lastCompletedAt && <span className="slds-m-left_small">· Completed at {lastCompletedAt.toLocaleTimeString()}</span>}
              </div>
            )}

            <div className="slds-box slds-box_small slds-theme_default">
              <Tabs ref={tabsRef} initialActiveId="summary" tabs={tabs} />
            </div>
          </Fragment>
        )}

        {!hasResults && !progress.running && (
          <div className="slds-box slds-theme_default slds-p-around_large">
            <EmptyState
              headline="Pick two orgs to run a drift report"
              subHeading="Jetstream compares metadata lists across both orgs first, retrieves only shared candidates in chunks, highlights differences and one-sided items, and lets you validate, back up, and deploy in either direction."
            />
          </div>
        )}
      </div>
    </Page>
  );
};

export default OrgAlignment;
