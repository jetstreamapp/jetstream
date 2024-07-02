import { formatNumber } from '@jetstream/shared/ui-utils';
import { SalesforceRecord } from '@jetstream/types';
import { RADIO_ALL_BROWSER, RADIO_ALL_SERVER, RADIO_FILTERED, RADIO_SELECTED, Radio, RadioGroup } from '@jetstream/ui';
import { Query } from '@jetstreamapp/soql-parser-js';
import { Fragment, FunctionComponent } from 'react';

export interface BulkUpdateFromQueryRecordSelectionProps {
  disabled?: boolean;
  hasMoreRecords: boolean;
  downloadRecordsValue: string;
  parsedQuery: Query;
  records: SalesforceRecord[];
  filteredRecords: SalesforceRecord[];
  selectedRecords: SalesforceRecord[];
  totalRecordCount: number;
  onChange: (value: string) => void;
}

export const BulkUpdateFromQueryRecordSelection: FunctionComponent<BulkUpdateFromQueryRecordSelectionProps> = ({
  disabled,
  hasMoreRecords,
  downloadRecordsValue,
  parsedQuery,
  records,
  filteredRecords,
  selectedRecords,
  totalRecordCount,
  onChange,
}) => {
  function hasFilteredRecords(): boolean {
    return Array.isArray(filteredRecords) && filteredRecords.length && filteredRecords.length !== records.length ? true : false;
  }

  function hasSelectedRecords(): boolean {
    return Array.isArray(selectedRecords) && selectedRecords.length && selectedRecords.length !== records.length ? true : false;
  }

  return (
    <RadioGroup
      label="Which Base Records"
      labelHelp={
        parsedQuery?.where
          ? 'Only records that match your query filters will be considered for update. You can also apply the criteria below to filter the records further.'
          : 'If you would like to use a custom criteria, go to the Query Builder and add a filter to your query.'
      }
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
            onChange={onChange}
            disabled={disabled}
          />
          <Radio
            name="radio-download"
            label={`First set of records (${formatNumber(records.length)})`}
            value={RADIO_ALL_BROWSER}
            checked={downloadRecordsValue === RADIO_ALL_BROWSER}
            onChange={onChange}
            disabled={disabled}
          />
        </Fragment>
      )}
      {!hasMoreRecords && (
        <Radio
          name="radio-download"
          label={`All records (${formatNumber(totalRecordCount || records.length)})`}
          value={RADIO_ALL_BROWSER}
          checked={downloadRecordsValue === RADIO_ALL_BROWSER}
          onChange={onChange}
          disabled={disabled}
        />
      )}
      {hasFilteredRecords() && (
        <Radio
          name="radio-download"
          label={`Filtered records (${formatNumber(filteredRecords?.length || 0)})`}
          value={RADIO_FILTERED}
          checked={downloadRecordsValue === RADIO_FILTERED}
          onChange={onChange}
          disabled={disabled}
        />
      )}
      {hasSelectedRecords() && (
        <Radio
          name="radio-download"
          label={`Selected records (${formatNumber(selectedRecords?.length || 0)})`}
          value={RADIO_SELECTED}
          checked={downloadRecordsValue === RADIO_SELECTED}
          onChange={onChange}
          disabled={disabled}
        />
      )}
    </RadioGroup>
  );
};

export default BulkUpdateFromQueryRecordSelection;
