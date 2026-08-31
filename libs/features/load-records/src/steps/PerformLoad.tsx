import { ANALYTICS_KEYS, DATE_FORMATS, TITLES } from '@jetstream/shared/constants';
import { formatNumber, useIntegerInput, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { flattenRecord, pluralizeIfMultiple } from '@jetstream/shared/utils';
import {
  ApiMode,
  FieldMapping,
  InsertUpdateUpsertDelete,
  Maybe,
  SalesforceOrgUi,
  SalesforceOrgUiType,
  UiTabSection,
} from '@jetstream/types';
import {
  ariaDisabledButtonProps,
  Badge,
  Checkbox,
  ConfirmationModalPromise,
  Grid,
  Input,
  Radio,
  RadioButton,
  RadioGroup,
  Spinner,
  Tabs,
  TabsRef,
} from '@jetstream/ui';
import {
  ConfirmPageChange,
  fromLoadRecordsState,
  getFieldHeaderFromMapping,
  getMaxBatchSize,
  SkipDataHistoryCheckbox,
  useAmplitude,
} from '@jetstream/ui-core';
import { DataHistoryEntryHandle } from '@jetstream/ui/data-history';
import { useAtom, useAtomValue } from 'jotai';
import startCase from 'lodash/startCase';
import { ChangeEvent, FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LoadRecordsAssignmentRules from '../components/LoadRecordsAssignmentRules';
import LoadRecordsDuplicateWarning from '../components/LoadRecordsDuplicateWarning';
import LoadRecordsResults from '../components/load-results/LoadRecordsResults';
import { buildLoadRecordsHistoryConfig, LoadRecordsHistoryConfig, startLoadRecordsHistory } from '../utils/data-history-capture';

/**
 * The only Data History values that differ between an initial load, a trial run and a retry —
 * everything else comes from the load wizard via `startHistoryForRun`. Picked from the shared
 * config interface so a renamed or removed field there cannot be silently missed here.
 */
type LoadRunHistoryOptions = Pick<LoadRecordsHistoryConfig, 'numRecords' | 'hasZipAttachment' | 'isTrialRun' | 'trialRunSize' | 'retry'> & {
  /** Links a retry entry to the entry it retried */
  parentKey?: string;
};

interface LoadRun {
  id: number;
  label: string;
  isRetry: boolean;
  /** The API mode at the time this run was created — used to render the correct result component */
  apiMode: ApiMode;
  /** The batch size at the time this run was created */
  batchSize: number;
  /** For retries, this is the already-prepared record data */
  preparedInputData?: any[];
  /** For non-retry runs, this is the raw input file data */
  inputData: any[];
  /** Required when retrying prepared records that reference binary attachments */
  inputZipFileData?: Maybe<ArrayBuffer>;
  /** Data History capture handle for this run (captures nothing when disabled/opted out) */
  historyHandle: DataHistoryEntryHandle;
  result?: {
    success: number;
    failure: number;
    failedRecords: any[];
  };
}

interface LoadState {
  loading: boolean;
  /** Trial run state — kept separate from the runs model */
  loadInProgressTrialRun: boolean;
  hasLoadResultsTrialRun: boolean;
  inputFileDataTrialRun: any[];
  inputFileDataToLoad: any[];
}

export interface LoadRecordsPerformLoadProps {
  selectedOrg: SalesforceOrgUi;
  orgType: Maybe<SalesforceOrgUiType>;
  selectedSObject: string;
  loadType: InsertUpdateUpsertDelete;
  inputFileHeader: string[] | null;
  fieldMapping: FieldMapping;
  inputFileData: any[];
  inputZipFileData: Maybe<ArrayBuffer>;
  externalId?: string;
  onIsLoading: (isLoading: boolean) => void;
}

export const LoadRecordsPerformLoad: FunctionComponent<LoadRecordsPerformLoadProps> = ({
  selectedOrg,
  orgType,
  selectedSObject,
  loadType,
  inputFileHeader,
  fieldMapping,
  inputFileData,
  inputZipFileData,
  externalId,
  onIsLoading,
}) => {
  const hasZipAttachment = !!inputZipFileData;
  const { trackEvent } = useAmplitude();
  const runIdCounter = useRef(0);
  const runTabsRef = useRef<TabsRef>(null);

  const [apiMode, setApiMode] = useAtom(fromLoadRecordsState.apiModeState);
  const [batchSize, setBatchSize] = useAtom(fromLoadRecordsState.batchSizeState);
  const [insertNulls, setInsertNulls] = useAtom(fromLoadRecordsState.insertNullsState);
  const [serialMode, setSerialMode] = useAtom(fromLoadRecordsState.serialModeState);
  const [trialRun, setTrialRun] = useAtom(fromLoadRecordsState.trialRunState);
  const [trialRunSize, setTrialRunSize] = useAtom(fromLoadRecordsState.trialRunSizeState);
  const [dateFormat, setDateFormat] = useAtom(fromLoadRecordsState.dateFormatState);
  /** Only show date hint if the user has a mapped date/datetime field */
  const hasDateFieldMapped = useAtomValue(fromLoadRecordsState.selectHasDateFieldMapped);

  const batchSizeInput = useIntegerInput(batchSize, setBatchSize);

  // Data History capture — input source is snapshotted from the load wizard atoms
  const inputFilename = useAtomValue(fromLoadRecordsState.inputFilenameState);
  const inputFilenameType = useAtomValue(fromLoadRecordsState.inputFilenameTypeState);
  const inputGoogleFile = useAtomValue(fromLoadRecordsState.inputGoogleFileState);
  const [skipDataHistory, setSkipDataHistory] = useState(false);
  /**
   * The trial run currently displayed, paired with its capture handle — the same "a run owns its
   * handle" shape as the entries in `runs`, rather than a parallel piece of state that could get
   * out of step with the run it belongs to. `loadNumber` keys the results component so each trial
   * run remounts.
   */
  const [activeTrialRun, setActiveTrialRun] = useState<{ loadNumber: number; historyHandle: DataHistoryEntryHandle } | null>(null);

  const batchSizeError = useAtomValue(fromLoadRecordsState.selectBatchSizeError);
  const batchApiLimitWarning = useAtomValue(fromLoadRecordsState.selectBatchApiLimitWarning);
  const batchApiLimitError = useAtomValue(fromLoadRecordsState.selectBatchApiLimitError);
  const trialRunSizeError = useAtomValue(fromLoadRecordsState.selectTrialRunSizeError);
  const bulkApiModeLabel = useAtomValue(fromLoadRecordsState.selectBulkApiModeLabel);
  const batchApiModeLabel = useAtomValue(fromLoadRecordsState.selectBatchApiModeLabel);

  const loadTypeLabel = startCase(loadType.toLowerCase());
  const [assignmentRuleId, setAssignmentRuleId] = useState<Maybe<string>>(null);

  // Runs model: tracks all load attempts (original + retries)
  const [runs, setRuns] = useState<LoadRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const [{ loading, loadInProgressTrialRun, hasLoadResultsTrialRun, inputFileDataTrialRun, inputFileDataToLoad }, setLoadState] =
    useState<LoadState>(() => ({
      loading: false,
      loadInProgressTrialRun: false,
      hasLoadResultsTrialRun: false,
      inputFileDataTrialRun: trialRun && trialRunSize ? inputFileData.slice(0, trialRunSize) : [],
      inputFileDataToLoad: trialRun && trialRunSize ? inputFileData.slice(trialRunSize || 0) : inputFileData,
    }));

  const hasAnyRunInProgress = runs.some((run) => !run.result);
  const loadInProgress = loading || hasAnyRunInProgress;

  // Find the active run for retry purposes
  const activeRun = runs.find((run) => String(run.id) === activeRunId);
  const activeRunHasFailures = activeRun?.result && activeRun.result.failure > 0 && activeRun.result.failedRecords.length > 0;
  const canRetry = activeRunHasFailures && !hasAnyRunInProgress;

  const numRecordsImpactedLabel = formatNumber(inputFileDataToLoad.length);
  const numRecordsImpactedTrialRunLabel = formatNumber(inputFileDataTrialRun.length);

  useEffect(() => {
    // Hard delete requires the bulk api - the batch api gets disabled in this case but we need to ensure the state is correct
    if (loadType === 'HARD_DELETE') {
      setApiMode('BULK');
    }
  }, [loadType, setApiMode]);

  useNonInitialEffect(() => {
    setBatchSize(getMaxBatchSize(apiMode));
    setRuns([]);
    setActiveRunId(null);
    // Reset `loading` alongside `runs` — an in-flight run that gets orphaned here would
    // otherwise leave `loading: true` forever since its unmounted child can't call onFinish.
    setLoadState((prevState) => ({
      ...prevState,
      loading: false,
      hasLoadResultsTrialRun: false,
    }));
    onIsLoading(false);
    if (apiMode === 'BATCH' && !serialMode) {
      setSerialMode(true);
    } else if (apiMode === 'BULK' && serialMode) {
      setSerialMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiMode]);

  useNonInitialEffect(() => {
    setRuns([]);
    setActiveRunId(null);
    // Same rationale as the apiMode effect above — any in-flight run is orphaned here.
    setLoadState((prevState) => ({
      ...prevState,
      loading: false,
      hasLoadResultsTrialRun: false,
      inputFileDataTrialRun: trialRun && trialRunSize ? inputFileData.slice(0, trialRunSize) : [],
      inputFileDataToLoad: trialRun && trialRunSize ? inputFileData.slice(trialRunSize || 0) : inputFileData,
    }));
    onIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialRun, trialRunSize, inputFileData]);

  function handletrialRunSize(event: ChangeEvent<HTMLInputElement>) {
    const value = Number.parseInt(event.target.value);
    if (Number.isInteger(value)) {
      setTrialRunSize(value);
    } else if (!event.target.value) {
      setTrialRunSize(null);
    }
  }

  /**
   * Start a Data History entry for one run, supplying everything that comes from the load wizard so
   * call sites pass ONLY what actually differs between an initial load, a trial run and a retry.
   *
   * A retry entry is only meaningful next to the run it retried (that is what `parentKey` is for), so
   * the two must describe the same load the same way — with the envelope spelled out per call site,
   * the next config field added would land in one and not the other, and the divergence would only
   * show up as two history entries that no longer compare.
   *
   * Returns the run snapshot alongside the handle: it is the `load_Submitted` analytics payload too,
   * so the call site sends the SAME object rather than restating the fields.
   */
  const startHistoryForRun = useCallback(
    ({ parentKey, ...runConfig }: LoadRunHistoryOptions) => {
      const runSnapshot = buildLoadRecordsHistoryConfig({
        loadType,
        apiMode,
        batchSize,
        insertNulls,
        serialMode,
        hasDateFieldMapped,
        dateFormat,
        fieldMapping,
        timesSameDataSubmitted: runs.length + 1,
        ...runConfig,
      });
      const historyHandle = startLoadRecordsHistory({
        org: selectedOrg,
        sobject: selectedSObject,
        inputFilename,
        inputFilenameType,
        inputGoogleFileId: inputGoogleFile?.id,
        skipHistory: skipDataHistory,
        parentKey,
        config: runSnapshot,
      });
      return { historyHandle, runSnapshot };
    },
    [
      selectedOrg,
      loadType,
      apiMode,
      selectedSObject,
      inputFilename,
      inputFilenameType,
      inputGoogleFile,
      skipDataHistory,
      batchSize,
      insertNulls,
      serialMode,
      hasDateFieldMapped,
      dateFormat,
      fieldMapping,
      runs.length,
    ],
  );

  async function handleStartLoad(isTrialRun = false) {
    // Defensive guard: ignore rapid double-clicks or re-entrant calls while a load is starting or already running.
    // Button `disabled` covers most cases, but the ConfirmationModalPromise await below leaves a race window.
    if (loading || hasAnyRunInProgress || loadInProgressTrialRun) {
      return;
    }
    const isFirstLoad = runs.length === 0;
    if (
      isFirstLoad ||
      (await ConfirmationModalPromise({
        content: 'This file has already been loaded, are you sure you want to load the full file again?',
      }))
    ) {
      const inputHeader = inputFileHeader ?? (inputFileDataToLoad[0] ? Object.keys(inputFileDataToLoad[0]) : []);
      // The handle self-gates (captures nothing when disabled/opted out) and is never awaited on the
      // load's critical path — it is threaded to the results component to record results as they land.
      const { historyHandle, runSnapshot } = startHistoryForRun({
        numRecords: inputFileData.length,
        hasZipAttachment,
        isTrialRun,
        trialRunSize,
      });

      if (isTrialRun) {
        historyHandle.setSubmittedCount(inputFileDataTrialRun.length);
        historyHandle.writeInputRows(inputFileDataTrialRun, inputHeader);
        setActiveTrialRun((prevTrialRun) => ({ loadNumber: (prevTrialRun?.loadNumber ?? 0) + 1, historyHandle }));
        setLoadState((prevState) => ({
          ...prevState,
          loading: true,
          loadInProgressTrialRun: true,
          hasLoadResultsTrialRun: false,
        }));
      } else {
        historyHandle.setSubmittedCount(inputFileDataToLoad.length);
        historyHandle.writeInputRows(inputFileDataToLoad, inputHeader);
        const newRunId = ++runIdCounter.current;
        // Label counts only non-retry runs so "Run N" reflects how many times the full file
        // has been submitted, independent of any intermediate retries.
        const runCount = runs.filter((run) => !run.isRetry).length + 1;
        const newRun: LoadRun = {
          id: newRunId,
          label: `Run ${runCount}`,
          isRetry: false,
          apiMode,
          batchSize: batchSize ?? getMaxBatchSize(apiMode),
          inputData: inputFileDataToLoad,
          inputZipFileData,
          historyHandle,
        };
        setRuns((prev) => [...prev, newRun]);
        setActiveRunId(String(newRunId));
        setLoadState((prevState) => ({ ...prevState, loading: true }));
      }
      onIsLoading(true);
      trackEvent(ANALYTICS_KEYS.load_Submitted, runSnapshot);
      document.title = `Loading Records | ${TITLES.BAR_JETSTREAM}`;
    }
  }

  const handleFinishLoad = useCallback(
    (results: { success: number; failure: number; failedRecords: any[] }, runId: number) => {
      setRuns((prev) => prev.map((run) => (run.id === runId ? { ...run, result: results } : run)));
      setLoadState((prevState) => ({ ...prevState, loading: false }));
      onIsLoading(false);
      document.title = `${formatNumber(results.success)} Success - ${formatNumber(results.failure)} Failed ${TITLES.BAR_JETSTREAM}`;
    },
    [onIsLoading],
  );

  function handleFinishTrialRun({ success, failure }: { success: number; failure: number; failedRecords: any[] }) {
    setLoadState((prevState) => ({
      ...prevState,
      loading: false,
      loadInProgressTrialRun: false,
      hasLoadResultsTrialRun: true,
    }));
    onIsLoading(false);
    document.title = `${formatNumber(success)} Success - ${formatNumber(failure)} Failed ${TITLES.BAR_JETSTREAM}`;
  }

  const handleRetryFailedRecords = useCallback(
    // When `selectedRecords` is omitted, this is a "retry all" from the run footer button;
    // when provided, it's a "retry selected" from the failures view modal.
    (selectedRecords?: any[]) => {
      // Defensive guard: prevent concurrent retries even if the UI fails to gate the callback
      if (runs.some((run) => !run.result)) {
        return;
      }

      const retrySource: 'all' | 'selected' = selectedRecords ? 'selected' : 'all';
      const totalFailedCount = activeRun?.result?.failedRecords?.length ?? 0;
      const recordsToRetry = selectedRecords ?? activeRun?.result?.failedRecords;
      if (!recordsToRetry || recordsToRetry.length === 0) {
        return;
      }

      const retryCount = runs.filter((run) => run.isRetry).length + 1;
      const newRunId = ++runIdCounter.current;

      // A retry is captured as a NEW history entry linked to the original run via parentKey
      const { historyHandle, runSnapshot } = startHistoryForRun({
        numRecords: recordsToRetry.length,
        hasZipAttachment: !!(activeRun?.inputZipFileData ?? inputZipFileData),
        retry: { retryCount, retrySource, totalFailedCount },
        parentKey: activeRun?.historyHandle?.key,
      });
      // Retry records are PREPARED records (Batch API prepares nested objects for external-Id lookups),
      // so flatten against the mapped headers — CSV serialization does flat key lookup only.
      const retryInputFields = getFieldHeaderFromMapping(fieldMapping);
      historyHandle.setSubmittedCount(recordsToRetry.length);
      historyHandle.writeInputRows(
        recordsToRetry.map((record) => flattenRecord(record, retryInputFields)),
        retryInputFields,
      );

      const newRun: LoadRun = {
        id: newRunId,
        label: `Retry ${retryCount}`,
        isRetry: true,
        apiMode,
        batchSize: batchSize ?? getMaxBatchSize(apiMode),
        preparedInputData: recordsToRetry,
        inputData: recordsToRetry,
        inputZipFileData: activeRun?.inputZipFileData ?? inputZipFileData,
        historyHandle,
      };
      setRuns((prev) => [...prev, newRun]);
      setActiveRunId(String(newRunId));
      setLoadState((prevState) => ({ ...prevState, loading: true }));
      onIsLoading(true);
      trackEvent(ANALYTICS_KEYS.load_Submitted, runSnapshot);
      document.title = `Loading Records | ${TITLES.BAR_JETSTREAM}`;
      // The retry button the user activated unmounts with the old results view, which would drop
      // focus to <body> — land on the new run's tab instead, once it has mounted
      window.setTimeout(() => {
        runTabsRef.current?.focusTab(String(newRunId));
      });
    },
    [activeRun, runs, onIsLoading, trackEvent, apiMode, batchSize, fieldMapping, inputZipFileData, startHistoryForRun],
  );

  function hasDataInputError(): boolean {
    return !!batchSizeError || !!batchApiLimitError || (trialRun && !!trialRunSizeError);
  }

  // Build tab sections — each tab owns its own LoadRecordsResults panel. The Tabs component is
  // rendered with `renderAllContent` so every panel stays mounted across tab changes, preserving
  // per-run state (processed records, polling timers, etc.).
  const runTabs: UiTabSection[] = useMemo(() => {
    return runs.map((run) => {
      const isActiveRun = String(run.id) === activeRunId;
      const loading = !run.result;
      return {
        id: String(run.id),
        title: (
          <span className="slds-is-relative">
            {run.label}
            {run.result && (
              <span className="slds-text-color_weak">
                — {formatNumber(run.result.success)} success, {formatNumber(run.result.failure)} failed
              </span>
            )}
            {loading && <Spinner size="small" />}
          </span>
        ),
        titleText: run.label,
        content: (
          <LoadRecordsResults
            selectedOrg={selectedOrg}
            selectedSObject={selectedSObject}
            fieldMapping={fieldMapping}
            inputFileData={run.inputData}
            inputZipFileData={run.inputZipFileData ?? null}
            apiMode={run.apiMode}
            loadType={loadType}
            externalId={externalId}
            batchSize={run.batchSize}
            insertNulls={insertNulls}
            assignmentRuleId={assignmentRuleId}
            serialMode={serialMode}
            dateFormat={dateFormat}
            preparedInputData={run.preparedInputData}
            historyHandle={run.historyHandle}
            onFinish={(results) => handleFinishLoad(results, run.id)}
            onRetrySelected={canRetry && isActiveRun ? handleRetryFailedRecords : undefined}
            onRetryAll={canRetry && isActiveRun ? () => handleRetryFailedRecords() : undefined}
            failedRecordCount={run.result?.failedRecords.length ?? 0}
          />
        ),
      };
    });
  }, [
    runs,
    activeRunId,
    canRetry,
    selectedOrg,
    selectedSObject,
    fieldMapping,
    loadType,
    externalId,
    insertNulls,
    assignmentRuleId,
    serialMode,
    dateFormat,
    handleFinishLoad,
    handleRetryFailedRecords,
  ]);

  // Disabled conditions for the start buttons, applied via ariaDisabledButtonProps so the
  // aria-disabled attribute and the click guard can never drift apart
  const startTrialRunDisabled = hasDataInputError() || loadInProgressTrialRun || hasLoadResultsTrialRun || loadInProgress;
  const startLoadDisabled = hasDataInputError() || (trialRun && !hasLoadResultsTrialRun) || loadInProgress;

  return (
    <div>
      <ConfirmPageChange actionInProgress={loadInProgress} />
      <LoadRecordsDuplicateWarning
        className="slds-m-vertical_x-small"
        inputFileHeader={inputFileHeader}
        fieldMapping={fieldMapping}
        inputFileData={inputFileData}
        loadType={loadType}
        externalId={externalId}
      />
      <h1 className="slds-text-heading_medium">Options</h1>
      <div className="slds-p-around_small">
        <RadioGroup
          className="slds-m-bottom_xx-small"
          idPrefix="apiMode"
          label="Api Mode"
          required
          labelHelp="The Bulk API is optimized for loading in large datasets and you can view the progress within Salesforce. The Batch API will load records in sets of up to 200 at a time and cannot be used with large datasets."
        >
          <Radio
            idPrefix="apiMode"
            id="apiMode-bulk"
            name="api-mode"
            label={bulkApiModeLabel}
            value="BULK"
            checked={apiMode === 'BULK'}
            disabled={loading || !!inputZipFileData || loadType === 'HARD_DELETE'}
            onChange={setApiMode as (value: string) => void}
          />
          <Radio
            idPrefix="apiMode"
            id="apiMode-batch"
            name="api-mode"
            label={batchApiModeLabel}
            value="BATCH"
            checked={apiMode === 'BATCH'}
            disabled={loading || !!inputZipFileData || loadType === 'HARD_DELETE'}
            onChange={setApiMode as (value: string) => void}
          />
        </RadioGroup>
        <Checkbox
          id={'insert-null-values'}
          checked={insertNulls}
          label={'Clear Fields with Blank Values'}
          labelHelp="Select this option to clear any mapped fields where the field is blank in your file. Checkbox fields do not allow null values, make sure any checkbox fields mapped in your file are not blank."
          disabled={loading}
          onChange={setInsertNulls}
        />

        <Checkbox
          id={'serial-mode'}
          checked={serialMode}
          label={'Serial Mode'}
          labelHelp="Serial mode processes the batches one-by-one instead of parallel. The Batch API always processes data in serial mode."
          disabled={loading || apiMode !== 'BULK'}
          onChange={setSerialMode}
        />

        <LoadRecordsAssignmentRules selectedOrg={selectedOrg} selectedSObject={selectedSObject} onAssignmentRule={setAssignmentRuleId} />

        <Input
          id="batch-size"
          label="Batch Size"
          isRequired
          hasError={!!batchSizeError || !!batchApiLimitError || !!batchApiLimitWarning}
          errorMessageId="batch-size-error"
          errorMessage={batchSizeError || batchApiLimitError || batchApiLimitWarning}
          labelHelp="The batch size determines how many records will be modified at a time. Only change this if you are experiencing issues with Salesforce governor limits."
          helpText={hasZipAttachment ? 'The batch size will be auto-calculated based on the size of the attachments.' : null}
        >
          <input
            id="batch-size"
            className="slds-input"
            placeholder="Set batch size"
            value={batchSizeInput.inputValue}
            aria-describedby={'batch-size-error'}
            disabled={loading || hasZipAttachment}
            onChange={batchSizeInput.handleChange}
            onBlur={batchSizeInput.handleBlur}
          />
        </Input>

        {hasDateFieldMapped && (
          <RadioGroup
            label={'Date Format Hint'}
            labelHelp="Jetstream can usually auto-detect your date format but may require a hint if your file has dates formatted based on your geographic region."
            required
            isButtonGroup
          >
            <RadioButton
              id={'date-format-MM_DD_YYYY'}
              name={'date-format'}
              label={DATE_FORMATS.MM_DD_YYYY}
              value={DATE_FORMATS.MM_DD_YYYY}
              checked={dateFormat === DATE_FORMATS.MM_DD_YYYY}
              disabled={loading}
              onChange={setDateFormat}
            />
            <RadioButton
              id={'date-format-DD_MM_YYYY'}
              name={'date-format'}
              label={DATE_FORMATS.DD_MM_YYYY}
              value={DATE_FORMATS.DD_MM_YYYY}
              checked={dateFormat === DATE_FORMATS.DD_MM_YYYY}
              disabled={loading}
              onChange={setDateFormat}
            />
            <RadioButton
              id={'date-format-YYYY_MM_DD'}
              name={'date-format'}
              label={DATE_FORMATS.YYYY_MM_DD}
              value={DATE_FORMATS.YYYY_MM_DD}
              checked={dateFormat === DATE_FORMATS.YYYY_MM_DD}
              disabled={loading}
              onChange={setDateFormat}
            />
          </RadioGroup>
        )}

        {!inputZipFileData && (
          <>
            <Checkbox
              id={'trial-run'}
              className="slds-m-vertical_xx-small"
              checked={trialRun}
              label={'Trial Run'}
              labelHelp="Test your data load by starting with a few records."
              disabled={loading}
              onChange={setTrialRun}
            />

            {trialRun && (
              <Input
                id="trial-run-size"
                label="Number of Records to load first"
                isRequired={true}
                hasError={!!trialRunSizeError}
                errorMessageId="trial-run-size-error"
                errorMessage={trialRunSizeError}
              >
                <input
                  id="trial-run-size"
                  className="slds-input"
                  value={trialRunSize || ''}
                  aria-describedby="trial-run-size-error"
                  disabled={loading}
                  onChange={handletrialRunSize}
                />
              </Input>
            )}
          </>
        )}

        <SkipDataHistoryCheckbox
          operation="load"
          className="slds-m-vertical_xx-small"
          checked={skipDataHistory}
          disabled={loading}
          onChange={setSkipDataHistory}
        />
      </div>
      <h1 className="slds-text-heading_medium">Summary</h1>
      <div className="slds-p-around_small">
        <div>
          <Badge type={orgType === 'Production' ? 'warning' : 'light'} title={orgType || undefined}>
            {orgType}
          </Badge>
          <strong className="slds-m-left_xx-small">{selectedOrg.username}</strong>
        </div>
        <Grid>
          {trialRun && (
            <div className="slds-m-top_small slds-m-right_small">
              <button
                data-testid="start-load"
                className="slds-button slds-button_brand"
                {...ariaDisabledButtonProps(startTrialRunDisabled, () => handleStartLoad(true))}
              >
                {loadTypeLabel} <strong className="slds-m-horizontal_xx-small">{numRecordsImpactedTrialRunLabel}</strong>{' '}
                {pluralizeIfMultiple('Record', inputFileDataTrialRun)} (Dry Run)
              </button>
            </div>
          )}
          <div className="slds-m-top_small">
            <button
              data-testid="start-load"
              className="slds-button slds-button_brand"
              {...ariaDisabledButtonProps(startLoadDisabled, () => handleStartLoad())}
            >
              {loadTypeLabel} <strong className="slds-m-horizontal_xx-small">{numRecordsImpactedLabel}</strong>{' '}
              {pluralizeIfMultiple('Record', inputFileDataToLoad)}
            </button>
          </div>
        </Grid>
      </div>
      <h1 className="slds-text-heading_medium">Results</h1>
      <div className="slds-p-around_small">
        {/* DRY RUN LOAD */}
        {trialRun && activeTrialRun && (loadInProgressTrialRun || hasLoadResultsTrialRun) && (
          <div className="slds-m-bottom_medium">
            <h2 className="slds-text-heading_small slds-m-bottom_x-small">Trial Run</h2>
            <LoadRecordsResults
              key={`trial-run-${activeTrialRun.loadNumber}`}
              selectedOrg={selectedOrg}
              selectedSObject={selectedSObject}
              fieldMapping={fieldMapping}
              inputFileData={inputFileDataTrialRun}
              inputZipFileData={inputZipFileData}
              apiMode={apiMode}
              loadType={loadType}
              externalId={externalId}
              batchSize={batchSize ?? getMaxBatchSize(apiMode)}
              insertNulls={insertNulls}
              assignmentRuleId={assignmentRuleId}
              serialMode={serialMode}
              dateFormat={dateFormat}
              historyHandle={activeTrialRun.historyHandle}
              onFinish={(results) => handleFinishTrialRun(results)}
            />
          </div>
        )}
        {/* STANDARD LOAD + RETRIES */}
        {runTabs.length > 0 && (
          <div style={{ maxWidth: '100%', minWidth: 0 }}>
            <Tabs
              ref={runTabsRef}
              tabs={runTabs}
              initialActiveId={activeRunId ?? undefined}
              onChange={setActiveRunId}
              renderAllContent
              truncateLabels={false}
              style={{ maxWidth: '100%', minWidth: 0 }}
              // Hide the tab nav when there's only one run; a single-tab header adds UI noise
              // without value. The tabs themselves stay rendered so React preserves panel state
              // when a retry adds a second tab.
              ulStyle={{
                display: runTabs.length > 1 ? 'flex' : 'none',
                overflowX: 'auto',
                overflowY: 'hidden',
                flexWrap: 'nowrap',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadRecordsPerformLoad;
