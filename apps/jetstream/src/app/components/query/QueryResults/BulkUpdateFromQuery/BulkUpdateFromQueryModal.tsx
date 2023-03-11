import { css } from '@emotion/react';
import { describeSObject } from '@jetstream/shared/data';
import { convertDateToLocale, formatNumber, sortQueryFields, useRollbar } from '@jetstream/shared/ui-utils';
import { ListItem, Maybe, Record, SalesforceOrgUi } from '@jetstream/types';
import {
  Checkbox,
  Input,
  Modal,
  Radio,
  RadioGroup,
  RADIO_ALL_BROWSER,
  RADIO_ALL_SERVER,
  RADIO_FILTERED,
  RADIO_SELECTED,
  Section,
} from '@jetstream/ui';
import { DescribeSObjectResult } from 'jsforce';
import { isNumber } from 'lodash';
import { ChangeEvent, Fragment, FunctionComponent, useCallback, useEffect, useState } from 'react';
import { Query } from 'soql-parser-js';
import { DeployResults, TransformationOptions } from '../../../shared/mass-update-records/mass-update-records.types';
import MassUpdateRecordsObjectRow from '../../../shared/mass-update-records/MassUpdateRecordsObjectRow';
import { useDeployRecords } from '../../../shared/mass-update-records/useDeployRecords';

const MAX_BATCH_SIZE = 10000;

function checkIfValid(selectedField: string | null, transformationOptions: TransformationOptions) {
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
}

export interface BulkUpdateFromQueryModalProps {
  selectedOrg: SalesforceOrgUi;
  sobject: string;
  parsedQuery?: Query;
  records: Record[];
  filteredRecords: Record[];
  selectedRecords: Record[];
  totalRecordCount: number;
  onModalClose: () => void;
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
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [fields, setFields] = useState<ListItem[]>([]);
  const [allFields, setAllFields] = useState<ListItem[]>([]);
  const [metadata, setMetadata] = useState<DescribeSObjectResult>();
  const [transformationOptions, setTransformationOptions] = useState<TransformationOptions>({
    option: 'anotherField',
    alternateField: undefined,
    staticValue: '',
    criteria: 'all',
    whereClause: '',
  });
  const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
  const [downloadRecordsValue, setDownloadRecordsValue] = useState<string>(hasMoreRecords ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
  const [batchSize, setBatchSize] = useState<Maybe<number>>(10000);
  const [batchSizeError, setBatchSizeError] = useState<string | null>(null);
  const [serialMode, setSerialMode] = useState(false);
  const [deployResults, setDeployResults] = useState<DeployResults>({
    done: false,
    processingStartTime: convertDateToLocale(new Date()),
    processingEndTime: null,
    processingErrors: [],
    records: [],
    batchIdToIndex: {},
    status: 'Not Started',
  });

  const handleDeployResults = useCallback((sobject: string, deployResults: DeployResults, fatalError?: boolean) => {
    setDeployResults(deployResults);
    if (fatalError) {
      // TODO: figure out how to handle this or what to show etc..
      setErrorMessage('An error occurred while processing your request. Please try again.');
    }
  }, []);

  const { loadDataForProvidedRecords, pollResultsUntilDone } = useDeployRecords(selectedOrg, handleDeployResults);

  useEffect(() => {
    const hasMoreRecordsTemp = !!totalRecordCount && !!records && totalRecordCount > records.length;
    setHasMoreRecords(hasMoreRecordsTemp);
    setDownloadRecordsValue(hasMoreRecordsTemp ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER);
  }, [totalRecordCount, records]);

  useEffect(() => {
    loadMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, sobject, parsedQuery]);

  useEffect(() => {
    setIsValid(checkIfValid(selectedField, transformationOptions));
  }, [selectedField, transformationOptions]);

  useEffect(() => {
    if (!isNumber(batchSize) || batchSize <= 0 || batchSize > MAX_BATCH_SIZE) {
      setBatchSizeError(`The batch size must be between 1 and ${MAX_BATCH_SIZE}`);
    } else if (batchSizeError) {
      setBatchSizeError(null);
    }
  }, [batchSize, batchSizeError]);

  async function loadMetadata() {
    try {
      setLoading(true);
      const { data } = await describeSObject(selectedOrg, sobject);
      const allFieldMetadata = sortQueryFields(data.fields);
      setMetadata(data);
      setAllFields(
        allFieldMetadata.map((field) => ({
          id: field.name,
          value: field.name,
          label: field.label,
          secondaryLabel: field.name,
          meta: field,
        }))
      );
      setFields(
        allFieldMetadata
          .filter((field) => field.updateable)
          .map((field) => ({
            id: field.name,
            value: field.name,
            label: field.label,
            secondaryLabel: field.name,
            meta: field,
          }))
      );
    } catch (ex) {
      // TODO: handle error
    } finally {
      setLoading(false);
    }
  }

  function handleLoadRecords() {
    /**
     * 1. IF we have all records and we have all dependent fields, do not query again
     * 2. Otherwise we need to add any fields to the query and re-run it to get records we don't have yet
     * 3.
     */
  }

  function hasFilteredRecords(): boolean {
    return Array.isArray(filteredRecords) && filteredRecords.length && filteredRecords.length !== records.length ? true : false;
  }

  function hasSelectedRecords(): boolean {
    return Array.isArray(selectedRecords) && selectedRecords.length && selectedRecords.length !== records.length ? true : false;
  }

  function handleBatchSize(event: ChangeEvent<HTMLInputElement>) {
    const value = Number.parseInt(event.target.value);
    if (Number.isInteger(value)) {
      setBatchSize(value);
    } else if (!event.target.value) {
      setBatchSize(null);
    }
  }

  return (
    <Modal
      header="Update Records"
      size="lg"
      closeOnBackdropClick={false}
      closeOnEsc={false}
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onModalClose()}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" onClick={handleLoadRecords} disabled={!isValid || loading || !!batchSizeError}>
            Update Records
          </button>
        </Fragment>
      }
      overrideZIndex={1001}
      onClose={() => onModalClose()}
    >
      <div
        className="slds-is-relative"
        css={css`
          min-height: 50vh;
        `}
      >
        {/* TODO: add option for "selected records" */}
        {/* TODO: add a note about how many records are going to be updated */}

