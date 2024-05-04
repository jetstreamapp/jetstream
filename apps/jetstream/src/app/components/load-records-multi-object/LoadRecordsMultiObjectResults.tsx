import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { FileExtAllTypes, Maybe, SalesforceOrgUi, SalesforceOrgUiType } from '@jetstream/types';
import { Badge, FileDownloadModal, Grid, Icon } from '@jetstream/ui';
import { applicationCookieState, fromJetstreamEvents } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import LoadRecordsMultiObjectResultsTable from './LoadRecordsMultiObjectResultsTable';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';
import useDownloadResults from './useDownloadResults';

export interface LoadRecordsMultiObjectResultsProps {
  selectedOrg: SalesforceOrgUi;
  orgType: Maybe<SalesforceOrgUiType>;
  data: LoadMultiObjectRequestWithResult[];
  loading: boolean;
  loadFinished: boolean;
  onLoadStarted: () => void;
}

export const LoadRecordsMultiObjectResults: FunctionComponent<LoadRecordsMultiObjectResultsProps> = ({
  selectedOrg,
  orgType,
  data,
  loading,
  loadFinished,
  onLoadStarted,
}) => {
  const [{ google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const { downloadRequests, downloadResults, handleCloseDownloadModal, downloadModalData } = useDownloadResults();
  const [numGroups, setNumGroups] = useState(0);
  const [totalRecordCount, setTotalRecordCount] = useState(0);

  useEffect(() => {
    setNumGroups(data.reduce((output, group) => output + Object.keys(group.dataWithResultsByGraphId).length, 0));
    setTotalRecordCount(data.reduce((output, group) => output + Object.keys(group.recordWithResponseByRefId).length, 0));
  }, [data]);

  return (
    <div>
      {downloadModalData.open && (
        <FileDownloadModal
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          data={downloadModalData.data}
          header={downloadModalData.header}
          fileNameParts={downloadModalData.fileNameParts}
          allowedTypes={downloadModalData.allowedTypes as FileExtAllTypes[]}
          onModalClose={handleCloseDownloadModal}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      {/* Summary and load button */}
      <div className="slds-p-around_small">
        <div>
          <Badge type={orgType === 'Production' ? 'warning' : 'light'} title={orgType || undefined}>
            {orgType}
          </Badge>
          <strong className="slds-m-left_xx-small">{selectedOrg.username}</strong>
        </div>
        <div className="slds-m-top_small">
          <button className="slds-button slds-button_brand" disabled={loading} onClick={onLoadStarted}>
            Load <strong className="slds-m-horizontal_xx-small">{formatNumber(totalRecordCount)}</strong>{' '}
            {pluralizeFromNumber('Record', totalRecordCount)} ({formatNumber(numGroups)} {pluralizeFromNumber('Group', numGroups)})
          </button>
        </div>
      </div>

      <div className="slds-m-top_medium">
        <Grid align="spread">
          <div>
            {data.length > 1 && loadFinished && (
              <button className="slds-button slds-m-left_medium" onClick={() => downloadResults(data, 'results')}>
                <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                Download All Results
              </button>
            )}
          </div>
          <div>
            <button className="slds-button" onClick={() => downloadRequests(data)}>
              <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
              Download Load Data
            </button>
          </div>
        </Grid>

        <LoadRecordsMultiObjectResultsTable data={data} onDownloadResults={downloadResults} />
      </div>
    </div>
  );
};

export default LoadRecordsMultiObjectResults;
