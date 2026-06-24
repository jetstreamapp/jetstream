import { css } from '@emotion/react';
import { clearCacheForOrg } from '@jetstream/shared/data';
import { convertDateToLocale, filterLoadSobjects, formatNumber, tracker } from '@jetstream/shared/ui-utils';
import { getRecordIdFromAttributes, pluralizeFromNumber } from '@jetstream/shared/utils';
import { ListItem, Maybe, SalesforceOrgUi, SalesforceRecord } from '@jetstream/types';
import {
  Checkbox,
  Grid,
  Input,
  Modal,
  NotSeeingRecentMetadataPopover,
  ProgressIndicator,
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
  fetchRecordsWithRequiredFields,
  MassUpdateRecordsDeploymentRow,
  MassUpdateRecordsObjectRow,
  MetadataRowConfiguration,
  useDeployRecords,
} from '@jetstream/ui-core';
import { Query } from '@jetstreamapp/soql-parser-js';
import { useAtom } from 'jotai';
import { atomWithReset, useAtomCallback, useResetAtom } from 'jotai/utils';
import isNumber from 'lodash/isNumber';
import { ChangeEvent, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { buildProposedChanges, ProposedChangesResult } from './bulk-update-preview.utils';
import BulkUpdateFromQueryRecordSelection from './BulkUpdateFromQueryRecordSelection';
import BulkUpdateProposedChangesPreview from './BulkUpdateProposedChangesPreview';

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
export const deployResultsState = atomWithReset<DeployResults>({
  done: false,
  processingStartTime: convertDateToLocale(new Date()),
  processingEndTime: null,
  processingErrors: [],
  records: [],
  batchIdToIndex: {},
  status: 'Not Started',
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
  const [deployResults, setDeployResults] = useAtom(deployResultsState);
  const [didDeploy, setDidDeploy] = useState(false);
  const resetDeployResults = useResetAtom(deployResultsState);
  const [mode, setMode] = useState<'configure' | 'preview'>('configure');
  const [recordsToLoad, setRecordsToLoad] = useState<SalesforceRecord[]>([]);
  const [proposedChanges, setProposedChanges] = useState<ProposedChangesResult | null>(null);
  // Tracks the in-flight preview fetch so it can be cancelled (modal close, Back, unmount, or Cancel button)
  const previewFetchAbortRef = useRef<AbortController | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<{ fetched: number; total: number } | null>(null);

  const impactedRecordCount = proposedChanges?.impactedRecordIds.length ?? 0;

  // this allows the pollResults to have a stable data source for updated data
  const getDeploymentResults = useAtomCallback(useCallback((get) => [{ deployResults: get(deployResultsState), sobject }], [sobject]));

  const handleDeployResults = useCallback(
    (sobject: string, deployResults: DeployResults, fatalError?: boolean) => {
      setDeployResults(deployResults);
      if (fatalError) {
        setErrorMessage('An error occurred while processing your request. Please try again.');
      }
    },
    [setDeployResults],
  );

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

  // Cancel any in-flight preview fetch when the modal unmounts
  useEffect(() => () => previewFetchAbortRef.current?.abort(), []);

  const handleCancelPreviewFetch = () => previewFetchAbortRef.current?.abort();

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
          })),
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

  const handlePreview = async () => {
    if (batchSizeError || !isValid || !selectedConfig || selectedConfig.some(({ selectedField }) => !selectedField)) {
      return;
    }

    // Abort any in-flight preview fetch so a slower prior request can't finish last and overwrite newer results with stale data
    previewFetchAbortRef.current?.abort();

    const abortController = new AbortController();
    previewFetchAbortRef.current = abortController;

    try {
      setErrorMessage(null);
      setLoading(true);
      setIsFetchingPreview(true);
      setFetchProgress(null);

      // if records need to be re-fetched from the server, ensure that we only keep records that user wants to work with
      let idsToInclude: Set<string> | undefined;
      if (downloadRecordsValue === RADIO_ALL_BROWSER && hasMoreRecords) {
        idsToInclude = new Set(records.map((record) => record.Id || getRecordIdFromAttributes(record)));
      } else if (downloadRecordsValue === RADIO_FILTERED) {
        idsToInclude = new Set(filteredRecords.map((record) => record.Id || getRecordIdFromAttributes(record)));
      } else if (downloadRecordsValue === RADIO_SELECTED) {
        idsToInclude = new Set(selectedRecords.map((record) => record.Id || getRecordIdFromAttributes(record)));
      }

      const fetchedRecords = await fetchRecordsWithRequiredFields({
        selectedOrg,
        parsedQuery,
        idsToInclude,
        configuration: selectedConfig,
        signal: abortController.signal,
        onProgress: (fetched, total) => setFetchProgress({ fetched, total }),
      });

      const changes = buildProposedChanges(fetchedRecords, selectedConfig);

      if (changes.impactedRecordIds.length === 0) {
        setErrorMessage('No records match the criteria, so there are no changes to preview.');
        return;
      }

      setRecordsToLoad(fetchedRecords);
      setProposedChanges(changes);
      setMode('preview');
    } catch (ex) {
      // User cancelled the fetch (modal close, Back, or Cancel button) - not an error
      if (abortController.signal.aborted) {
        return;
      }
      setFatalError('There was a problem loading records. Please try again.');
      tracker.error('Error previewing bulk update records', ex);
    } finally {
      if (previewFetchAbortRef.current === abortController) {
        previewFetchAbortRef.current = null;
      }
      setIsFetchingPreview(false);
      setFetchProgress(null);
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!proposedChanges || proposedChanges.impactedRecordIds.length === 0) {
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

      // Only commit the records shown in the preview (those that actually meet the criteria)
      const impactedRecordIds = new Set(proposedChanges.impactedRecordIds);
      const recordsToCommit = recordsToLoad.filter((record) => impactedRecordIds.has(record.Id || getRecordIdFromAttributes(record)));

      setLoading(true);

      await loadDataForProvidedRecords({
        records: recordsToCommit,
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
      tracker.error('Error bulk updating records', ex);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEdit = () => {
    previewFetchAbortRef.current?.abort();
    setMode('configure');
    setProposedChanges(null);
    setRecordsToLoad([]);
    setErrorMessage(null);
  };

  const handleClose = () => {
    previewFetchAbortRef.current?.abort();
    onModalClose(didDeploy);
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
      testId="bulk-update-query-results-modal"
      header="Update Records"
      tagline="Update a field from your query results to a new value."
      size="lg"
      closeOnBackdropClick={false}
      closeOnEsc={false}
      closeDisabled={deployInProgress}
      footer={
        <Grid align="spread">
          {mode === 'configure' ? (
            <NotSeeingRecentMetadataPopover
              org={selectedOrg}
              loading={refreshLoading}
              disabled={deployInProgress}
              onReload={handleRefreshMetadata}
            />
          ) : (
            <span />
          )}
          <div>
            {mode === 'preview' && !didDeploy && (
              <button className="slds-button slds-button_neutral" disabled={loading || deployInProgress} onClick={handleBackToEdit}>
                Back
              </button>
            )}
            <button className="slds-button slds-button_neutral" disabled={deployInProgress} onClick={handleClose}>
              Close
            </button>
            {mode === 'configure' && (
              <button
                className="slds-button slds-button_brand"
                onClick={handlePreview}
                disabled={!isValid || loading || !!batchSizeError || deployInProgress || !!fatalError}
              >
                Preview Proposed Changes
              </button>
            )}
            {mode === 'preview' && !didDeploy && (
              <button
                className="slds-button slds-button_brand"
                onClick={handleCommit}
                disabled={loading || deployInProgress || !!fatalError}
              >
                Update {formatNumber(impactedRecordCount)} {pluralizeFromNumber('Record', impactedRecordCount)}
              </button>
            )}
          </div>
        </Grid>
      }
      overrideZIndex={1001}
      onClose={handleClose}
    >
      <div
        className="slds-is-relative"
        css={css`
          min-height: 50vh;
        `}
      >
        {isFetchingPreview ? (
          <div
            css={css`
              position: absolute;
              inset: 0;
              z-index: 2;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 0.75rem;
              background: rgba(255, 255, 255, 0.85);
            `}
          >
            <div
              css={css`
                width: 60%;
                min-width: 300px;
              `}
            >
              <ProgressIndicator
                currentValue={fetchProgress && fetchProgress.total ? (fetchProgress.fetched / fetchProgress.total) * 100 : 0}
                isIndeterminate={!fetchProgress}
              />
            </div>
            <p className="slds-text-body_small">
              {fetchProgress
                ? `Fetching ${formatNumber(fetchProgress.fetched)} of ${formatNumber(fetchProgress.total)} ${pluralizeFromNumber(
                    'record',
                    fetchProgress.total,
                  )}`
                : 'Fetching records…'}
            </p>
            <button className="slds-button slds-button_neutral" onClick={handleCancelPreviewFetch}>
              Cancel
            </button>
          </div>
        ) : (
          loading && <Spinner />
        )}
        {(errorMessage || fatalError) && (
          <ScopedNotification theme="error" className="slds-m-around_small">
            {errorMessage || fatalError}
          </ScopedNotification>
        )}

        {mode === 'configure' && (
          <>
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
              org={selectedOrg}
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
                id="batch-size"
                label="Batch Size"
                isRequired={true}
                hasError={!!batchSizeError}
                errorMessageId="batch-size-error"
                errorMessage={batchSizeError}
                labelHelp="The batch size determines how many records will be modified at a time. Only change this if you are experiencing issues with Salesforce governor limits."
              >
                <input
                  id="batch-size"
                  className="slds-input"
                  placeholder="Set batch size"
                  value={batchSize || ''}
                  aria-describedby={batchSizeError ? 'batch-size-error' : undefined}
                  disabled={loading || deployInProgress}
                  onChange={handleBatchSize}
                />
              </Input>
            </Section>
          </>
        )}

        {mode === 'preview' && !didDeploy && proposedChanges && (
          <BulkUpdateProposedChangesPreview
            org={selectedOrg}
            sobject={sobject}
            proposedChanges={proposedChanges}
            configuration={selectedConfig}
            totalFetched={recordsToLoad.length}
          />
        )}

        {deployResults.status !== 'Not Started' && (
          <MassUpdateRecordsDeploymentRow
            selectedOrg={selectedOrg}
            sobject={sobject}
            deployResults={deployResults}
            configuration={selectedConfig}
            hasExternalWhereClause={!!parsedQuery.where}
            batchSize={batchSize ?? 10000}
            omitTransformationText
          />
        )}
      </div>
    </Modal>
  );
};

export default BulkUpdateFromQueryModal;
