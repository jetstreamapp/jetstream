import { css } from '@emotion/react';
import { clearCacheForOrg } from '@jetstream/shared/data';
import { convertDateToLocale, filterLoadSobjects, formatNumber, useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj, getRecordIdFromAttributes, pluralizeFromNumber } from '@jetstream/shared/utils';
import { ListItem, Maybe, SalesforceOrgUi, SalesforceRecord } from '@jetstream/types';
import {
  Checkbox,
  Grid,
  Input,
  Modal,
  NotSeeingRecentMetadataPopover,
  RADIO_ALL_BROWSER,
  RADIO_ALL_SERVER,
  RADIO_FILTERED,
  RADIO_SELECTED,
  ScopedNotification,
  Section,
  Spinner,
  useFieldListItemsWithDrillIn,
} from '@jetstream/ui';
import {
  DEFAULT_FIELD_CONFIGURATION,
  DeployResults,
  MassUpdateRecordsDeploymentRow,
  MassUpdateRecordsObjectRow,
  MetadataRowConfiguration,
  applicationCookieState,
  fetchRecordsWithRequiredFields,
  useDeployRecords,
} from '@jetstream/ui-core';
import { Query } from '@jetstreamapp/soql-parser-js';
import isNumber from 'lodash/isNumber';
import { ChangeEvent, FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import { atom, useRecoilCallback, useRecoilState, useResetRecoilState } from 'recoil';
import BulkUpdateFromQueryRecordSelection from './BulkUpdateFromQueryRecordSelection';

const MAX_BATCH_SIZE = 10000;
const IN_PROGRESS_STATUSES = new Set<DeployResults['status']>(['In Progress - Preparing', 'In Progress - Uploading', 'In Progress']);

function checkIfValid(fieldConfig: MetadataRowConfiguration[]) {
  return fieldConfig.every(({ selectedField, transformationOptions }) => {
    if (!selectedField) {
      return false;
    }
    if (transformationOptions.option === 'anotherField' && !transformationOptions.alternateField) {
      return false;
    }
    if (transformationOptions.option === 'staticValue' && !transformationOptions.staticValue) {
      return false;
    }
    return true;
  });
}

// These are stored in state to allow stable access from a callback to poll results
export const deployResultsState = atom<DeployResults>({
  key: 'mass-update-records.deployResultsFromQueryState',
  default: {
    done: false,
    processingStartTime: convertDateToLocale(new Date()),
    processingEndTime: null,
    processingErrors: [],
    records: [],
    batchIdToIndex: {},
    status: 'Not Started',
  },
});

export interface BulkUpdateFromQueryModalProps {
  selectedOrg: SalesforceOrgUi;
  sobject: string;
  parsedQuery: Query;
  records: SalesforceRecord[];
  filteredRecords: SalesforceRecord[];
  selectedRecords: SalesforceRecord[];
  totalRecordCount: number;
  onModalClose: (didUpdate?: boolean) => void;
}

export const BulkUpdateFromQueryModal: FunctionComponent<BulkUpdateFromQueryModalProps> = ({
  selectedOrg,
  sobject,
  parsedQuery,
  records,
  filteredRecords,
  selectedRecords,
  totalRecordCount,
  onModalClose,
}) => {
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<MetadataRowConfiguration[]>([{ ...DEFAULT_FIELD_CONFIGURATION }]);
  const [fields, setFields] = useState<ListItem[]>([]);
  const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
  const [downloadRecordsValue, setDownloadRecordsValue] = useState<string>(hasMoreRecords ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
  const [batchSize, setBatchSize] = useState<Maybe<number>>(10000);
  const [batchSizeError, setBatchSizeError] = useState<string | null>(null);
  const [serialMode, setSerialMode] = useState(false);
  const [isSecondModalOpen, setIsSecondModalOpen] = useState(false);
  const [deployResults, setDeployResults] = useRecoilState(deployResultsState);
  const [didDeploy, setDidDeploy] = useState(false);
  const resetDeployResults = useResetRecoilState(deployResultsState);
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const targetedRecordCount = useMemo(() => {
    if (downloadRecordsValue === RADIO_ALL_BROWSER || downloadRecordsValue === RADIO_ALL_SERVER) {
      return totalRecordCount;
    }
    if (downloadRecordsValue === RADIO_FILTERED) {
      return filteredRecords.length;
    }
    return selectedRecords.length;
  }, [downloadRecordsValue, filteredRecords.length, selectedRecords.length, totalRecordCount]);
  // this allows the pollResults to have a stable data source for updated data
  const getDeploymentResults = useRecoilCallback(
    ({ snapshot }) =>
      () => {
        return [
          {
            deployResults: snapshot.getLoadable(deployResultsState).getValue(),
            sobject,
          },
        ];
      },
    [sobject]
  );

  const handleDeployResults = useCallback((sobject: string, deployResults: DeployResults, fatalError?: boolean) => {
    setDeployResults(deployResults);
    if (fatalError) {
      setErrorMessage('An error occurred while processing your request. Please try again.');
    }
  }, []);

  const { loadDataForProvidedRecords, pollResultsUntilDone } = useDeployRecords(selectedOrg, handleDeployResults, 'QUERY');

  const { fields: valueFields, loadChildFields, loadFields } = useFieldListItemsWithDrillIn(selectedOrg);

  useEffect(() => {
    const hasMoreRecordsTemp = !!totalRecordCount && !!records && totalRecordCount > records.length;
    setHasMoreRecords(hasMoreRecordsTemp);
    setDownloadRecordsValue(hasMoreRecordsTemp ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
  }, [totalRecordCount, records]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, sobject, parsedQuery]);

  useEffect(() => {
    setIsValid(checkIfValid(selectedConfig));
  }, [selectedConfig]);

  useEffect(() => {
    if (!isNumber(batchSize) || batchSize <= 0 || batchSize > MAX_BATCH_SIZE) {
      setBatchSizeError(`The batch size must be between 1 and ${MAX_BATCH_SIZE}`);
    } else if (batchSizeError) {
      setBatchSizeError(null);
    }
  }, [batchSize, batchSizeError]);

  async function init() {
    resetDeployResults();
    setLoading(true);
    try {
      const { describe, fields } = await loadFields(sobject);
      // Set all fields that can be updated
      setFields(
        fields
          .filter((field) => field.updateable)
          .map((field) => ({
            id: field.name,
            value: field.name,
            label: field.label,
            secondaryLabel: field.name,
            secondaryLabelOnNewLine: true,
            tertiaryLabel: field.type,
            meta: field,
          }))
      );
      if (!filterLoadSobjects(describe)) {
        setFatalError('This object does not support loading in data.');
      }
    } catch (ex) {
      setFatalError('There was a problem loading metadata for this object. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleLoadRecords = async () => {
    if (batchSizeError || !isValid || !selectedConfig || selectedConfig.some(({ selectedField }) => !selectedField)) {
      return;
    }

    try {
      setDidDeploy(true);
      setDeployResults({
        done: false,
        processingStartTime: convertDateToLocale(new Date()),
        processingEndTime: null,
        processingErrors: [],
        records: [],
        batchIdToIndex: {},
        status: 'In Progress - Preparing',
      });

      // if records need to be re-fetched from the server, ensure that we only keep records that user wants to work with
      let idsToInclude: Set<string> | undefined;
      if (downloadRecordsValue === RADIO_ALL_BROWSER && hasMoreRecords) {
        idsToInclude = new Set(records.map((record) => record.Id || getRecordIdFromAttributes(record)));
      } else if (downloadRecordsValue === RADIO_FILTERED) {
        idsToInclude = new Set(filteredRecords.map((record) => record.Id || getRecordIdFromAttributes(record)));
      } else if (downloadRecordsValue === RADIO_SELECTED) {
        idsToInclude = new Set(selectedRecords.map((record) => record.Id || getRecordIdFromAttributes(record)));
      }

      const recordsToLoad = await fetchRecordsWithRequiredFields({
        selectedOrg,
        records,
        parsedQuery,
        idsToInclude,
        configuration: selectedConfig,
      });

      setLoading(true);

      await loadDataForProvidedRecords({
        records: recordsToLoad,
        sobject,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        fields: ['Id', ...selectedConfig.map(({ selectedField }) => selectedField!).filter(Boolean)],
        batchSize: batchSize ?? 10000,
        serialMode,
        configuration: selectedConfig,
      });
      pollResultsUntilDone(getDeploymentResults);
    } catch (ex) {
      setFatalError('There was a problem loading records. Please try again.');
      rollbar.error('Error bulk updating records', getErrorMessageAndStackObj(ex));
    } finally {
      setLoading(false);
    }
  };

  function handleBatchSize(event: ChangeEvent<HTMLInputElement>) {
    const value = Number.parseInt(event.target.value);
    if (Number.isInteger(value)) {
      setBatchSize(value);
    } else if (!event.target.value) {
      setBatchSize(null);
    }
  }

  const handleRefreshMetadata = async () => {
    setRefreshLoading(true);
    await clearCacheForOrg(selectedOrg);
    setRefreshLoading(false);
    init();
  };

  const deployInProgress = IN_PROGRESS_STATUSES.has(deployResults.status);

  return (
    <Modal
      header="Update Records"
      tagline="Update a field from your query results to a new value."
      size="lg"
      closeOnBackdropClick={false}
      closeOnEsc={false}
      closeDisabled={deployInProgress}
      hide={isSecondModalOpen}
      footer={
        <Grid align="spread">
          <NotSeeingRecentMetadataPopover
            org={selectedOrg}
            loading={refreshLoading}
            serverUrl={serverUrl}
            disabled={deployInProgress}
            onReload={handleRefreshMetadata}
          />
          <div>
            <button className="slds-button slds-button_neutral" disabled={deployInProgress} onClick={() => onModalClose(didDeploy)}>
              Close
            </button>
            <button
              className="slds-button slds-button_brand"
              onClick={handleLoadRecords}
              disabled={!isValid || loading || !!batchSizeError || deployInProgress || !!fatalError}
            >
              Update {formatNumber(targetedRecordCount)} {pluralizeFromNumber('Record', targetedRecordCount)}
            </button>
          </div>
        </Grid>
      }
      overrideZIndex={1001}
      onClose={() => onModalClose(didDeploy)}
    >
      <div
        className="slds-is-relative"
        css={css`
          min-height: 50vh;
        `}
      >
        {loading && <Spinner />}
        {(errorMessage || fatalError) && (
          <ScopedNotification theme="error" className="slds-m-around_small">
            {errorMessage || fatalError}
          </ScopedNotification>
        )}

        <BulkUpdateFromQueryRecordSelection
          disabled={deployInProgress || !!fatalError}
          hasMoreRecords={hasMoreRecords}
          downloadRecordsValue={downloadRecordsValue}
          parsedQuery={parsedQuery}
          records={records}
          filteredRecords={filteredRecords}
          selectedRecords={selectedRecords}
          totalRecordCount={totalRecordCount}
          onChange={setDownloadRecordsValue}
        />

        <MassUpdateRecordsObjectRow
          className={'slds-is-relative slds-item read-only'}
          sobject={sobject}
          loading={false}
          fields={fields}
          valueFields={valueFields}
          fieldConfigurations={selectedConfig}
          hasExternalWhereClause={!!parsedQuery.where}
          disabled={loading || deployInProgress || !!fatalError}
          onFieldChange={(index, field, metadata) => {
            setSelectedConfig((prev) => {
              const newConfig = [...prev];
              let transformationOptions = newConfig[index].transformationOptions;
              if (transformationOptions.staticValue) {
                transformationOptions = { ...transformationOptions, staticValue: '' };
              }
              newConfig[index] = { selectedField: field, selectedFieldMetadata: metadata, transformationOptions };
              return newConfig;
            });
          }}
          onOptionsChange={(index, _, transformationOptions) => {
            setSelectedConfig((prev) => {
              const newConfig = [...prev];
              newConfig[index] = { ...newConfig[index], transformationOptions };
              return newConfig;
            });
          }}
          onLoadChildFields={loadChildFields}
          filterCriteriaFn={(field) => field.value !== 'custom'}
          onAddField={() => setSelectedConfig((prev) => [...prev, { ...DEFAULT_FIELD_CONFIGURATION }])}
          onRemoveField={(_, index) => setSelectedConfig((prev) => prev.toSpliced(index, 1))}
        />

        <Section id="mass-update-deploy-options" label="Advanced Options" initialExpanded={false}>
          <div className="slds-p-around_xx-small slds-text-body_small">
            You may need to adjust these options if you are experiencing governor limits.
          </div>
          <Checkbox
            id={'serial-mode'}
            checked={serialMode}
            label={'Serial Mode'}
            labelHelp="Serial mode processes the batches one-by-one instead of parallel."
            disabled={loading || deployInProgress}
            onChange={setSerialMode}
          />
          <Input
            label="Batch Size"
            isRequired={true}
            hasError={!!batchSizeError}
            errorMessageId="batch-size-error"
            errorMessage={batchSizeError}
            labelHelp="The batch size determines how many records will be deleted at a time. Only change this if you are experiencing issues with Salesforce governor limits."
          >
            <input
              id="batch-size"
              className="slds-input"
              placeholder="Set batch size"
              value={batchSize || ''}
              aria-describedby={batchSizeError || undefined}
              disabled={loading || deployInProgress}
              onChange={handleBatchSize}
            />
          </Input>
        </Section>

        {deployResults.status !== 'Not Started' && (
          <MassUpdateRecordsDeploymentRow
            selectedOrg={selectedOrg}
            sobject={sobject}
            deployResults={deployResults}
            configuration={selectedConfig}
            hasExternalWhereClause={!!parsedQuery.where}
            batchSize={batchSize ?? 10000}
            omitTransformationText
            onModalOpenChange={setIsSecondModalOpen}
          />
        )}
      </div>
    </Modal>
  );
};

export default BulkUpdateFromQueryModal;
