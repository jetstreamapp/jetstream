import { ANALYTICS_KEYS, DATE_FORMATS, TITLES } from '@jetstream/shared/constants';
import { formatNumber, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import { FieldMapping, InsertUpdateUpsertDelete, Maybe, SalesforceOrgUi, SalesforceOrgUiType } from '@jetstream/types';
import { Badge, Checkbox, ConfirmationModalPromise, Grid, Input, Radio, RadioButton, RadioGroup } from '@jetstream/ui';
import { ConfirmPageChange, fromLoadRecordsState, getMaxBatchSize, useAmplitude } from '@jetstream/ui-core';
import startCase from 'lodash/startCase';
import { ChangeEvent, FunctionComponent, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import LoadRecordsAssignmentRules from '../components/LoadRecordsAssignmentRules';
import LoadRecordsDuplicateWarning from '../components/LoadRecordsDuplicateWarning';
import LoadRecordsResults from '../components/load-results/LoadRecordsResults';

interface LoadState {
  loading: boolean;
  loadInProgress: boolean;
  loadInProgressTrialRun: boolean;
  hasLoadResultsTrialRun: boolean;
  hasLoadResults: boolean;
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
  const [loadNumber, setLoadNumber] = useState<number>(0);
  const [loadNumberTrialRun, setLoadNumberTrialRun] = useState<number>(0);

  const [apiMode, setApiMode] = useRecoilState(fromLoadRecordsState.apiModeState);
  const [batchSize, setBatchSize] = useRecoilState(fromLoadRecordsState.batchSizeState);
  const [insertNulls, setInsertNulls] = useRecoilState(fromLoadRecordsState.insertNullsState);
  const [serialMode, setSerialMode] = useRecoilState(fromLoadRecordsState.serialModeState);
  const [trialRun, setTrialRun] = useRecoilState(fromLoadRecordsState.trialRunState);
  const [trialRunSize, setTrialRunSize] = useRecoilState(fromLoadRecordsState.trialRunSizeState);
  const [dateFormat, setDateFormat] = useRecoilState(fromLoadRecordsState.dateFormatState);
  /** Only show date hint if the user has a mapped date/datetime field */
  const hasDateFieldMapped = useRecoilValue(fromLoadRecordsState.selectHasDateFieldMapped);

  const batchSizeError = useRecoilValue(fromLoadRecordsState.selectBatchSizeError);
  const batchApiLimitError = useRecoilValue(fromLoadRecordsState.selectBatchApiLimitError);
  const trialRunSizeError = useRecoilValue(fromLoadRecordsState.selectTrialRunSizeError);
  const bulkApiModeLabel = useRecoilValue(fromLoadRecordsState.selectBulkApiModeLabel);
  const batchApiModeLabel = useRecoilValue(fromLoadRecordsState.selectBatchApiModeLabel);

  const loadTypeLabel = startCase(loadType.toLowerCase());
  const [assignmentRuleId, setAssignmentRuleId] = useState<Maybe<string>>(null);
  const [
    { loading, loadInProgress, loadInProgressTrialRun, hasLoadResultsTrialRun, hasLoadResults, inputFileDataTrialRun, inputFileDataToLoad },
    setLoadState,
  ] = useState<LoadState>(() => ({
    loading: false,
    loadInProgress: false,
    loadInProgressTrialRun: false,
    hasLoadResultsTrialRun: false,
    hasLoadResults: false,
    inputFileDataTrialRun: trialRun && trialRunSize ? inputFileData.slice(0, trialRunSize) : [],
    inputFileDataToLoad: trialRun && trialRunSize ? inputFileData.slice(trialRunSize || 0) : inputFileData,
  }));

  const numRecordsImpactedLabel = formatNumber(inputFileDataToLoad.length);
  const numRecordsImpactedTrialRunLabel = formatNumber(inputFileDataTrialRun.length);

  useNonInitialEffect(() => {
    setBatchSize(getMaxBatchSize(apiMode));
    setLoadState((prevState) => ({
      ...prevState,
      hasLoadResults: false,
      hasLoadResultsTrialRun: false,
    }));
    if (apiMode === 'BATCH' && !serialMode) {
      setSerialMode(true);
    } else if (apiMode === 'BULK' && serialMode) {
      setSerialMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiMode]);

  useNonInitialEffect(() => {
    setLoadState((prevState) => ({
      ...prevState,
      hasLoadResults: false,
      hasLoadResultsTrialRun: false,
      inputFileDataTrialRun: trialRun && trialRunSize ? inputFileData.slice(0, trialRunSize) : [],
      inputFileDataToLoad: trialRun && trialRunSize ? inputFileData.slice(trialRunSize || 0) : inputFileData,
    }));
  }, [trialRun, trialRunSize, inputFileData]);

  function handleBatchSize(event: ChangeEvent<HTMLInputElement>) {
    const value = Number.parseInt(event.target.value);
    if (Number.isInteger(value)) {
      setBatchSize(value);
    } else if (!event.target.value) {
      setBatchSize(null);
    }
  }

  function handletrialRunSize(event: ChangeEvent<HTMLInputElement>) {
    const value = Number.parseInt(event.target.value);
    if (Number.isInteger(value)) {
      setTrialRunSize(value);
    } else if (!event.target.value) {
      setTrialRunSize(null);
    }
  }

  async function handleStartLoad(isTrialRun = false) {
    if (
      loadNumber === 0 ||
      (await ConfirmationModalPromise({
        content: 'This file has already been loaded, are you sure you want to load it again?',
      }))
    ) {
      if (isTrialRun) {
        setLoadNumberTrialRun(loadNumberTrialRun + 1);
      } else {
        setLoadNumber(loadNumber + 1);
      }
      setLoadState((prevState) => {
        if (isTrialRun) {
          return { ...prevState, loading: true, loadInProgressTrialRun: true, hasLoadResultsTrialRun: false, hasLoadResults: false };
        }
        return { ...prevState, loading: true, loadInProgress: true, hasLoadResults: false };
      });
      onIsLoading(true);
      trackEvent(ANALYTICS_KEYS.load_Submitted, {
        loadType,
        apiMode,
        numRecords: inputFileData.length,
        batchSize,
        insertNulls,
        serialMode,
        hasDateFieldMapped,
        dateFormat,
        isTrialRun,
        trialRunSize,
        hasZipAttachment: !!hasZipAttachment,
        timesSameDataSubmitted: loadNumber + 1,
        numStaticFields: Object.values(fieldMapping).filter(({ type }) => type === 'STATIC').length,
      });
      document.title = `Loading Records | ${TITLES.BAR_JETSTREAM}`;
    }
  }

  function handleFinishLoad({ success, failure }: { success: number; failure: number }, isTrialRun = false) {
    setLoadState((prevState) => {
      if (isTrialRun) {
        return { ...prevState, loading: false, loadInProgressTrialRun: false, hasLoadResultsTrialRun: true };
      }
      return { ...prevState, loading: false, loadInProgress: false, hasLoadResults: true };
    });
    onIsLoading(false);
    document.title = `${formatNumber(success)} Success - ${formatNumber(failure)} Failed ${TITLES.BAR_JETSTREAM}`;
  }

  function hasDataInputError(): boolean {
    return !!batchSizeError || !!batchApiLimitError || (trialRun && !!trialRunSizeError);
  }

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
            name="BULK"
            label={bulkApiModeLabel}
            value="BULK"
            checked={apiMode === 'BULK'}
            disabled={loading || !!inputZipFileData}
            onChange={setApiMode as (value: string) => void}
          />
          <Radio
            idPrefix="apiMode"
            id="apiMode-batch"
            name="BATCH"
            label={batchApiModeLabel}
            value="BATCH"
            checked={apiMode === 'BATCH'}
            disabled={loading || !!inputZipFileData}
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

        <LoadRecordsAssignmentRules
          selectedOrg={selectedOrg}
          apiMode={apiMode}
          selectedSObject={selectedSObject}
          onAssignmentRule={setAssignmentRuleId}
        />

        <Input
          label="Batch Size"
          isRequired={true}
          hasError={!!batchSizeError || !!batchApiLimitError}
          errorMessageId="batch-size-error"
          errorMessage={batchSizeError || batchApiLimitError}
          labelHelp="The batch size determines how many records will be deleted at a time. Only change this if you are experiencing issues with Salesforce governor limits."
          helpText={hasZipAttachment ? 'The batch size will be auto-calculated based on the size of the attachments.' : null}
        >
          <input
            id="batch-size"
            className="slds-input"
            placeholder="Set batch size"
            value={batchSize || ''}
            aria-describedby={'batch-size-error'}
            disabled={loading || hasZipAttachment}
            onChange={handleBatchSize}
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
                disabled={hasDataInputError() || loadInProgressTrialRun || hasLoadResultsTrialRun || loadInProgress}
                onClick={() => handleStartLoad(true)}
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
              disabled={hasDataInputError() || (trialRun && !hasLoadResultsTrialRun) || loadInProgress}
              onClick={() => handleStartLoad()}
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
        {trialRun && (loadInProgressTrialRun || hasLoadResultsTrialRun) && (
          <LoadRecordsResults
            key={`trial-run-${loadNumberTrialRun}`}
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
            serialMode={serialMode}
            dateFormat={dateFormat}
            assignmentRuleId={assignmentRuleId}
            onFinish={(results) => handleFinishLoad(results, true)}
          />
        )}
        {/* STANDARD LOAD */}
        {(loadInProgress || hasLoadResults) && (
          <LoadRecordsResults
            key={loadNumber}
            selectedOrg={selectedOrg}
            selectedSObject={selectedSObject}
            fieldMapping={fieldMapping}
            inputFileData={inputFileDataToLoad}
            inputZipFileData={inputZipFileData}
            apiMode={apiMode}
            loadType={loadType}
            externalId={externalId}
            batchSize={batchSize ?? getMaxBatchSize(apiMode)}
            insertNulls={insertNulls}
            serialMode={serialMode}
            dateFormat={dateFormat}
            assignmentRuleId={assignmentRuleId}
            onFinish={(results) => handleFinishLoad(results)}
          />
        )}
      </div>
    </div>
  );
};

export default LoadRecordsPerformLoad;
