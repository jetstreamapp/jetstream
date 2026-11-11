import { Maybe, SalesforceRecord } from '@jetstream/types';
import { CopyRecordsToClipboardButton } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface QueryResultsCopyToClipboardProps {
  className?: string;
  hasRecords: boolean;
  fields: Maybe<string[]>;
  records: Maybe<SalesforceRecord[]>;
  filteredRows: SalesforceRecord[];
  selectedRows: SalesforceRecord[];
}

export const QueryResultsCopyToClipboard: FunctionComponent<QueryResultsCopyToClipboardProps> = ({
  className,
  hasRecords,
  fields,
  records,
  filteredRows,
  selectedRows,
}) => {
  return (
    <CopyRecordsToClipboardButton
      className={className}
      disabled={!hasRecords}
      fields={fields}
      records={records}
      filteredRecords={filteredRows}
      selectedRecords={selectedRows}
    />
  );
};

export default QueryResultsCopyToClipboard;
