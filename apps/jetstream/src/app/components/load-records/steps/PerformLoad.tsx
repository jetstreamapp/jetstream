import { ANALYTICS_KEYS, DATE_FORMATS, TITLES } from '@jetstream/shared/constants';
import { formatNumber, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import { InsertUpdateUpsertDelete, Maybe, SalesforceOrgUi, SalesforceOrgUiType } from '@jetstream/types';
import { Badge, Checkbox, ConfirmationModalPromise, Grid, Input, Radio, RadioButton, RadioGroup } from '@jetstream/ui';
import startCase from 'lodash/startCase';
import { ChangeEvent, FunctionComponent, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import ConfirmPageChange from '../../core/ConfirmPageChange';
import { useAmplitude } from '../../core/analytics';
import LoadRecordsAssignmentRules from '../components/LoadRecordsAssignmentRules';
import LoadRecordsDuplicateWarning from '../components/LoadRecordsDuplicateWarning';
import LoadRecordsResults from '../components/load-results/LoadRecordsResults';
import { FieldMapping } from '../load-records-types';
import * as loadRecordsState from '../load-records.state';
import { getMaxBatchSize } from '../utils/load-records-utils';

interface LoadState {
  loading: boolean;
  loadInProgress: boolean;
  loadInProgressDryRun: boolean;
  hasLoadResultsDryRun: boolean;
  hasLoadResults: boolean;
  inputFileDataDryRun: any[];
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
  const [loadNumberDryRun, setLoadNumberDryRun] = useState<number>(0);

  const [apiMode, setApiMode] = useRecoilState(loadRecordsState.apiModeState);
  const [batchSize, setBatchSize] = useRecoilState(loadRecordsState.batchSizeState);
  const [insertNulls, setInsertNulls] = useRecoilState(loadRecordsState.insertNullsState);
  const [serialMode, setSerialMode] = useRecoilState(loadRecordsState.serialModeState);
  const [dryRun, setDryRun] = useRecoilState(loadRecordsState.dryRunState);
  const [dryRunSize, setDryRunSize] = useRecoilState(loadRecordsState.dryRunSizeState);
  const [dateFormat, setDateFormat] = useRecoilState(loadRecordsState.dateFormatState);

  const batchSizeError = useRecoilValue(loadRecordsState.selectBatchSizeError);
  const batchApiLimitError = useRecoilValue(loadRecordsState.selectBatchApiLimitError);
  const dryRunSizeError = useRecoilValue(loadRecordsState.selectDryRunSizeError);
  const bulkApiModeLabel = useRecoilValue(loadRecordsState.selectBulkApiModeLabel);
  const batchApiModeLabel = useRecoilValue(loadRecordsState.selectBatchApiModeLabel);

  const loadTypeLabel = startCase(loadType.toLowerCase());
  const [assignmentRuleId, setAssignmentRuleId] = useState<Maybe<string>>(null);
  const [
    { loading, loadInProgress, loadInProgressDryRun, hasLoadResultsDryRun, hasLoadResults, inputFileDataDryRun, inputFileDataToLoad },
    setLoadState,
  ] = useState<LoadState>(() => ({
    loading: false,
    loadInProgress: false,
    loadInProgressDryRun: false,
    hasLoadResultsDryRun: false,
    hasLoadResults: false,
    inputFileDataDryRun: inputFileData.slice(0, dryRunSize || 0),
    inputFileDataToLoad: inputFileData.slice(dryRunSize || 0),
  }));

  const numRecordsImpactedLabel = formatNumber(inputFileDataToLoad.length);
  const numRecordsImpactedDryRunLabel = formatNumber(inputFileDataDryRun.length);

  useNonInitialEffect(() => {
    setBatchSize(getMaxBatchSize(apiMode));
    setLoadState((prevState) => ({
      ...prevState,
      hasLoadResults: false,
      hasLoadResultsDryRun: false,
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
      hasLoadResultsDryRun: false,
      inputFileDataDryRun: dryRun && dryRunSize ? inputFileData.slice(0, dryRunSize) : [],
      inputFileDataToLoad: dryRun && dryRunSize ? inputFileData.slice(dryRunSize || 0) : inputFileData,
    }));
  }, [dryRun, dryRunSize, inputFileData]);

  function handleBatchSize(event: ChangeEvent<HTMLInputElement>) {
    const value = Number.parseInt(event.target.value);
    if (Number.isInteger(value)) {
      setBatchSize(value);
    } else if (!event.target.value) {
      setBatchSize(null);
    }
  }

  function handleDryRunSize(event: ChangeEvent<HTMLInputElement>) {
    const value = Number.parseInt(event.target.value);
    if (Number.isInteger(value)) {
      setDryRunSize(value);
    } else if (!event.target.value) {
      setDryRunSize(null);
    }
  }

  async function handleStartLoad(isDryRun = false) {
    if (
      loadNumber === 0 ||
      (await ConfirmationModalPromise({
        content: 'This file has already been loaded, are you sure you want to load it again?',
      }))
    ) {
      if (isDryRun) {
        setLoadNumberDryRun(loadNumberDryRun + 1);
      } else {
        setLoadNumber(loadNumber + 1);
      }
      setLoadState((prevState) => {
        if (isDryRun) {
          return { ...prevState, loading: true, loadInProgressDryRun: true, hasLoadResultsDryRun: false, hasLoadResults: false };
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
        dateFormat,
        isDryRun,
        dryRunSize,
        hasZipAttachment: !!hasZipAttachment,
        timesSameDataSubmitted: loadNumber + 1,
        numStaticFields: Object.values(fieldMapping).filter(({ type }) => type === 'STATIC').length,
      });
      document.title = `Loading Records | ${TITLES.BAR_JETSTREAM}`;
    }
  }

  function handleFinishLoad({ success, failure }: { success: number; failure: number }, isDryRun = false) {
    setLoadState((prevState) => {
      if (isDryRun) {
        return { ...prevState, loading: false, loadInProgressDryRun: false, hasLoadResultsDryRun: true };
      }
      return { ...prevState, loading: false, loadInProgress: false, hasLoadResults: true };
    });
    onIsLoading(false);
    document.title = `${formatNumber(success)} Success - ${formatNumber(failure)} Failed ${TITLES.BAR_JETSTREAM}`;
  }

  function hasDataInputError(): boolean {
    return !!batchSizeError || !!batchApiLimitError || (dryRun && !!dryRunSizeError);
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
          label={'Insert Null Values'}
          labelHelp="Select this option to clear any mapped fields where the field is blank in your file."
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
          labelHelp="The batch size determines how many records will be processed together."
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

        <RadioGroup
          label={'Date Format Hint'}
          labelHelp="Jetstream needs to know the order of the month and day and will auto-detect the exact format."
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

        {!inputZipFileData && (
          <>
            <Checkbox
              id={'dry-run'}
              className="slds-m-vertical_xx-small"
              checked={dryRun}
              label={'Dry Run'}
              labelHelp="Test your data load by starting with a few records."
              disabled={loading}
              onChange={setDryRun}
            />

            {dryRun && (
              <Input
                label="Number of Records to load first"
                isRequired={true}
                hasError={!!dryRunSizeError}
                errorMessageId="dry-run-size-error"
                errorMessage={dryRunSizeError}
              >
                <input
                  id="dry-run-size"
                  className="slds-input"
                  value={dryRunSize || ''}
                  aria-describedby="dry-run-size-error"
                  disabled={loading}
                  onChange={handleDryRunSize}
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
          {dryRun && (
            <div className="slds-m-top_small slds-m-right_small">
              <button
                data-testid="start-load"
                className="slds-button slds-button_brand"
                disabled={hasDataInputError() || loadInProgressDryRun || hasLoadResultsDryRun || loadInProgress}
                onClick={() => handleStartLoad(true)}
              >
                {loadTypeLabel} <strong className="slds-m-horizontal_xx-small">{numRecordsImpactedDryRunLabel}</strong>{' '}
                {pluralizeIfMultiple('Record', inputFileDataDryRun)} (Dry Run)
              </button>
            </div>
          )}
          <div className="slds-m-top_small">
            <button
              data-testid="start-load"
              className="slds-button slds-button_brand"
              disabled={hasDataInputError() || (dryRun && !hasLoadResultsDryRun) || loadInProgress}
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
        {dryRun && (loadInProgressDryRun || hasLoadResultsDryRun) && (
          <LoadRecordsResults
            key={`dry-run-${loadNumberDryRun}`}
            selectedOrg={selectedOrg}
            selectedSObject={selectedSObject}
            fieldMapping={fieldMapping}
            inputFileData={inputFileDataDryRun}
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
