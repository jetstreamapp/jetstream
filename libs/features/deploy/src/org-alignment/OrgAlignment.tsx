import { css } from '@emotion/react';
import { COMMON_METADATA_TYPES } from '@jetstream/connected-ui';
import { TITLES } from '@jetstream/shared/constants';
import { getLocalStore, hasLocalStore } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { formatNumber, useTitle } from '@jetstream/shared/ui-utils';
import { orderObjectsBy } from '@jetstream/shared/utils';
import {
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
  DisabledReasonButton,
  DropDown,
  EmptyState,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  RadioButton,
  RadioGroup,
  ScopedNotification,
  Tabs,
  TabsRef,
  Toast,
  Tooltip,
} from '@jetstream/ui';
import { ConfirmPageChange, ProFeaturePaywall, RequireMetadataApiBanner } from '@jetstream/ui-core';
import {
  orgAlignmentAccessState,
  salesforceOrgsById,
  salesforceOrgsState,
  selectedOrgStateWithoutPlaceholder,
  useOperationAccess,
} from '@jetstream/ui/app-state';
import { hasDexieDb, orgAlignmentDb } from '@jetstream/ui/db';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DownloadPackageWithFileSelector from '../utils/DownloadPackageWithFileSelector';
import { ALL_TYPES_FILTER, OrgAlignmentComponentsTable, STATUS_LABELS } from './OrgAlignmentComponentsTable';
import OrgAlignmentDeployModal from './OrgAlignmentDeployModal';
import OrgAlignmentDiffModal from './OrgAlignmentDiffModal';
import { OrgAlignmentExportMenu } from './OrgAlignmentExportMenu';
import { OrgAlignmentProgressBar } from './OrgAlignmentProgressBar';
import OrgAlignmentSavedComparisonsModal from './OrgAlignmentSavedComparisonsModal';
import { OrgAlignmentSetup } from './OrgAlignmentSetup';
import { OrgAlignmentStatusCards } from './OrgAlignmentStatusCards';
import { OrgAlignmentSummaryTable } from './OrgAlignmentSummaryTable';
import OrgAlignmentTypeSelectorModal from './OrgAlignmentTypeSelectorModal';
import {
  OrgAlignmentComparisonOptions,
  OrgAlignmentComponentItem,
  OrgAlignmentDeployDirection,
  OrgAlignmentDiffStatus,
} from './orgAlignmentTypes';
import {
  aggregateSummaryCounts,
  componentsToListMetadataMap,
  getDeployFromAndTo,
  isComponentDeployableInDirection,
} from './orgAlignmentUtils';
import { useOrgAlignmentCompare } from './useOrgAlignmentCompare';

/** Everything that defines a comparison run, the saved comparisons store the same values */
interface OrgAlignmentRun {
  sourceOrg: SalesforceOrgUi | null;
  targetOrg: SalesforceOrgUi | null;
  options: OrgAlignmentComparisonOptions;
  savedKey: string | null;
  /** Get the list of components from Salesforce again instead of using what Jetstream remembers */
  skipRequestCache?: boolean;
}

const LAST_OPTIONS_STORAGE_KEY = 'ORG_ALIGNMENT_LAST_OPTIONS';
const SELECTION_MODES: OrgAlignmentSelectionMode[] = ['common', 'all', 'custom'];

/** The options of the last comparison, so the page opens with the metadata types the user works with */
async function getLastUsedOptions(): Promise<OrgAlignmentComparisonOptions | null> {
  if (!hasLocalStore()) {
    return null;
  }
  try {
    const saved = await getLocalStore().getItem<Partial<OrgAlignmentComparisonOptions>>(LAST_OPTIONS_STORAGE_KEY);
    if (!saved?.selectionMode || !SELECTION_MODES.includes(saved.selectionMode) || !Array.isArray(saved.customMetadataTypes)) {
      return null;
    }
    return {
      selectionMode: saved.selectionMode,
      customMetadataTypes: saved.customMetadataTypes,
      includeManaged: Boolean(saved.includeManaged),
      normalizePermissionXml: saved.normalizePermissionXml !== false,
    };
  } catch {
    return null;
  }
}

function saveLastUsedOptions(options: OrgAlignmentComparisonOptions) {
  if (hasLocalStore()) {
    getLocalStore()
      .setItem(LAST_OPTIONS_STORAGE_KEY, options)
      .catch(() => undefined);
  }
}