        <RadioGroup
          label="Which Records"
          labelHelp={parsedQuery?.where ? 'Only records that match your query filters will be updated' : ''}
          required
          className="slds-m-bottom_small"
        >
          {hasMoreRecords && (
            <Fragment>
              <Radio
                name="radio-download"
                label={`All records (${formatNumber(totalRecordCount || records.length)})`}
                value={RADIO_ALL_SERVER}
                checked={downloadRecordsValue === RADIO_ALL_SERVER}
                onChange={setDownloadRecordsValue}
              />
              <Radio
                name="radio-download"
                label={`First set of records (${formatNumber(records.length)})`}
                value={RADIO_ALL_BROWSER}
                checked={downloadRecordsValue === RADIO_ALL_BROWSER}
                onChange={setDownloadRecordsValue}
              />
            </Fragment>
          )}
          {!hasMoreRecords && (
            <Radio
              name="radio-download"
              label={`All records (${formatNumber(totalRecordCount || records.length)})`}
              value={RADIO_ALL_BROWSER}
              checked={downloadRecordsValue === RADIO_ALL_BROWSER}
              onChange={setDownloadRecordsValue}
            />
          )}
          {hasFilteredRecords() && (
            <Radio
              name="radio-download"
              label={`Filtered records (${formatNumber(filteredRecords?.length || 0)})`}
              value={RADIO_FILTERED}
              checked={downloadRecordsValue === RADIO_FILTERED}
              onChange={setDownloadRecordsValue}
            />
          )}
          {hasSelectedRecords() && (
            <Radio
              name="radio-download"
              label={`Selected records (${formatNumber(selectedRecords?.length || 0)})`}
              value={RADIO_SELECTED}
              checked={downloadRecordsValue === RADIO_SELECTED}
              onChange={setDownloadRecordsValue}
            />
          )}
        </RadioGroup>

        <MassUpdateRecordsObjectRow
          className={'slds-is-relative slds-item read-only'}
          sobject={sobject}
          loading={loading}
          fields={fields}
          allFields={allFields}
          selectedField={selectedField}
          transformationOptions={transformationOptions}
          onFieldChange={setSelectedField}
          onOptionsChange={(_, options) => setTransformationOptions(options)}
          filterCriteriaFn={(field) => field.value !== 'custom'}
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
            disabled={loading}
            onChange={setSerialMode}
          />
          <Input
            label="Batch Size"
            isRequired={true}
            hasError={!!batchSizeError}
            errorMessageId="batch-size-error"
            errorMessage={batchSizeError}
            labelHelp="The batch size determines the maximum number of records will be processed together."
          >
            <input
              id="batch-size"
              className="slds-input"
              placeholder="Set batch size"
              value={batchSize || ''}
              aria-describedby={batchSizeError || undefined}
              disabled={loading}
              onChange={handleBatchSize}
            />
          </Input>
        </Section>
      </div>
    </Modal>
  );
};

export default BulkUpdateFromQueryModal;
