/** @jsx jsx */
import { jsx } from '@emotion/core';
import { InsertUpdateUpsertDelete, SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent } from 'react';
import { ApiMode, FieldMapping } from '../../load-records-types';
import LoadRecordsBatchApiResults from './LoadRecordsBatchApiResults';
import LoadRecordsBulkApiResults from './LoadRecordsBulkApiResults';

export interface LoadRecordsResultsProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: string;
  fieldMapping: FieldMapping;
  inputFileData: any[];
  apiMode: ApiMode;
  loadType: InsertUpdateUpsertDelete;
  externalId?: string;
  batchSize: number;
  insertNulls: boolean;
  serialMode: boolean;
  dateFormat: string;
  onFinish: (success: boolean) => void;
}

export const LoadRecordsResults: FunctionComponent<LoadRecordsResultsProps> = ({
  selectedOrg,
  selectedSObject,
  fieldMapping,
  inputFileData,
  apiMode,
  loadType,
  externalId,
  batchSize,
  insertNulls,
  serialMode,
  dateFormat,
  onFinish,
}) => {
  return (
    <div>
      {apiMode === 'BULK' && (
        <LoadRecordsBulkApiResults
          selectedOrg={selectedOrg}
          selectedSObject={selectedSObject}
          fieldMapping={fieldMapping}
          inputFileData={inputFileData}
          apiMode={apiMode}
          loadType={loadType}
          externalId={externalId}
          batchSize={batchSize}
          insertNulls={insertNulls}
          serialMode={serialMode}
          dateFormat={dateFormat}
          onFinish={onFinish}
        />
      )}
      {apiMode === 'BATCH' && (
        <LoadRecordsBatchApiResults
          selectedOrg={selectedOrg}
          selectedSObject={selectedSObject}
          fieldMapping={fieldMapping}
          inputFileData={inputFileData}
          apiMode={apiMode}
          loadType={loadType}
          externalId={externalId}
          batchSize={batchSize}
          insertNulls={insertNulls}
          serialMode={serialMode}
          dateFormat={dateFormat}
          onFinish={onFinish}
        />
      )}
    </div>
  );
};

export default LoadRecordsResults;
