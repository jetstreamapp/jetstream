import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { AsyncJobNew, BulkDownloadJob, FileExtCsvXLSXJsonGSheet, Maybe, QueryResultsColumn, SalesforceOrgUi } from '@jetstream/types';
import { DownloadFromServerOpts, Icon, RecordDownloadModal } from '@jetstream/ui';
import { applicationCookieState, fromJetstreamEvents, fromQueryState, useAmplitude } from '@jetstream/ui-core';
import { composeQuery, parseQuery } from '@jetstreamapp/soql-parser-js';
import { Fragment, FunctionComponent, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export interface QueryResultsDownloadButtonProps {
  selectedOrg: SalesforceOrgUi;
  sObject?: Maybe<string>;
  soql: string;
  columns?: QueryResultsColumn[];
  disabled: boolean;
  isTooling: boolean;
  nextRecordsUrl: Maybe<string>;
  fields: string[];
  subqueryFields: Maybe<Record<string, string[]>>;
  records: any[];
  filteredRows: any[];
  selectedRows: any[];
  totalRecordCount: number;
}

export const QueryResultsDownloadButton: FunctionComponent<QueryResultsDownloadButtonProps> = ({
  selectedOrg,
  sObject,
  soql,
  columns,
  disabled,
  isTooling,
  nextRecordsUrl,
  fields,
  subqueryFields,
  records,
  filteredRows,
  selectedRows,
  totalRecordCount,
}) => {
  const { trackEvent } = useAmplitude();
  const [{ google_apiKey, google_appId, google_clientId, serverUrl }] = useRecoilState(applicationCookieState);
  const [isDownloadModalOpen, setModalOpen] = useState<boolean>(false);
  const includeDeletedRecords = useRecoilValue(fromQueryState.queryIncludeDeletedRecordsState);

  function handleDidDownload(fileFormat: FileExtCsvXLSXJsonGSheet, whichFields: 'all' | 'specified', includeSubquery: boolean) {
    trackEvent(ANALYTICS_KEYS.query_DownloadResults, {
      source: 'BROWSER',
      fileFormat,
      isTooling,
      userOverrideFields: whichFields === 'specified',
      whichFields,
      includeSubquery,
    });
  }

  function handleDownloadFromServer(options: DownloadFromServerOpts) {
    const {
      fileFormat,
      fileName,
      fields,
      includeSubquery,
      whichFields,
      recordsToInclude,
      hasAllRecords,
      googleFolder,
      includeDeletedRecords,
      useBulkApi,
    } = options;
    let _soql = soql;

    // Adjust the SOQL query to only include the fields specified (e.x. remove invalid fields for bulk API)
    try {
      const query = parseQuery(soql);
      const fieldValues = new Set(fields);
      query.fields = query.fields?.filter((field) => {
        if (field.type === 'Field' || field.type === 'FieldTypeof') {
          return fieldValues.has(field.field);
        }
        if (field.type === 'FieldRelationship' && field.rawValue) {
          return fieldValues.has(field.rawValue);
        }
        if (field.type === 'FieldSubquery' && !includeSubquery) {
          return false;
        }
        return true;
      });
      _soql = composeQuery(query);
    } catch (ex) {
      logger.warn('Failed processing or parse SOQL query', ex);
    }

    const jobs: AsyncJobNew<BulkDownloadJob>[] = [
      {
        type: 'BulkDownload',
        title: `Download Records`,
        org: selectedOrg,
        meta: {
          serverUrl,
          sObject: sObject || '',
          soql: _soql,
          isTooling,
          includeDeletedRecords,
          useBulkApi,
          fields,
          subqueryFields,
          records: recordsToInclude || records || [],
          totalRecordCount: totalRecordCount || 0,
          nextRecordsUrl,
          hasAllRecords,
          fileFormat,
          fileName,
          includeSubquery,
          googleFolder,
        },
      },
    ];
    fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
    trackEvent(ANALYTICS_KEYS.query_DownloadResults, {
      source: 'SERVER',
      fileFormat,
      isTooling,
      userOverrideFields: whichFields === 'specified',
      includeSubquery,
    });
  }

  return (
    <Fragment>
      <button className="slds-button slds-button_brand" onClick={() => setModalOpen(true)} disabled={disabled}>
        <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
        Download
      </button>
      {isDownloadModalOpen && (
        <RecordDownloadModal
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          downloadModalOpen={isDownloadModalOpen}
          columns={columns}
          fields={fields || []}
          subqueryFields={subqueryFields || {}}
          records={records || []}
          filteredRecords={filteredRows}
          selectedRecords={selectedRows}
          totalRecordCount={totalRecordCount || 0}
          onModalClose={() => setModalOpen(false)}
          onDownload={handleDidDownload}
          includeDeletedRecords={includeDeletedRecords}
          onDownloadFromServer={handleDownloadFromServer}
        />
      )}
    </Fragment>
  );
};

export default QueryResultsDownloadButton;
