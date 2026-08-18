import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { Maybe, SalesforceRecord } from '@jetstream/types';
import { CopyRecordsToClipboardButton } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent } from 'react';

export interface QueryResultsCopyToClipboardProps {
  className?: string;
  hasRecords: boolean;
  fields: Maybe<string[]>;
  records: Maybe<SalesforceRecord[]>;
  filteredRows: SalesforceRecord[];
  selectedRows: SalesforceRecord[];
  isTooling: boolean;
}

export const QueryResultsCopyToClipboard: FunctionComponent<QueryResultsCopyToClipboardProps> = ({
  className,
  hasRecords,
  fields,
  records,
  filteredRows,
  selectedRows,
  isTooling,
}) => {
  const { trackEvent } = useAmplitude();

  return (
    <CopyRecordsToClipboardButton
      className={className}
      disabled={!hasRecords}
      fields={fields}
      records={records}
      filteredRecords={filteredRows}
      selectedRecords={selectedRows}
      onCopy={({ format, whichRecords }) => trackEvent(ANALYTICS_KEYS.query_CopyToClipboard, { isTooling, whichRecords, format })}
    />
  );
};

export default QueryResultsCopyToClipboard;
