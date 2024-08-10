import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { bulkApiGetRecords } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { decodeHtmlEntity, pluralizeFromNumber } from '@jetstream/shared/utils';
import { BulkJobBatchInfo, BulkJobResultRecord, DownloadAction, DownloadType, SalesforceOrgUi } from '@jetstream/types';
import { Card, FileDownloadModal, Grid, SalesforceLogin, ScopedNotification, Spinner, SupportLink } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useAmplitude } from '../analytics';
import ConfirmPageChange from '../app/ConfirmPageChange';
import { fromJetstreamEvents } from '../jetstream-events';
import LoadRecordsBulkApiResultsTable from '../load-records-results/LoadRecordsBulkApiResultsTable';
import LoadRecordsResultsModal from '../load/LoadRecordsResultsModal';
import { applicationCookieState, selectSkipFrontdoorAuth } from '../state-management/app-state';
import MassUpdateRecordTransformationText from './MassUpdateRecordTransformationText';
import { MetadataRow } from './mass-update-records.types';
import { getFieldsToQuery } from './mass-update-records.utils';

export interface DownloadModalData {
  open: boolean;
  data: any[];
  header: string[];
  fileNameParts: string[];
}

export interface ViewModalData extends Omit<DownloadModalData, 'fileNameParts'> {
  type: DownloadType;
}

export type MassUpdateRecordsDeploymentRowProps = {
  hasExternalWhereClause?: boolean;
  validationResults?: MetadataRow['validationResults'];
  selectedOrg: SalesforceOrgUi;
  batchSize: number;
  omitTransformationText?: boolean;
  onModalOpenChange?: (isOpen: boolean) => void;
} & Pick<MetadataRow, 'sobject' | 'deployResults' | 'configuration'>;

