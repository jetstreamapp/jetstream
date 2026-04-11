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
  /** Already-prepared records for retry — skips prepareData when provided */
  preparedInputData?: any[];
  onFinish: (results: { success: number; failure: number; failedRecords: any[] }) => void;
  /** Called when user selects specific records to retry from the results modal */
  onRetrySelected?: (selectedRows: any[]) => void;
  /** Called to retry all failed records from this run */
  onRetryAll?: () => void;
  /** Number of failed records available for retry — used for button label */
  failedRecordCount?: number;
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
  preparedInputData,
  onFinish,
  onRetrySelected,
  onRetryAll,
  failedRecordCount,
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
          preparedInputData={preparedInputData}
          onFinish={onFinish}
          onRetrySelected={onRetrySelected}
          onRetryAll={onRetryAll}
          failedRecordCount={failedRecordCount}
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
          preparedInputData={preparedInputData}
          onFinish={onFinish}
          onRetrySelected={onRetrySelected}
          onRetryAll={onRetryAll}
          failedRecordCount={failedRecordCount}
        />
      )}
    </div>
  );
};

export default LoadRecordsResults;
