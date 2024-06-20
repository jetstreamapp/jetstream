import { ApiMode, FieldMapping, InsertUpdateUpsertDelete, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { FunctionComponent } from 'react';
import LoadRecordsBatchApiResults from './LoadRecordsBatchApiResults';
import LoadRecordsBulkApiResults from './LoadRecordsBulkApiResults';

export interface LoadRecordsResultsProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: string;
  fieldMapping: FieldMapping;
  inputFileData: any[];
  inputZipFileData: Maybe<ArrayBuffer>;
  apiMode: ApiMode;
  loadType: InsertUpdateUpsertDelete;
  externalId?: string;
  batchSize: number;
  insertNulls: boolean;
  assignmentRuleId?: Maybe<string>;
  serialMode: boolean;
  dateFormat: string;
  onFinish: (results: { success: number; failure: number }) => void;
}

export const LoadRecordsResults: FunctionComponent<LoadRecordsResultsProps> = ({
  selectedOrg,
  selectedSObject,
  fieldMapping,
  inputFileData,
  inputZipFileData,
  apiMode,
  loadType,
  externalId,
  batchSize,
  insertNulls,
  assignmentRuleId,
  serialMode,
  dateFormat,
  onFinish,
}) => {
  return (
    <div className="slds-m-bottom_medium">
      {apiMode === 'BULK' && (
        <LoadRecordsBulkApiResults
          selectedOrg={selectedOrg}
          selectedSObject={selectedSObject}
          fieldMapping={fieldMapping}
          inputFileData={inputFileData}
          inputZipFileData={inputZipFileData}
          apiMode={apiMode}
          loadType={loadType}
          externalId={externalId}
          batchSize={batchSize}
          insertNulls={insertNulls}
          assignmentRuleId={assignmentRuleId}
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
          inputZipFileData={inputZipFileData}
          inputFileData={inputFileData}
          apiMode={apiMode}
          loadType={loadType}
          externalId={externalId}
          batchSize={batchSize}
          insertNulls={insertNulls}
          assignmentRuleId={assignmentRuleId}
          serialMode={serialMode}
          dateFormat={dateFormat}
          onFinish={onFinish}
        />
      )}
    </div>
  );
};

export default LoadRecordsResults;
