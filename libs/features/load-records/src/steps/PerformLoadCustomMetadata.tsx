import { ANALYTICS_KEYS, DATE_FORMATS, TITLES } from '@jetstream/shared/constants';
import { formatNumber, useNonInitialEffect, useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj, groupByFlat } from '@jetstream/shared/utils';
import {
  DeployMessage,
  DownloadModalData,
  DownloadType,
  FieldMapping,
  FieldWithRelatedEntities,
  MapOfCustomMetadataRecord,
  Maybe,
  SalesforceOrgUi,
  SalesforceOrgUiType,
  ViewModalData,
} from '@jetstream/types';
import { Badge, Checkbox, ConfirmationModalPromise, FileDownloadModal, SalesforceLogin, Select, Spinner } from '@jetstream/ui';
import {
  ConfirmPageChange,
  LoadRecordsResultsModal,
  applicationCookieState,
  convertCsvToCustomMetadata,
  fromJetstreamEvents,
  prepareCustomMetadata,
  selectSkipFrontdoorAuth,
  useAmplitude,
  useDeployMetadataPackage,
} from '@jetstream/ui-core';
import { ChangeEvent, Fragment, FunctionComponent, useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import LoadRecordsDuplicateWarning from '../components/LoadRecordsDuplicateWarning';
import LoadRecordsCustomMetadataResultsTable from '../components/load-results/LoadRecordsCustomMetadataResultsTable';

export function getDeploymentStatusUrl(id: string) {
  const address = encodeURIComponent(
    `/changemgmt/monitorDeploymentsDetails.apexp?asyncId=${id}&retURL=${encodeURIComponent('/changemgmt/monitorDeployment.apexp')}`
  );
  return `/lightning/setup/DeployStatus/page?address=${address}`;
}

export interface PerformLoadCustomMetadataProps {
  apiVersion: string;
  serverUrl: string;
  selectedOrg: SalesforceOrgUi;
  orgType: Maybe<SalesforceOrgUiType>;
  selectedSObject: string;
  inputFileHeader: string[] | null;
  fieldMapping: FieldMapping;
  fields: FieldWithRelatedEntities[];
  inputFileData: any[];
  onIsLoading: (isLoading: boolean) => void;
}

export const PerformLoadCustomMetadata: FunctionComponent<PerformLoadCustomMetadataProps> = ({
  selectedOrg,
  orgType,
  selectedSObject,
  inputFileHeader,
  fieldMapping,
  fields,
  inputFileData,
  onIsLoading,
}) => {
  const rollbar = useRollbar();
  const { trackEvent } = useAmplitude();
  const { serverUrl, defaultApiVersion, google_apiKey, google_appId, google_clientId } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);
  const [loadNumber, setLoadNumber] = useState<number>(0);
  const [rollbackOnError, setRollbackOnError] = useState<boolean>(false);
  const [dateFormat, setDateFormat] = useState<string>(DATE_FORMATS.MM_DD_YYYY);
  const [metadata, setMetadata] = useState<MapOfCustomMetadataRecord | null>(null);
  const [deployStatusUrl, setDeployStatusUrl] = useState<string | null>(null);
  const [prepareMetadataError, setDeployMetadataError] = useState<string | null>(null);

  const [downloadModalData, setDownloadModalData] = useState<DownloadModalData>({
    open: false,
    data: [],
    header: [],
    fileNameParts: [],
  });
  const [resultsModalData, setResultsModalData] = useState<ViewModalData>({ open: false, data: [], header: [], type: 'results' });
  const numRecordsImpactedLabel = formatNumber(inputFileData.length);

  const onFinished = useCallback(() => {
    onIsLoading(false);
  }, [onIsLoading]);

  const { deployMetadata, results, deployId, hasLoaded, loading, hasError, errorMessage } = useDeployMetadataPackage(serverUrl, onFinished);

  useNonInitialEffect(() => {
    if (deployId) {
      setDeployStatusUrl(getDeploymentStatusUrl(deployId));
    }
  }, [deployId]);

  function handleDateFormatChange(event: ChangeEvent<HTMLSelectElement>) {
    setDateFormat(event.target.value);
  }

  async function handleStartLoad() {
    if (
      loadNumber === 0 ||
      (await ConfirmationModalPromise({
        content: 'This file has already been loaded, are you sure you want to load it again?',
      }))
    ) {
      try {
        const metadata = convertCsvToCustomMetadata(selectedSObject, inputFileData, fields, fieldMapping, dateFormat);
        const metadataPackage = await prepareCustomMetadata(defaultApiVersion, metadata);
        setMetadata(metadata);
        setLoadNumber(loadNumber + 1);
        deployMetadata(selectedOrg, metadataPackage, {
          singlePackage: true,
          checkOnly: false,
          ignoreWarnings: true,
          rollbackOnError,
        });
        onIsLoading(true);
        trackEvent(ANALYTICS_KEYS.load_Submitted, {
          loadType: 'Custom Metadata',
          numRecords: inputFileData.length,
          timesSameDataSubmitted: loadNumber + 1,
          dateFormat,
        });
        document.title = `Loading Records | ${TITLES.BAR_JETSTREAM}`;
      } catch (ex) {
        setDeployMetadataError('There was a problem preparing the Custom Metadata for deployment. Please check your file and try again.');
        rollbar.error('Problem preparing custom metadata', getErrorMessageAndStackObj(ex));
      }
    }
  }

  function handleDownload(type: DownloadType) {
    if (!metadata) {
      return;
    }
    const resultsByFullName = groupByFlat<DeployMessage>(
      results?.details?.componentSuccesses?.concat(results.details.componentFailures) || [],
      'fullName'
    );
    let header: string[] = [];
    let data = Object.keys(metadata).map((fullName) => {
      if (header.length === 0) {
        header = ['_id', '_success', '_error', '_created', '_changed', ...Object.keys(metadata[fullName].record)];
      }
      return {
        _id: resultsByFullName[fullName]?.id || '',
        _success: resultsByFullName[fullName]?.success || '',
        _error: resultsByFullName[fullName]?.problem || '',
        _created: resultsByFullName[fullName]?.created || '',
        _changed: resultsByFullName[fullName]?.changed || '',
        ...metadata[fullName].record,
      };
    });
    if (type === 'failures') {
      data = data.filter((record) => !record._success);
    }
    setDownloadModalData({ data, fileNameParts: ['custom-metadata', selectedSObject.toLocaleLowerCase(), type], header, open: true });
    trackEvent(ANALYTICS_KEYS.load_DownloadRecords, { loadType: 'Custom Metadata', type, numRows: data.length });
  }

  function handleViewResults(type: DownloadType) {
    if (!metadata) {
      return;
    }
    const resultsByFullName = groupByFlat<DeployMessage>(
      results?.details?.componentSuccesses?.concat(results.details.componentFailures) || [],
      'fullName'
    );
    let header: string[] = [];
    let data = Object.keys(metadata).map((fullName) => {
      if (!header.length) {
        header = ['_id', '_success', '_error', '_created', '_changed', ...Object.keys(metadata[fullName].record)];
      }
      return {
        _id: resultsByFullName[fullName]?.id || '',
        _success: resultsByFullName[fullName]?.success ?? false,
        _error: resultsByFullName[fullName]?.problem || '',
        _created: resultsByFullName[fullName]?.created ?? false,
        _changed: resultsByFullName[fullName]?.changed ?? false,
        ...metadata[fullName].record,
      };
    });
    if (type === 'failures') {
      data = data.filter((record) => !record._success);
    }
    setResultsModalData({ data, header, open: true, type });
    trackEvent(ANALYTICS_KEYS.load_ViewRecords, { loadType: 'Custom Metadata', type, numRows: data.length });
  }

  function handleDownloadRecordsFromModal(type: 'results' | 'failures', rows: any[], header: string[]) {
    setResultsModalData({ ...resultsModalData, open: false });
    setDownloadModalData({
      open: true,
      data: rows,
      header,
      fileNameParts: ['custom-metadata', selectedSObject.toLocaleLowerCase(), type],
    });
  }

  function handleModalClose() {
    setDownloadModalData({ ...downloadModalData, open: false, fileNameParts: [] });
  }

  function handleViewModalClose() {
    setResultsModalData({ open: false, data: [], header: [], type: 'results' });
  }

  return (
    <div>
      <ConfirmPageChange actionInProgress={loading} />
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
      <LoadRecordsDuplicateWarning
        className="slds-m-vertical_x-small"
        inputFileHeader={inputFileHeader}
        fieldMapping={fieldMapping}
        inputFileData={inputFileData}
        loadType="UPSERT"
        isCustomMetadata
      />
      <h1 className="slds-text-heading_medium">Options</h1>
      <div className="slds-p-around_small">
        <Checkbox
          id={'insert-null-values'}
          checked
          label={'Clear Fields with Blank Values'}
          helpText={
            <span className="slds-text-color_destructive">
              Custom metadata records require all fields to be set, any unmapped or null fields will result in null values.
            </span>
          }
          disabled
        />
        <Checkbox
          id={'rollback-on-error'}
          label={'Rollback on Error'}
          labelHelp="Rollback all records if any record fails to load. This must be enabled for production orgs."
          checked={rollbackOnError}
          onChange={setRollbackOnError}
          helpText="If this is checked, valid records will still show as successful even if they were rolled back."
        />
        <Select
          id={'date-format'}
          label={'Date Format'}
          labelHelp="Specify the format of any date fields in your file. Jetstream just needs to know the order of the month and the day and will auto-detect the exact format."
        >
          <select
            aria-describedby="date-format"
            className="slds-select"
            id="date-format-select"
            required
            value={dateFormat}
            disabled={loading}
            onChange={handleDateFormatChange}
          >
            <option value={DATE_FORMATS.MM_DD_YYYY}>{DATE_FORMATS.MM_DD_YYYY}</option>
            <option value={DATE_FORMATS.DD_MM_YYYY}>{DATE_FORMATS.DD_MM_YYYY}</option>
            <option value={DATE_FORMATS.YYYY_MM_DD}>{DATE_FORMATS.YYYY_MM_DD}</option>
          </select>
        </Select>
      </div>
      <h1 className="slds-text-heading_medium">Summary</h1>
      <div className="slds-p-around_small">
        <div>
          <Badge type={orgType === 'Production' ? 'warning' : 'light'} title={orgType || undefined}>
            {orgType}
          </Badge>
          <strong className="slds-m-left_xx-small">{selectedOrg.username}</strong>
        </div>
        <div className="slds-m-top_small">
          <button className="slds-button slds-button_brand" disabled={loading} onClick={handleStartLoad}>
            Upsert <strong className="slds-m-horizontal_xx-small">{numRecordsImpactedLabel}</strong> Records
          </button>
        </div>
      </div>
      <h1 className="slds-text-heading_medium">Results</h1>
      <div className="slds-p-around_small">
        {hasLoaded && !results && (
          <h3 className="slds-text-heading_small slds-grid">
            <span>Uploading custom metadata</span>
            <Spinner inline containerClassName="slds-m-left_small" size="x-small" />
          </h3>
        )}
        {prepareMetadataError && <span className="slds-text-color_error">{prepareMetadataError}</span>}
        {hasError && errorMessage && <span className="slds-text-color_error">{errorMessage}</span>}
        {hasLoaded && results && (
          <Fragment>
            {deployStatusUrl && (
              <SalesforceLogin
                serverUrl={serverUrl}
                org={selectedOrg}
                skipFrontDoorAuth={skipFrontDoorAuth}
                returnUrl={deployStatusUrl}
                iconPosition="right"
              >
                View job in Salesforce
              </SalesforceLogin>
            )}
            <LoadRecordsCustomMetadataResultsTable results={results} onDownload={handleDownload} onViewResults={handleViewResults} />
          </Fragment>
        )}
      </div>
    </div>
  );
};

export default PerformLoadCustomMetadata;
