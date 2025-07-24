import { CheckboxToggle } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { FunctionComponent } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IncludeDeletedRecordsToggleProps {
  containerClassname?: string;
}

export const IncludeDeletedRecordsToggle: FunctionComponent<IncludeDeletedRecordsToggleProps> = ({ containerClassname }) => {
  const [includeDeletedRecords, setIncludeDeletedRecords] = useAtom(fromQueryState.queryIncludeDeletedRecordsState);
  const isTooling = useAtomValue(fromQueryState.isTooling);

  return (
    <CheckboxToggle
      extraProps={{
        title:
          'Turning this on will include deleted records in the query results. You can use include the "IsDeleted" field to the query to identify which records are deleted.',
      }}
      id="include-deleted"
      containerClassname={containerClassname}
      label="Include Deleted Records"
      onText="Include deleted records"
      offText="Do not include deleted records"
      hideLabel
      checked={!isTooling && includeDeletedRecords}
      disabled={isTooling}
      onChange={setIncludeDeletedRecords}
    />
  );
};

export default IncludeDeletedRecordsToggle;
