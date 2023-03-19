import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { AsyncJobNew, BulkDownloadJob, FileExtCsvXLSXJsonGSheet, MapOf, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { ButtonGroupContainer, DropDown, Icon, RecordDownloadModal } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import { useRecoilState } from 'recoil';
import { Query } from 'soql-parser-js';
import { applicationCookieState } from '../../../app-state';
import { useAmplitude } from '../../core/analytics';
import * as fromJetstreamEvents from '../../core/jetstream-events';
import BulkUpdateFromQueryModal from './BulkUpdateFromQuery/BulkUpdateFromQueryModal';

export interface QueryResultsDownloadButtonProps {
  selectedOrg: SalesforceOrgUi;
  sobject?: Maybe<string>;
  parsedQuery: Maybe<Query>;
  disabled: boolean;
  isTooling: boolean;
  nextRecordsUrl: Maybe<string>;
  fields: string[];
  modifiedFields: string[];
  subqueryFields: Maybe<MapOf<string[]>>;
  records: any[];
  filteredRows: any[];
  selectedRows: any[];
  totalRecordCount: number;
  refreshRecords: () => void;
}

export const QueryResultsDownloadButton: FunctionComponent<QueryResultsDownloadButtonProps> = ({
  selectedOrg,
  sobject,
  parsedQuery,
  disabled,
  isTooling,
  nextRecordsUrl,
  fields,
  modifiedFields,
  subqueryFields,
  records,
  filteredRows,
  selectedRows,
  totalRecordCount,
  refreshRecords,
}) => {
  const { trackEvent } = useAmplitude();
  const [{ google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const [isDownloadModalOpen, setModalOpen] = useState<boolean>(false);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState<boolean>(false);

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

  function handleDownloadFromServer(options: {
    fileFormat: FileExtCsvXLSXJsonGSheet;
    fileName: string;
    fields: string[];
    subqueryFields: MapOf<string[]>;
    whichFields: 'all' | 'specified';
    includeSubquery: boolean;
    googleFolder?: string;
  }) {
    const { fileFormat, fileName, fields, includeSubquery, whichFields, googleFolder } = options;
    const jobs: AsyncJobNew<BulkDownloadJob>[] = [
      {
        type: 'BulkDownload',
        title: `Download Records`,
        org: selectedOrg,
        meta: {
          isTooling,
          fields,
          subqueryFields,
          records: records || [],
          totalRecordCount: totalRecordCount || 0,
          nextRecordsUrl,
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

  function handleAction(item: 'bulk-update') {
    switch (item) {
      case 'bulk-update':
        setIsBulkUpdateModalOpen(true);
        break;

      default:
        break;
    }
  }

  function handleBulkUpdateModalClose(didUpdate = false) {
    setIsBulkUpdateModalOpen(false);
    refreshRecords();
  }

  return (
    <Fragment>
      <ButtonGroupContainer>
        <button className="slds-button slds-button_brand" onClick={() => setModalOpen(true)} disabled={disabled}>
          <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
          Download
        </button>
        <DropDown
          className="slds-button_last"
          dropDownClassName="slds-dropdown_actions"
          position="right"
          items={[
            { id: 'bulk-update', value: 'Bulk update records', disabled: isTooling || !sobject || !totalRecordCount || !parsedQuery },
          ]}
          onSelected={(item) => handleAction(item as 'bulk-update')}
        />
      </ButtonGroupContainer>
      {isDownloadModalOpen && (
        <RecordDownloadModal
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          downloadModalOpen={isDownloadModalOpen}
          fields={fields || []}
          modifiedFields={modifiedFields || []}
          subqueryFields={subqueryFields || {}}
          records={records || []}
          filteredRecords={filteredRows}
          selectedRecords={selectedRows}
          totalRecordCount={totalRecordCount || 0}
          onModalClose={() => setModalOpen(false)}
          onDownload={handleDidDownload}
          onDownloadFromServer={handleDownloadFromServer}
        />
      )}
      {isBulkUpdateModalOpen && sobject && totalRecordCount && parsedQuery && (
        <BulkUpdateFromQueryModal
          selectedOrg={selectedOrg}
          sobject={sobject}
          parsedQuery={parsedQuery}
          records={records || []}
          filteredRecords={filteredRows}
          selectedRecords={selectedRows}
          totalRecordCount={totalRecordCount || 0}
          onModalClose={handleBulkUpdateModalClose}
        />
      )}
    </Fragment>
  );
};

export default QueryResultsDownloadButton;