/** Org Alignment is paid-only, see `orgAlignmentAccessState` */
export const OrgAlignment: FunctionComponent = () => {
  useTitle(TITLES.ORG_ALIGNMENT);
  const { hasOrgAlignmentAccess } = useAtomValue(orgAlignmentAccessState);
  if (!hasOrgAlignmentAccess) {
    return (
      <ProFeaturePaywall
        featureLabel="Org Alignment"
        docsPath={APP_ROUTES.ORG_ALIGNMENT.DOCS}
        description="Org Alignment compares the metadata of two orgs in one pass, shows what exists in only one org and what is different, and deploys the differences you choose in either direction, with a dependency check, a target backup and validation first. Comparing individual components in Deploy and Compare Metadata remains free."
      />
    );
  }
  return <OrgAlignmentPage />;
};

const OrgAlignmentPage: FunctionComponent = () => {
  const deployAccess = useOperationAccess('metadata.deploy');

  const allOrgs = useAtomValue(salesforceOrgsState);
  const orgsById = useAtomValue(salesforceOrgsById);
  const defaultSelectedOrg = useAtomValue(selectedOrgStateWithoutPlaceholder);

  // `undefined` defers to the globally selected org until the user picks Org A explicitly
  const [userSelectedSourceOrg, setUserSelectedSourceOrg] = useState<SalesforceOrgUi | null | undefined>(undefined);
  const sourceOrg = userSelectedSourceOrg === undefined ? (defaultSelectedOrg ?? null) : userSelectedSourceOrg;
  const setSourceOrg = setUserSelectedSourceOrg;
  const [targetOrg, setTargetOrg] = useState<SalesforceOrgUi | null>(null);
  const [comparisonOptions, setComparisonOptions] = useState<OrgAlignmentComparisonOptions>(() => ({
    selectionMode: 'common',
    customMetadataTypes: [...COMMON_METADATA_TYPES],
    includeManaged: false,
    normalizePermissionXml: true,
  }));
  const { normalizePermissionXml } = comparisonOptions;

  const [savedComparisons, setSavedComparisons] = useState<OrgAlignmentSavedComparison[]>([]);
  const [activeSavedKey, setActiveSavedKey] = useState<string | null>(null);

  const [typeSelectorModalOpen, setTypeSelectorModalOpen] = useState(false);
  const [savedModalMode, setSavedModalMode] = useState<'BROWSE' | 'SAVE' | null>(null);
  // Components being viewed are kept by key and read from the results, so that their status and files stay
  // current when the content is retrieved or the comparison is re-evaluated while the modal is open
  const [activeDiffKey, setActiveDiffKey] = useState<string | null>(null);
  // Set while several selected components are being viewed together
  const [diffComponentKeys, setDiffComponentKeys] = useState<string[] | null>(null);
  const [deployModal, setDeployModal] = useState<{
    components: OrgAlignmentComponentItem[];
    direction: OrgAlignmentDeployDirection;
  } | null>(null);

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

  useEffect(() => {
    let active = true;
    getLastUsedOptions().then((lastUsedOptions) => {
      if (active && lastUsedOptions) {
        setComparisonOptions(lastUsedOptions);
      }
    });
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

  const { activeDiffComponent, diffComponents } = useMemo(() => {
    if (!activeDiffKey) {
      return { activeDiffComponent: null, diffComponents: null };
    }
    const componentsByKey = new Map(allComponents.map((component) => [component.key, component]));
    return {
      activeDiffComponent: componentsByKey.get(activeDiffKey) ?? null,
      diffComponents:
        diffComponentKeys
          ?.map((key) => componentsByKey.get(key))
          .filter((component): component is OrgAlignmentComponentItem => Boolean(component)) ?? null,
    };
  }, [activeDiffKey, allComponents, diffComponentKeys]);

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
        inventory[typeResult.type] = getDeployFromAndTo(typeResult.sourceListItems, typeResult.targetListItems, direction).to;
      }
      return inventory;
    },
    [typeResults],
  );

  const canRun = Boolean(sourceOrg && targetOrg && sourceOrg.uniqueId !== targetOrg.uniqueId) && !progress.running;

  const executeComparison = useCallback(
    (run: OrgAlignmentRun = { sourceOrg, targetOrg, options: comparisonOptions, savedKey: activeSavedKey }) => {
      if (!run.sourceOrg || !run.targetOrg) {
        return;
      }
      const { savedKey } = run;
      saveLastUsedOptions(run.options);
      // Org A follows the globally selected org until it is chosen. The results belong to the org that was
      // compared, so it is pinned here and switching orgs in the header no longer changes it.
      setUserSelectedSourceOrg(run.sourceOrg);

      setSelectedComponentKeys(new Set());
      setStatusFilter('ALL');
      setTypeFilter(ALL_TYPES_FILTER);
      setComponentSearch('');
      setSetupCollapsed(true);

      runComparison({
        sourceOrg: run.sourceOrg,
        targetOrg: run.targetOrg,
        selectionMode: run.options.selectionMode,
        selectedMetadataTypes: run.options.customMetadataTypes,
        includeManaged: run.options.includeManaged,
        normalizePermissionXml: run.options.normalizePermissionXml,
        skipRequestCache: Boolean(run.skipRequestCache),
        onComplete: (summary) => {
          if (savedKey && hasDexieDb()) {
            orgAlignmentDb
              .recordRunSummary(savedKey, summary, new Date())
              .then(refreshSavedComparisons)
              .catch(() => undefined);
          }
        },
      });
    },
    [activeSavedKey, comparisonOptions, refreshSavedComparisons, runComparison, sourceOrg, targetOrg],
  );

  function handleSourceOrgChange(org: SalesforceOrgUi) {
    setSourceOrg(org);
    setActiveSavedKey(null);
    resetComparison();
  }

  function handleTargetOrgChange(org: SalesforceOrgUi) {
    setTargetOrg(org);
    setActiveSavedKey(null);
    resetComparison();
  }

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
    setComparisonOptions((previous) => ({ ...previous, normalizePermissionXml: enabled }));
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
      selectionMode: comparisonOptions.selectionMode,
      selectedMetadataTypes: comparisonOptions.selectionMode === 'custom' ? comparisonOptions.customMetadataTypes : [],
      includeManaged: comparisonOptions.includeManaged,
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
    const options: OrgAlignmentComparisonOptions = {
      selectionMode: comparison.selectionMode,
      // A saved comparison of common or all types has no list of its own, the current custom list is kept
      customMetadataTypes:
        comparison.selectedMetadataTypes.length > 0 ? comparison.selectedMetadataTypes : comparisonOptions.customMetadataTypes,
      includeManaged: comparison.includeManaged,
      normalizePermissionXml: comparison.normalizePermissionXml,
    };
    setComparisonOptions(options);
    setActiveSavedKey(comparison.key);
    setSelectedComponentKeys(new Set());
    resetComparison();

    if (autoRun && resolvedSource && resolvedTarget) {
      executeComparison({ sourceOrg: resolvedSource, targetOrg: resolvedTarget, options, savedKey: comparison.key });
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

  const handleViewComponent = useCallback(({ key }: OrgAlignmentComponentItem) => {
    setDiffComponentKeys(null);
    setActiveDiffKey(key);
  }, []);

  function handleViewSelected() {
    if (selectedViewableComponents.length === 0) {
      return;
    }
    // Same order as the tree in the modal, which groups the components by type
    const componentsToView = orderObjectsBy(selectedViewableComponents, ['typeLabel', 'fullName']);
    setDiffComponentKeys(componentsToView.length > 1 ? componentsToView.map(({ key }) => key) : null);
    setActiveDiffKey(componentsToView[0].key);
  }

  function handleCloseDiff() {
    setDiffComponentKeys(null);
    setActiveDiffKey(null);
  }

  function handleOpenDeploySelected() {
    if (!sourceOrg || !targetOrg || selectedDeployableComponents.length === 0) {
      return;
    }
    setDeployModal({ components: selectedDeployableComponents, direction: deployDirection });
  }

  function handleDeploySingleFromDiff(component: OrgAlignmentComponentItem, direction: OrgAlignmentDeployDirection) {
    handleCloseDiff();
    setDeployModal({ components: [component], direction });
  }

  const hasResults = typeResults.length > 0;
  const showSetup = !setupCollapsed || (!hasResults && !progress.running);
  const downloadPackageOrg = downloadPackageFrom ? getDeployFromAndTo(sourceOrg, targetOrg, downloadPackageFrom).from : null;
  const downloadPackage = selectedMetadataToDownload[downloadPackageFrom ?? 'A_TO_B'];
  const deployTargetOrg = getDeployFromAndTo(sourceOrg, targetOrg, deployDirection).to;
  const layoutKey = [showSetup, progress.running, progress.phase, Boolean(fatalError), resultsFullScreen].join('-');

  let filterDescription: string | null = null;
  if (statusFilter !== 'ALL' || typeFilter !== ALL_TYPES_FILTER) {
    const activeFilters = [
      statusFilter !== 'ALL' ? STATUS_LABELS[statusFilter] : null,
      typeFilter !== ALL_TYPES_FILTER ? (typeResults.find(({ type }) => type === typeFilter)?.typeLabel ?? typeFilter) : null,
    ].filter(Boolean);
    filterDescription = `${formatNumber(filteredComponents.length)} of ${formatNumber(allComponents.length)} components shown, filtered to ${activeFilters.join(' and ')}`;
  }

  const savedComparisonRerunDisabledReason = progress.running ? 'Wait for the comparison in progress to finish, or cancel it' : null;

  let deployDisabledReason = deployAccess.deniedReason;
  if (deployAccess.allowed) {
    deployDisabledReason =
      selectedComponents.length === 0
        ? 'Select the components to deploy'
        : `None of the selected components are different or missing in ${deployTargetOrg?.label ?? 'the target org'}`;
  }

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
          initialSelectedTypes={comparisonOptions.customMetadataTypes}
          onApply={(customMetadataTypes) => {
            setComparisonOptions((previous) => ({ ...previous, selectionMode: 'custom', customMetadataTypes }));
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
          activeSavedKey={activeSavedKey}
          currentSourceOrg={sourceOrg}
          currentTargetOrg={targetOrg}
          rerunDisabledReason={savedComparisonRerunDisabledReason}
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
          onSelectComponent={setActiveDiffKey}
          sourceOrg={sourceOrg}
          targetOrg={targetOrg}
          normalizePermissionXml={normalizePermissionXml}
          onNormalizePermissionXmlChange={handleNormalizeToggle}
          onLoadComponentFiles={loadComponentFilesOnDemand}
          onDeploySingle={handleDeploySingleFromDiff}
          onClose={handleCloseDiff}
        />
      )}

      {deployModal && sourceOrg && targetOrg && (
        <OrgAlignmentDeployModal
          sourceOrg={sourceOrg}
          targetOrg={targetOrg}
          direction={deployModal.direction}
          initialSelectedComponents={deployModal.components}
          allComponents={allComponents}
          destinationInventoryByType={getDestinationInventoryByType(deployModal.direction)}
          onClose={() => setDeployModal(null)}
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
              <OrgAlignmentExportMenu
                sourceOrg={sourceOrg}
                targetOrg={targetOrg}
                typeResults={typeResults}
                generatedAt={lastCompletedAt}
                normalizePermissionXml={normalizePermissionXml}
                includeManaged={comparisonOptions.includeManaged}
                disabled={!hasResults || progress.running}
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
        <OrgAlignmentSetup
          expanded={showSetup}
          sourceOrg={sourceOrg}
          targetOrg={targetOrg}
          sourceOrgOptions={sourceOrgOptions}
          targetOrgOptions={targetOrgOptions}
          options={comparisonOptions}
          canCompare={canRun}
          isRunning={progress.running}
          hasResults={hasResults}
          lastCompletedAt={lastCompletedAt}
          onExpandedChange={(expanded) => setSetupCollapsed(!expanded)}
          onSourceOrgChange={handleSourceOrgChange}
          onTargetOrgChange={handleTargetOrgChange}
          onSwapOrgs={handleSwapOrgs}
          onOptionsChange={(changes) => setComparisonOptions((previous) => ({ ...previous, ...changes }))}
          onNormalizePermissionXmlChange={handleNormalizeToggle}
          onRefreshAndCompare={() =>
            executeComparison({ sourceOrg, targetOrg, options: comparisonOptions, savedKey: activeSavedKey, skipRequestCache: true })
          }
          onChooseTypes={() => setTypeSelectorModalOpen(true)}
        />

        {fatalError && (
          <ScopedNotification theme="error" className="slds-m-bottom_small">
            Comparison failed: {fatalError}
          </ScopedNotification>
        )}

        <OrgAlignmentProgressBar progress={progress} />

        {hasResults && (
          <Fragment>
            <OrgAlignmentStatusCards
              summaryCounts={summaryCounts}
              uncomparableTypesCount={uncomparableTypesCount}
              activeStatus={statusFilter}
              onStatusClick={handleStatusCardClick}
            />

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