export const MassUpdateRecordsDeploymentRow: FunctionComponent<MassUpdateRecordsDeploymentRowProps> = ({
  selectedOrg,
  sobject,
  deployResults,
  configuration,
  hasExternalWhereClause,
  validationResults,
  batchSize,
  omitTransformationText,
  onModalOpenChange,
}) => {
  const { trackEvent } = useAmplitude();
  const [downloadModalData, setDownloadModalData] = useState<DownloadModalData>({ open: false, data: [], header: [], fileNameParts: [] });
  const [resultsModalData, setResultsModalData] = useState<ViewModalData>({ open: false, data: [], header: [], type: 'results' });
  const { serverUrl, google_apiKey, google_appId, google_clientId } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);

  const { done, processingErrors, status, jobInfo, processingEndTime, processingStartTime } = deployResults;

  useEffect(() => {
    onModalOpenChange && onModalOpenChange(downloadModalData.open || resultsModalData.open);
  }, [downloadModalData.open, onModalOpenChange, resultsModalData.open]);

  async function handleDownloadOrViewRecords(
    action: DownloadAction,
    type: DownloadType,
    batch: BulkJobBatchInfo,
    batchIndex: number
  ): Promise<void> {
    try {
      if (!jobInfo?.id) {
        return;
      }
      const data = await bulkApiGetRecords<BulkJobResultRecord>(selectedOrg, jobInfo.id, batch.id, 'result');

      const startIdx = deployResults.batchIdToIndex[batch.id] * batchSize;

      const records: any[] = deployResults.records.slice(startIdx, startIdx + batchSize);
      const combinedResults: any[] = [];

      data.forEach((resultRecord, i) => {
        // show all if results, otherwise just include errors
        if (type === 'results' || !resultRecord.Success) {
          combinedResults.push({
            _id: resultRecord.Id || records[i].Id || null,
            _success: resultRecord.Success,
            _errors: decodeHtmlEntity(resultRecord.Error),
            ...records[i],
          });
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const header = ['_id', '_success', '_errors'].concat(['Id', ...configuration.map(({ selectedField }) => selectedField!)]);

      if (action === 'view') {
        setResultsModalData({ ...downloadModalData, open: true, header, data: combinedResults, type });
        trackEvent(ANALYTICS_KEYS.mass_update_DownloadRecords, {
          type,
          numRows: data.length,
          transformationOptions: configuration.map(({ transformationOptions }) => transformationOptions.option),
        });
      } else {
        setDownloadModalData({
          ...downloadModalData,
          open: true,
          fileNameParts: ['mass-load'.toLocaleLowerCase(), sobject.toLocaleLowerCase(), type],
          header,
          data: combinedResults,
        });
        trackEvent(ANALYTICS_KEYS.mass_update_ViewRecords, {
          type,
          numRows: data.length,
          transformationOptions: configuration.map(({ transformationOptions }) => transformationOptions.option),
        });
      }
    } catch (ex) {
      logger.warn(ex);
    }
  }

  function handleDownloadProcessingErrors() {
    const header = ['_id', '_success', '_errors'].concat(getFieldsToQuery(configuration));
    setDownloadModalData({
      ...downloadModalData,
      open: true,
      fileNameParts: ['mass-load'.toLocaleLowerCase(), sobject.toLocaleLowerCase(), 'processing-failures'],
      header,
      data: deployResults.processingErrors.map((error) => ({
        _id: null,
        _success: false,
        _errors: error.errors.join('\n'),
        ...error.record,
      })),
    });
  }

  function handleDownloadRecordsFromModal(type: 'results' | 'failures', data: any[]) {
    const header = ['_id', '_success', '_errors'].concat(getFieldsToQuery(configuration));
    setResultsModalData({ ...resultsModalData, open: false });
    setDownloadModalData({
      open: true,
      data,
      header,
      fileNameParts: ['mass-load'.toLocaleLowerCase(), sobject.toLocaleLowerCase(), type],
    });
    trackEvent(ANALYTICS_KEYS.mass_update_DownloadRecords, {
      type,
      numRows: data.length,
      location: 'fromViewModal',
      transformationOptions: configuration.map(({ transformationOptions }) => transformationOptions.option),
    });
  }

  function handleModalClose() {
    setDownloadModalData({ ...downloadModalData, open: false, fileNameParts: [] });
  }

  function handleViewModalClose() {
    setResultsModalData({ open: false, data: [], header: [], type: 'results' });
  }

  return (
    <Fragment>
      <ConfirmPageChange actionInProgress={status?.includes('In Progress')} />
      {downloadModalData.open && (
        <FileDownloadModal
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          data={downloadModalData.data}
          header={downloadModalData.header}
          fileNameParts={downloadModalData.fileNameParts}
          onModalClose={handleModalClose}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      {resultsModalData.open && (
        <LoadRecordsResultsModal
          org={selectedOrg}
          type={resultsModalData.type}
          header={resultsModalData.header}
          rows={resultsModalData.data}
          onDownload={handleDownloadRecordsFromModal}
          onClose={handleViewModalClose}
        />
      )}

      <Card
        nestedBorder
        title={
          <Grid>
            <span>{sobject}</span>
            {!done && processingStartTime && <Spinner inline containerClassName="slds-m-left_medium" size="x-small" />}
          </Grid>
        }
        footer={
          omitTransformationText
            ? null
            : configuration.map(({ transformationOptions, selectedField, selectedFieldMetadata }, i) => (
                <MassUpdateRecordTransformationText
                  key={`${sobject}_${i}`}
                  selectedField={selectedField}
                  selectedFieldMetadata={selectedFieldMetadata}
                  transformationOptions={transformationOptions}
                  hasExternalWhereClause={hasExternalWhereClause}
                />
              ))
        }
      >
        {!processingStartTime && validationResults && (
          <div className="slds-m-left_medium">
            When validated,{' '}
            <span className="text-bold">
              {formatNumber(validationResults?.impactedRecords)} {pluralizeFromNumber('record', validationResults?.impactedRecords)}
            </span>{' '}
            were found matching this criteria.
          </div>
        )}
        <div className="slds-scrollable_x">
          <div className="text-bold slds-m-left_medium">{status}</div>
          {jobInfo?.id && (
            <SalesforceLogin
              className="slds-m-left_medium"
              serverUrl={serverUrl}
              org={selectedOrg}
              skipFrontDoorAuth={skipFrontDoorAuth}
              returnUrl={`/lightning/setup/AsyncApiJobStatus/page?address=%2F${jobInfo.id}`}
              iconPosition="right"
            >
              View job in Salesforce
            </SalesforceLogin>
          )}
          {jobInfo && Array.isArray(jobInfo.batches) && (
            <LoadRecordsBulkApiResultsTable
              jobInfo={jobInfo}
              processingErrors={processingErrors}
              processingStartTime={processingStartTime}
              processingEndTime={processingEndTime}
              onDownloadOrView={handleDownloadOrViewRecords}
              onDownloadProcessingErrors={handleDownloadProcessingErrors}
            />
          )}
        </div>
        {done && !jobInfo && status !== 'Error' && (
          <ScopedNotification theme="info" className="slds-m-around_small">
            No records met criteria
          </ScopedNotification>
        )}
        {status === 'Error' && (
          <ScopedNotification theme="error" className="slds-m-around_small">
            <SupportLink />
          </ScopedNotification>
        )}
      </Card>
    </Fragment>
  );
};

export default MassUpdateRecordsDeploymentRow;
