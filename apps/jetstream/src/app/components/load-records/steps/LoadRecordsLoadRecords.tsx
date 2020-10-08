/** @jsx jsx */
import { jsx } from '@emotion/core';
import startCase from 'lodash/startCase';
import { ChangeEvent, FunctionComponent, useEffect, useState } from 'react';
import { InsertUpdateUpsertDelete, SalesforceOrgUi } from '@jetstream/types';
import { ApiMode, FieldMapping } from '../load-records-types';
import { Checkbox, Grid, GridCol, Input, Radio, RadioButton, RadioGroup, Select } from '@jetstream/ui';
import { isNumber } from 'lodash';
import { DATE_FORMATS } from '@jetstream/shared/constants';

const MAX_BULK = 10000;
const MAX_BATCH = 200;

function getMaxBatchSize(apiMode: ApiMode) {
  if (apiMode === 'BATCH') {
    return MAX_BATCH;
  } else {
    return MAX_BULK;
  }
}

export interface LoadRecordsLoadRecordsProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: string;
  loadType: InsertUpdateUpsertDelete;
  fieldMapping: FieldMapping;
  inputFileData: any[];
}

export const LoadRecordsLoadRecords: FunctionComponent<LoadRecordsLoadRecordsProps> = ({
  selectedOrg,
  selectedSObject,
  loadType,
  fieldMapping,
  inputFileData,
}) => {
  const [apiMode, setApiMode] = useState<ApiMode>('BULK');
  const [batchSize, setBatchSize] = useState<number>(MAX_BULK);
  const [batchSizeError, setBatchSizeError] = useState<string>(null);
  const [insertNulls, setInsertNulls] = useState<boolean>(false);
  const [serialMode, setSerialMode] = useState<boolean>(false);
  const [dateFormat, setDateFormat] = useState<string>(DATE_FORMATS.MM_DD_YYYY);

  useEffect(() => {
    setBatchSize(getMaxBatchSize(apiMode));
    if (apiMode === 'BATCH' && !serialMode) {
      setSerialMode(true);
    } else if (apiMode === 'BULK' && serialMode) {
      setSerialMode(false);
    }
  }, [apiMode]);

  useEffect(() => {
    if (!isNumber(batchSize) || batchSize <= 0 || batchSize > getMaxBatchSize(apiMode)) {
      setBatchSizeError(`The batch size must be between 1 and ${getMaxBatchSize(apiMode)}`);
    } else if (batchSizeError) {
      setBatchSizeError(null);
    }
  }, [batchSize, apiMode, batchSizeError]);

  function handleBatchSize(event: ChangeEvent<HTMLInputElement>) {
    const value = Number.parseInt(event.target.value);
    if (Number.isInteger(value)) {
      setBatchSize(value);
    }
  }

  function handleDateFormatChange(event: ChangeEvent<HTMLSelectElement>) {
    setDateFormat(event.target.value);
  }

  return (
    <div>
      <h1 className="slds-text-heading_medium">Summary</h1>
      <div className="slds-p-around_small">
        <span>{startCase(loadType.toLowerCase())}</span> <strong>{inputFileData.length}</strong> records to{' '}
        <strong>{selectedOrg.username}</strong> ({selectedOrg.orgIsSandbox ? 'Sandbox' : 'Production'}).
      </div>
      <h1 className="slds-text-heading_medium">Options</h1>
      <div className="slds-p-around_small">
        <RadioGroup label="Api Mode" required>
          <Radio
            name="BATCH"
            label="Batch API"
            value="BATCH"
            checked={apiMode === 'BATCH'}
            onChange={setApiMode as (value: string) => void}
          />
          <Radio name="BULK" label="Bulk API" value="BULK" checked={apiMode === 'BULK'} onChange={setApiMode as (value: string) => void} />
        </RadioGroup>
        <Checkbox
          id={'insert-null-values'}
          checked={insertNulls}
          label={'Insert Null Values'}
          labelHelp="Select this option to insert mapped empty values as null values."
          onChange={setInsertNulls}
        />

        <Checkbox
          id={'serial-mode'}
          checked={serialMode}
          label={'Serial Mode'}
          labelHelp="Serial mode processes the batches one-by-one instead of parallel. The Batch API always processes in serial mode."
          disabled={apiMode !== 'BULK'}
          onChange={setSerialMode}
        />

        <Input
          label="Batch Size"
          isRequired={true}
          hasError={!!batchSizeError}
          errorMessageId="batch-size-error"
          errorMessage={batchSizeError}
          labelHelp="The batch size determines how many records will be processed together."
        >
          <input
            id="batch-size"
            className="slds-input"
            placeholder="Set batch size"
            value={batchSize}
            aria-describedby={batchSizeError}
            onChange={handleBatchSize}
          />
        </Input>

        <Select
          id={'date-format'}
          label={'Date Format'}
          labelHelp="Specify the format of any date fields in your file. Jetstream just needs to know the order of the month and the day and will auto-detect the exact format."
        >
          <select
            aria-describedby="date-format"
            className="slds-select"
            id="date-format-select"
            required
            value={dateFormat}
            onChange={handleDateFormatChange}
          >
            <option value={DATE_FORMATS.MM_DD_YYYY}>{DATE_FORMATS.MM_DD_YYYY}</option>
            <option value={DATE_FORMATS.DD_MM_YYYY}>{DATE_FORMATS.DD_MM_YYYY}</option>
            <option value={DATE_FORMATS.YYYY_MM_DD}>{DATE_FORMATS.YYYY_MM_DD}</option>
          </select>
        </Select>
      </div>
      <h1 className="slds-text-heading_medium">Results</h1>
      <div className="slds-p-around_small">Results will go here</div>
    </div>
  );
};

export default LoadRecordsLoadRecords;
