import { css } from '@emotion/react';
import { COMMON_METADATA_TYPES } from '@jetstream/connected-ui';
import { TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import {
  formatNumber,
  generateCsv,
  isBrowserExtension,
  isCanvasApp,
  transformTabularDataToExcelStr,
  useTitle,
} from '@jetstream/shared/ui-utils';
import { orderObjectsBy } from '@jetstream/shared/utils';
import {
  FileExtAllTypes,
  ListItem,
  ListMetadataResult,
  OrgAlignmentRunSummaryCounts,
  OrgAlignmentSavedComparison,
  OrgAlignmentSelectionMode,
  SalesforceOrgUi,
  UiTabSection,
} from '@jetstream/types';
import {
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
import classNames from 'classnames';
import copyToClipboard from 'copy-to-clipboard';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import DownloadPackageWithFileSelector from '../utils/DownloadPackageWithFileSelector';
import { ALL_TYPES_FILTER, OrgAlignmentComponentsTable, STATUS_LABELS } from './OrgAlignmentComponentsTable';
import OrgAlignmentDeployModal from './OrgAlignmentDeployModal';
import OrgAlignmentDiffModal from './OrgAlignmentDiffModal';
import OrgAlignmentSavedComparisonsModal, { FREE_ORG_ALIGNMENT_SAVED_LIMIT } from './OrgAlignmentSavedComparisonsModal';
import { OrgAlignmentSummaryTable } from './OrgAlignmentSummaryTable';
import OrgAlignmentTypeSelectorModal from './OrgAlignmentTypeSelectorModal';
import {
  OrgAlignmentComponentItem,
  OrgAlignmentDeployDirection,
  OrgAlignmentDiffStatus,
  OrgAlignmentExportContext,
} from './orgAlignmentTypes';
import {
  aggregateSummaryCounts,
  buildChangeReviewHtml,
  buildChangeReviewMarkdown,
  buildDriftReportFlatRows,
  buildDriftReportWorkbookData,
  componentsToListMetadataMap,
  isComponentDeployableInDirection,
} from './orgAlignmentUtils';
import { useOrgAlignmentCompare } from './useOrgAlignmentCompare';

const FREE_REPORT_STORAGE_KEY = 'JETSTREAM_ORG_ALIGNMENT_FREE_REPORTS_USED';
const FREE_REPORT_LIMIT = 1;

const EXPORT_ACTION_XLSX = 'export-xlsx';
const EXPORT_ACTION_CSV = 'export-csv';
const EXPORT_ACTION_JSON = 'export-json';
const EXPORT_ACTION_COPY_MARKDOWN = 'export-copy-markdown';
const EXPORT_ACTION_COPY_HTML = 'export-copy-html';
const EXPORT_ACTION_COPY_EXCEL = 'export-copy-excel';
const EXPORT_ACTION_COPY_CSV = 'export-copy-csv';

/** Copies rich text along with a plain text version for places that cannot accept formatted content */
function copyRichTextToClipboard(html: string, plainText: string) {
  copyToClipboard(html, {
    format: 'text/html',
    onCopy: (clipboardData) => {
      if ('setData' in clipboardData) {
        clipboardData.setData('text/plain', plainText);
        return;
      }
      return new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      });
    },
  });
}

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
  // Set while several selected components are being viewed together
  const [diffComponents, setDiffComponents] = useState<OrgAlignmentComponentItem[] | null>(null);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployModalComponents, setDeployModalComponents] = useState<OrgAlignmentComponentItem[]>([]);
  const [deployModalDirection, setDeployModalDirection] = useState<OrgAlignmentDeployDirection>('A_TO_B');

  const [deployDirection, setDeployDirection] = useState<OrgAlignmentDeployDirection>('A_TO_B');
  const [selectedComponentKeys, setSelectedComponentKeys] = useState<Set<string>>(() => new Set());
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrgAlignmentDiffStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES_FILTER);
  const [componentSearch, setComponentSearch] = useState('');
  // The setup section is collapsed once a comparison starts so the results get the room
  const [setupCollapsed, setSetupCollapsed] = useState(false);
  // Which org the selected components are being downloaded from, A_TO_B is the source org
  const [downloadPackageFrom, setDownloadPackageFrom] = useState<OrgAlignmentDeployDirection | null>(null);
  const [resultsFullScreen, setResultsFullScreen] = useState(false);

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
      setTypeFilter(ALL_TYPES_FILTER);
      setComponentSearch('');
      setSetupCollapsed(true);

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
    } else if (actionId === EXPORT_ACTION_COPY_MARKDOWN) {
      copyToClipboard(buildChangeReviewMarkdown(context));
    } else if (actionId === EXPORT_ACTION_COPY_HTML) {
      copyRichTextToClipboard(buildChangeReviewHtml(context), buildChangeReviewMarkdown(context));
    } else if (actionId === EXPORT_ACTION_COPY_EXCEL) {
      copyToClipboard(transformTabularDataToExcelStr(buildDriftReportFlatRows(context, false)), { format: 'text/plain' });
    } else if (actionId === EXPORT_ACTION_COPY_CSV) {
      copyToClipboard(generateCsv(buildDriftReportFlatRows(context, false)), { format: 'text/plain' });
    }
  }

  const handleViewComponentsOfType = useCallback((metadataType: string) => {
    setTypeFilter(metadataType);
    setStatusFilter('ALL');
    setComponentSearch('');
    tabsRef.current?.changeTab('components');
  }, []);

  /** The summary cards double as the status filter, choosing the active one again clears it */
  function handleStatusCardClick(status: OrgAlignmentDiffStatus) {
    setStatusFilter((previous) => (previous === status ? 'ALL' : status));
    setTypeFilter(ALL_TYPES_FILTER);
    tabsRef.current?.changeTab('components');
  }

  function handleClearFilters() {
    setStatusFilter('ALL');
    setTypeFilter(ALL_TYPES_FILTER);
    setComponentSearch('');
  }

  const componentsMatchingStatus = useMemo(
    () => (statusFilter === 'ALL' ? allComponents : allComponents.filter(({ status }) => status === statusFilter)),
    [allComponents, statusFilter],
  );

  const filteredComponents = useMemo(
    () => (typeFilter === ALL_TYPES_FILTER ? componentsMatchingStatus : componentsMatchingStatus.filter(({ type }) => type === typeFilter)),
    [componentsMatchingStatus, typeFilter],
  );

  // Counts follow the status filter so the list never offers a type that would show nothing unexpectedly
  const typeFilterItems = useMemo<ListItem[]>(() => {
    const countByType = new Map<string, number>();
    for (const { type } of componentsMatchingStatus) {
      countByType.set(type, (countByType.get(type) ?? 0) + 1);
    }
    return [
      { id: ALL_TYPES_FILTER, value: ALL_TYPES_FILTER, label: `All Types (${formatNumber(componentsMatchingStatus.length)})` },
      ...typeResults
        .filter(({ components }) => components.length > 0)
        .map(({ type, typeLabel }) => ({ id: type, value: type, label: `${typeLabel} (${formatNumber(countByType.get(type) ?? 0)})` })),
    ];
  }, [componentsMatchingStatus, typeResults]);

  const selectedComponents = useMemo(
    () => allComponents.filter((component) => selectedComponentKeys.has(component.key)),
    [allComponents, selectedComponentKeys],
  );

  const selectedDeployableComponents = useMemo(
    () => selectedComponents.filter((component) => isComponentDeployableInDirection(component, deployDirection)),
    [deployDirection, selectedComponents],
  );

  // Everything selected that exists in each org, whether or not it is different
  const selectedMetadataToDownload = useMemo(() => {
    const getDownload = (direction: OrgAlignmentDeployDirection) => {
      const listMetadataItems = componentsToListMetadataMap(selectedComponents, direction);
      return { listMetadataItems, count: Object.values(listMetadataItems).reduce((total, items) => total + items.length, 0) };
    };
    return { A_TO_B: getDownload('A_TO_B'), B_TO_A: getDownload('B_TO_A') };
  }, [selectedComponents]);

  const selectedViewableComponents = useMemo(
    () => selectedComponents.filter(({ status }) => status !== 'uncomparable'),
    [selectedComponents],
  );

  const handleViewComponent = useCallback((component: OrgAlignmentComponentItem) => {
    setDiffComponents(null);
    setActiveDiffComponent(component);
  }, []);

  function handleViewSelected() {
    if (selectedViewableComponents.length === 0) {
      return;
    }
    // Same order as the tree in the modal, which groups the components by type
    const componentsToView = orderObjectsBy(selectedViewableComponents, ['typeLabel', 'fullName']);
    setDiffComponents(componentsToView.length > 1 ? componentsToView : null);
    setActiveDiffComponent(componentsToView[0]);
  }

  function handleSelectDiffComponent(componentKey: string) {
    // Looked up again so that a component whose content was already retrieved is not retrieved a second time
    const component = allComponents.find(({ key }) => key === componentKey);
    if (component) {
      setActiveDiffComponent(component);
    }
  }

  function handleCloseDiff() {
    setDiffComponents(null);
    setActiveDiffComponent(null);
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
    handleCloseDiff();
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
  const showSetup = !setupCollapsed || (!hasResults && !progress.running);
  const downloadPackageOrg = downloadPackageFrom === 'A_TO_B' ? sourceOrg : targetOrg;
  const downloadPackage = selectedMetadataToDownload[downloadPackageFrom ?? 'A_TO_B'];
  const deployTargetOrg = deployDirection === 'A_TO_B' ? targetOrg : sourceOrg;
  const layoutKey = [showSetup, progress.running, progress.phase, hasOrgAlignmentProAccess, Boolean(fatalError), resultsFullScreen].join(
    '-',
  );

  let filterDescription: string | null = null;
  if (statusFilter !== 'ALL' || typeFilter !== ALL_TYPES_FILTER) {
    const activeFilters = [
      statusFilter !== 'ALL' ? STATUS_LABELS[statusFilter] : null,
      typeFilter !== ALL_TYPES_FILTER ? (typeResults.find(({ type }) => type === typeFilter)?.typeLabel ?? typeFilter) : null,
    ].filter(Boolean);
    filterDescription = `${formatNumber(filteredComponents.length)} of ${formatNumber(allComponents.length)} components shown, filtered to ${activeFilters.join(' and ')}`;
  }

  let deployDisabledReason = deployAccess.deniedReason;
  if (deployAccess.allowed) {
    deployDisabledReason =
      selectedComponents.length === 0
        ? 'Select the components to deploy'
        : `None of the selected components are different or missing in ${deployTargetOrg?.label ?? 'the target org'}`;
  }

  const statusCards: { status: OrgAlignmentDiffStatus; count: number; countClassName?: string; footnote?: string }[] = [
    { status: 'different', count: summaryCounts.different, countClassName: 'slds-text-color_error' },
    { status: 'onlyInSource', count: summaryCounts.onlyInSource },
    { status: 'onlyInTarget', count: summaryCounts.onlyInTarget },
    { status: 'same', count: summaryCounts.same, countClassName: 'slds-text-color_success' },
    {
      status: 'uncomparable',
      count: summaryCounts.uncomparable,
      countClassName: 'slds-text-color_weak',
      footnote:
        summaryCounts.managedSkipped + uncomparableTypesCount > 0
          ? [
              summaryCounts.managedSkipped > 0 ? `${formatNumber(summaryCounts.managedSkipped)} managed skipped` : null,
              uncomparableTypesCount > 0
                ? `${formatNumber(uncomparableTypesCount)} ${uncomparableTypesCount === 1 ? 'type' : 'types'} skipped`
                : null,
            ]
              .filter(Boolean)
              .join(', ')
          : undefined,
    },
  ];

  const tabs: UiTabSection[] = [
    {
      id: 'summary',
      title: `By Type (${formatNumber(typeResults.length)})`,
      titleText: 'By Type',
      content: (
        <OrgAlignmentSummaryTable
          typeResults={typeResults}
          incompleteTypes={failedTypeNames}
          isRunning={progress.running}
          layoutKey={layoutKey}
          onViewComponents={handleViewComponentsOfType}
          onRetry={retryTypes}
        />
      ),
    },
    {
      id: 'components',
      title: `Components (${formatNumber(allComponents.length)})`,
      titleText: 'Components',
      content: (
        <OrgAlignmentComponentsTable
          components={filteredComponents}
          typeFilterItems={typeFilterItems}
          typeFilter={typeFilter}
          filterDescription={filterDescription}
          searchTerm={componentSearch}
          selectedKeys={selectedComponentKeys}
          layoutKey={layoutKey}
          onTypeFilterChange={setTypeFilter}
          onSearchTermChange={setComponentSearch}
          onClearFilters={handleClearFilters}
          onSelectedKeysChange={setSelectedComponentKeys}
          onView={handleViewComponent}
          actions={
            <Fragment>
              <span className="slds-text-body_small slds-text-color_weak slds-m-right_small">
                {formatNumber(selectedComponents.length)} selected
              </span>
              <RadioGroup label="Deploy direction" hideLabel isButtonGroup className="slds-m-right_x-small">
                <RadioButton
                  name="org-alignment-deploy-direction"
                  label="Source to Target"
                  value="A_TO_B"
                  checked={deployDirection === 'A_TO_B'}
                  onChange={() => setDeployDirection('A_TO_B')}
                />
                <RadioButton
                  name="org-alignment-deploy-direction"
                  label="Target to Source"
                  value="B_TO_A"
                  checked={deployDirection === 'B_TO_A'}
                  onChange={() => setDeployDirection('B_TO_A')}
                />
              </RadioGroup>
              <button
                type="button"
                className="slds-button slds-button_neutral slds-m-right_x-small"
                title="View and compare the selected components"
                disabled={selectedViewableComponents.length === 0}
                onClick={handleViewSelected}
              >
                <Icon type="utility" icon="preview" className="slds-button__icon slds-button__icon_left" omitContainer />
                View Selected
              </button>
              <DropDown
                className="slds-m-right_x-small"
                position="right"
                buttonClassName="slds-button slds-button_neutral"
                buttonContent={
                  <span>
                    <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Download Package
                  </span>
                }
                disabled={selectedMetadataToDownload.A_TO_B.count + selectedMetadataToDownload.B_TO_A.count === 0}
                items={[
                  {
                    id: 'A_TO_B',
                    value: `From Source Org (${formatNumber(selectedMetadataToDownload.A_TO_B.count)})`,
                    title: sourceOrg?.label,
                    disabled: selectedMetadataToDownload.A_TO_B.count === 0,
                  },
                  {
                    id: 'B_TO_A',
                    value: `From Target Org (${formatNumber(selectedMetadataToDownload.B_TO_A.count)})`,
                    title: targetOrg?.label,
                    disabled: selectedMetadataToDownload.B_TO_A.count === 0,
                  },
                ]}
                onSelected={(id) => setDownloadPackageFrom(id as OrgAlignmentDeployDirection)}
              />
              <DisabledReasonButton
                className="slds-button slds-button_brand"
                disabled={!deployAccess.allowed || selectedDeployableComponents.length === 0}
                disabledReason={deployDisabledReason}
                onClick={handleOpenDeploySelected}
              >
                <Icon type="utility" icon="share" className="slds-button__icon slds-button__icon_left" omitContainer />
                Review &amp; Deploy ({formatNumber(selectedDeployableComponents.length)})
              </DisabledReasonButton>
            </Fragment>
          }
        />
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
          component={activeDiffComponent}
          components={diffComponents ?? undefined}
          onSelectComponent={handleSelectDiffComponent}
          sourceOrg={sourceOrg}
          targetOrg={targetOrg}
          normalizePermissionXml={normalizePermissionXml}
          onNormalizePermissionXmlChange={handleNormalizeToggle}
          onLoadComponentFiles={loadComponentFilesOnDemand}
          onDeploySingle={handleDeploySingleFromDiff}
          onClose={handleCloseDiff}
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

      {downloadPackageFrom && downloadPackageOrg && (
        <DownloadPackageWithFileSelector
          type="package"
          selectedOrg={downloadPackageOrg}
          modalTagline={`${formatNumber(downloadPackage.count)} ${downloadPackage.count === 1 ? 'component' : 'components'} from ${downloadPackageOrg.label} will be included`}
          listMetadataItems={downloadPackage.listMetadataItems}
          onClose={() => setDownloadPackageFrom(null)}
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
                buttonClassName="slds-button slds-button_neutral"
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
                    id: EXPORT_ACTION_COPY_MARKDOWN,
                    icon: { type: 'utility', icon: 'copy_to_clipboard' },
                    value: 'Copy Summary to Clipboard (Markdown)',
                  },
                  {
                    id: EXPORT_ACTION_COPY_HTML,
                    icon: { type: 'utility', icon: 'copy_to_clipboard' },
                    value: 'Copy Summary to Clipboard (Rich Text)',
                  },
                  {
                    id: EXPORT_ACTION_COPY_EXCEL,
                    icon: { type: 'utility', icon: 'copy_to_clipboard' },
                    value: 'Copy Components to Clipboard (Excel)',
                  },
                  {
                    id: EXPORT_ACTION_COPY_CSV,
                    icon: { type: 'utility', icon: 'copy_to_clipboard' },
                    value: 'Copy Components to Clipboard (CSV)',
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

        {!showSetup && sourceOrg && targetOrg && (
          <Grid align="spread" verticalAlign="center" wrap className="slds-box slds-box_x-small slds-theme_default slds-m-bottom_small">
            <Grid verticalAlign="center" wrap>
              <span className="slds-text-title_caps slds-m-right_x-small">Source</span>
              <OrgLabelBadge org={sourceOrg} />
              <span className="slds-text-title_caps slds-m-left_medium slds-m-right_x-small">Target</span>
              <OrgLabelBadge org={targetOrg} />
              {lastCompletedAt && !progress.running && (
                <span className="slds-m-left_medium slds-text-body_small slds-text-color_weak">
                  Compared at {lastCompletedAt.toLocaleTimeString()}
                </span>
              )}
            </Grid>
            <button type="button" className="slds-button" disabled={progress.running} onClick={() => setSetupCollapsed(false)}>
              Change Comparison
              <Icon type="utility" icon="chevrondown" className="slds-button__icon slds-button__icon_right" omitContainer />
            </button>
          </Grid>
        )}

        {showSetup && (
          <div className="slds-box slds-theme_default slds-m-bottom_small">
            <Grid verticalAlign="end" wrap className="slds-gutters_small">
              <div className="slds-col slds-size_1-of-1 slds-medium-size_5-of-12">
                <GroupScopedOrgsCombobox
                  label="Source Org"
                  hideLabel={false}
                  placeholder="Select the source org"
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
                <Tooltip id="org-alignment-swap-orgs" content="Swap the source and target orgs">
                  <button
                    type="button"
                    className="slds-button slds-button_icon slds-button_icon-border-filled"
                    aria-label="Swap the source and target orgs"
                    disabled={progress.running || (!sourceOrg && !targetOrg)}
                    onClick={handleSwapOrgs}
                  >
                    <Icon type="utility" icon="rotate" className="slds-button__icon" omitContainer />
                  </button>
                </Tooltip>
              </div>
              <div className="slds-col slds-size_1-of-1 slds-medium-size_5-of-12">
                <GroupScopedOrgsCombobox
                  label="Target Org"
                  hideLabel={false}
                  placeholder="Select the target org"
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
              {hasResults && (
                <div className="slds-col slds-grow-none slds-col_bump-left slds-p-bottom_xxx-small">
                  <button type="button" className="slds-button" onClick={() => setSetupCollapsed(true)}>
                    Hide
                    <Icon type="utility" icon="up" className="slds-button__icon slds-button__icon_right" omitContainer />
                  </button>
                </div>
              )}
            </Grid>

            <Grid align="spread" verticalAlign="center" wrap className="slds-m-top_small slds-p-top_small slds-border_top">
              <Grid verticalAlign="center" wrap>
                <span className="slds-text-title_caps slds-m-right_x-small">Metadata Types:</span>
                <RadioGroup label="Metadata types" hideLabel isButtonGroup className="slds-m-right_x-small">
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
                    label="All"
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
                  Choose Types
                </button>
              </Grid>

              <Grid verticalAlign="center" wrap>
                <Checkbox
                  id="org-alignment-normalize-xml"
                  className="slds-m-right_medium"
                  label="Ignore permission ordering"
                  labelHelp="Salesforce returns the entries of profiles and permission sets in a different order in each org. Leave this on so that only real permission differences are reported."
                  checked={normalizePermissionXml}
                  onChange={handleNormalizeToggle}
                />
                <Checkbox
                  id="org-alignment-include-managed"
                  className="slds-m-right_medium"
                  label="Include managed packages"
                  labelHelp="Components from managed packages are skipped because Salesforce hides their content. Turn this on to list them anyway, they are shown as Not Compared."
                  checked={includeManaged}
                  disabled={progress.running}
                  onChange={setIncludeManaged}
                />
                <Checkbox
                  id="org-alignment-skip-cache"
                  label="Refresh from Salesforce"
                  labelHelp="Jetstream remembers which components each org has for a while to make comparisons faster. Turn this on if metadata was recently added, renamed or deleted and the results look out of date."
                  checked={skipRequestCache}
                  disabled={progress.running}
                  onChange={setSkipRequestCache}
                />
              </Grid>
            </Grid>
          </div>
        )}

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
                      /* Own stacking context, the spinner's z-index would otherwise put it above an open modal */
                      z-index: 0;
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
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 0.5rem;
              `}
            >
              {statusCards.map(({ status, count, countClassName, footnote }) => {
                const isActive = statusFilter === status;
                return (
                  <button
                    key={status}
                    type="button"
                    className="slds-box slds-box_x-small slds-theme_default slds-text-align_left cursor-pointer"
                    css={css`
                      ${isActive ? 'border-color: var(--slds-g-color-brand-base-50, #0176d3); box-shadow: 0 0 0 1px var(--slds-g-color-brand-base-50, #0176d3);' : ''}
                    `}
                    aria-pressed={isActive}
                    title={isActive ? 'Show every status' : `Show the components that are ${STATUS_LABELS[status]}`}
                    onClick={() => handleStatusCardClick(status)}
                  >
                    <div className="slds-text-title_caps slds-text-color_weak">{STATUS_LABELS[status]}</div>
                    <Grid verticalAlign="end">
                      <span className={classNames('slds-text-heading_medium', countClassName)}>{formatNumber(count)}</span>
                      {footnote && <span className="slds-m-left_x-small slds-text-body_small slds-text-color_weak">{footnote}</span>}
                    </Grid>
                  </button>
                );
              })}
            </div>

            <div
              className="slds-box slds-box_small slds-theme_default"
              css={css`
                position: relative;
                ${resultsFullScreen ? 'position: fixed; inset: 0; z-index: 200; border-radius: 0; overflow: auto;' : ''}
              `}
            >
              <div
                css={css`
                  position: absolute;
                  top: 0.5rem;
                  right: 0.75rem;
                  z-index: 1;
                `}
              >
                <Tooltip ariaRole="label" content={resultsFullScreen ? 'Exit full screen' : 'View the results in full screen'}>
                  <button
                    type="button"
                    className="slds-button slds-button_icon slds-button_icon-border-filled"
                    aria-pressed={resultsFullScreen}
                    onClick={() => setResultsFullScreen((previous) => !previous)}
                  >
                    <Icon
                      type="utility"
                      icon={resultsFullScreen ? 'contract_alt' : 'expand_alt'}
                      className="slds-button__icon"
                      omitContainer
                      title={resultsFullScreen ? 'Exit full screen' : 'View the results in full screen'}
                    />
                  </button>
                </Tooltip>
              </div>
              <Tabs ref={tabsRef} initialActiveId="summary" tabs={tabs} />
            </div>
          </Fragment>
        )}

        {!hasResults && !progress.running && (
          <div className="slds-box slds-theme_default slds-p-around_large">
            <EmptyState
              headline="Choose two orgs to compare"
              subHeading="Jetstream finds the metadata that exists in only one org and the metadata that is different between them. Review the differences, then validate, back up and deploy your changes in either direction."
            />
          </div>
        )}
      </div>
    </Page>
  );
};

export default OrgAlignment;
