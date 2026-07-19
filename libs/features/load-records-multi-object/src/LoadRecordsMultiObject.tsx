import { ANALYTICS_KEYS, DATE_FORMATS, INPUT_ACCEPT_FILETYPES, TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import {
  formatNumber,
  initXlsx,
  isBrowserExtension,
  isCanvasApp,
  isDesktop,
  useNonInitialEffect,
  useTitle,
} from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { InputReadFileContent, InputReadGoogleSheet, LocalOrGoogle, Maybe } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Checkbox,
  ConfirmationModalPromise,
  EmptyState,
  FileOrGoogleSelector,
  fireToast,
  Grid,
  Icon,
  OpenRoadIllustration,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Select,
  Spinner,
} from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import {
  applicationCookieState,
  dataHistoryCaptureEnabledState,
  googleDriveAccessState,
  selectedOrgState,
  selectedOrgType,
} from '@jetstream/ui/app-state';
import { startDataHistoryEntry } from '@jetstream/ui/data-history';
import { useAtomValue } from 'jotai';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import LoadRecordsMultiObjectErrors from './LoadRecordsMultiObjectErrors';
import LoadRecordsMultiObjectResults from './LoadRecordsMultiObjectResults';
import {
  buildMultiObjectInputSource,
  DataHistoryHandlePromise,
  finalizeMultiObjectHistory,
  getMultiObjectDistinctSobjects,
  getMultiObjectOperations,
  writeMultiObjectRequestJson,
} from './data-history-capture';
import { buildMultiObjectRequestExport } from './load-records-multi-object-results';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';
import useLoadFile from './useLoadFile';
import useProcessLoadFile from './useProcessLoadFile';

initXlsx(XLSX);

const TEMPLATE_DOWNLOAD_LINK = '/assets/content/Jetstream%20-%20Load%20Records%20to%20Multiple%20Objects%20-%20Template.xlsx';
const HEIGHT_BUFFER = 170;

export const LoadRecordsMultiObject = () => {
  useTitle(TITLES.LOAD);
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const selectedOrg = useAtomValue(selectedOrgState);
  const orgType = useAtomValue(selectedOrgType);

  const [inputFilename, setInputFilename] = useState<Maybe<string>>(null);
  const [inputFileType, setInputFileType] = useState<LocalOrGoogle>();
  const [inputGoogleFileId, setInputGoogleFileId] = useState<Maybe<string>>(null);
  const [inputFileData, setInputFileData] = useState<XLSX.WorkBook>();
  // Data History — seeded during app init so the opt-out checkbox renders synchronously
  const dataHistoryCaptureEnabled = useAtomValue(dataHistoryCaptureEnabledState);
  const [skipDataHistory, setSkipDataHistory] = useState(false);
  const historyHandleRef = useRef<DataHistoryHandlePromise | null>(null);
  const historyFinalizedRef = useRef(false);
  const { serverUrl, defaultApiVersion, google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const googleApiConfig = useMemo(
    () => ({ apiKey: google_apiKey, appId: google_appId, clientId: google_clientId }),
    [google_apiKey, google_appId, google_clientId],
  );
  const [templateUrl] = useState(`${TEMPLATE_DOWNLOAD_LINK}`);
  const [insertNulls, setInsertNulls] = useState(false);
  const [dateFormat, setDateFormat] = useState<string>(DATE_FORMATS.MM_DD_YYYY);
  const [loadStarted, setLoadStarted] = useState(false);
  const {
    processFile,
    reset: fileProcessingReset,
    data: fileProcessingData,
    errors: fileProcessingErrors,
    loading: fileProcessingLoading,
  } = useProcessLoadFile(selectedOrg, defaultApiVersion, { dateFormat, insertNulls });
  const {
    loadFile,
    reset: loadResultsReset,
    data: loadResultsData,
    loading: dataLoadLoading,
  } = useLoadFile(selectedOrg, serverUrl, defaultApiVersion);

  const [data, setData] = useState<LoadMultiObjectRequestWithResult[] | null>(null);
  /** This only stores the data provided from the init file read process, so if the user loads again this has the pre-load state */
  const [initialData, setInitialData] = useState<LoadMultiObjectRequestWithResult[]>();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useNonInitialEffect(() => {
    handleStartOver();
  }, [selectedOrg]);

  useNonInitialEffect(() => {
    try {
      if (dataLoadLoading) {
        document.title = `Loading Records ${TITLES.BAR_JETSTREAM}`;
      } else if (loadStarted && data) {
        const success = data.flatMap((row) => row.results?.filter((row) => row.isSuccessful) || []).length;
        const failures = data.flatMap((row) => row.results?.filter((row) => !row.isSuccessful) || []).length;
        document.title = `${formatNumber(success)} Success - ${formatNumber(failures)} Failed ${TITLES.BAR_JETSTREAM}`;
      } else {
        document.title = TITLES.LOAD;
      }
    } catch (ex) {
      // ignore
    }
  }, [data, dataLoadLoading, loadStarted]);

  // prefer loadResultsData if it is set, otherwise use fileProcessingData
  // It is all the same data, but loadResultsData clones the data as it is being processed and adds results
  useEffect(() => {
    setData(loadResultsData || fileProcessingData);
  }, [fileProcessingData, loadResultsData]);

  // Finalize the Data History entry once the load completes — streams the flattened result rows and
  // writes the counts derived from the same data. Fire-and-forget; guarded to run exactly once per run.
  useEffect(() => {
    if (!loadStarted || dataLoadLoading || !loadResultsData || !historyHandleRef.current || historyFinalizedRef.current) {
      return;
    }
    historyFinalizedRef.current = true;
    finalizeMultiObjectHistory(historyHandleRef.current, loadResultsData);
  }, [dataLoadLoading, loadResultsData, loadStarted]);

  useEffect(() => {
    setInitialData(JSON.parse(JSON.stringify(fileProcessingData)));
  }, [fileProcessingData]);

  useNonInitialEffect(() => {
    if (inputFileData) {
      processFile(inputFileData);
    }
  }, [inputFileData]);

  function handleDateFormatChange(event: ChangeEvent<HTMLSelectElement>) {
    setDateFormat(event.target.value);
  }

  function handleFile({ content, filename }: InputReadFileContent) {
    try {
      setLoadStarted(false);
      const workbook = XLSX.read(content, { cellText: false, cellDates: true, type: 'array' });
      setInputFilename(filename);
      setInputFileType('local');
      setInputGoogleFileId(null);
      setInputFileData(workbook);
      fileProcessingReset();
      loadResultsReset();
    } catch (ex) {
      fireToast({
        message: `There was an error reading your file. ${getErrorMessage(ex)}`,
        type: 'error',
      });
    }
  }

  function handleGoogleFile({ workbook, selectedFile }: InputReadGoogleSheet) {
    setLoadStarted(false);
    setInputFilename(selectedFile.name);
    setInputFileType('google');
    setInputGoogleFileId(selectedFile.id);
    setInputFileData(workbook);
    fileProcessingReset();
    loadResultsReset();
  }

  async function handleLoadStarted() {
    if (!initialData) {
      return;
    }
    if (
      !loadStarted ||
      (await ConfirmationModalPromise({
        content: 'This file has already been loaded, are you sure you want to load it again?',
      }))
    ) {
      setLoadStarted(true);
      startDataHistoryCapture(initialData);
      loadFile(initialData);
    }
  }

  /**
   * Begin a Data History entry for the load (self-gates, fire-and-forget). One entry covers the whole
   * multi-object load — `sobjects` spans every object and `operation` is the shared op ('insert' when
   * mixed, with the per-object operations recorded in `config`).
   */
  function startDataHistoryCapture(dataToLoad: LoadMultiObjectRequestWithResult[]) {
    const operations = getMultiObjectOperations(dataToLoad);
    const historyHandle = startDataHistoryEntry({
      org: selectedOrg,
      source: 'load-multi-object',
      operation: operations.operation,
      api: 'composite-graph',
      sobjects: getMultiObjectDistinctSobjects(dataToLoad),
      config: {
        insertNulls,
        dateFormat,
        numGroups: dataToLoad.length,
        operationsByObject: operations.byObject,
        mixedOperations: operations.mixed,
      },
      inputSource: buildMultiObjectInputSource({
        filename: inputFilename,
        filenameType: inputFileType,
        googleFileId: inputGoogleFileId,
      }),
      skipHistory: skipDataHistory,
    });
    historyHandleRef.current = historyHandle;
    historyFinalizedRef.current = false;
    writeMultiObjectRequestJson(historyHandle, buildMultiObjectRequestExport(dataToLoad));
  }

  function handleStartOver() {
    setLoadStarted(false);
    setInputFilename(null);
    setInputGoogleFileId(null);
    historyHandleRef.current = null;
    historyFinalizedRef.current = false;
    fileProcessingReset();
    loadResultsReset();
    trackEvent(ANALYTICS_KEYS.load_StartOver);
  }

  return (
    <Page testId="load-records-multi-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'record_update' }}
            label="Load Records to Multiple Objects"
            docsPath={APP_ROUTES.LOAD_MULTIPLE.DOCS}
          />
          <PageHeaderActions colType="actions" buttonType="separate">
            <button
              className="slds-button slds-button_neutral"
              disabled={fileProcessingLoading || dataLoadLoading}
              onClick={() => handleStartOver()}
            >
              <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
              Start Over
            </button>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {fileProcessingLoading && <Spinner />}
        <ScopedNotification theme="light" className="slds-m-top_x-small">
          <p>
            Download the{' '}
            <a href={`${templateUrl}`} target="_blank" rel="noreferrer">
              Excel template
            </a>{' '}
            to get started.
          </p>
        </ScopedNotification>

        <Grid>
          <fieldset className="slds-form-element slds-m-around_small">
            <legend className="slds-form-element__legend slds-form-element__label">Load Options</legend>
            <Checkbox
              id={'insert-null-values'}
              checked={insertNulls}
              label={'Clear Fields with Blank Values'}
              labelHelp="Select this option to clear any mapped fields where the field is blank in your file. This only applies to record updates."
              disabled={loadStarted || fileProcessingLoading}
              onChange={setInsertNulls}
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
                disabled={loadStarted || fileProcessingLoading}
                onChange={handleDateFormatChange}
              >
                <option value={DATE_FORMATS.MM_DD_YYYY}>{DATE_FORMATS.MM_DD_YYYY}</option>
                <option value={DATE_FORMATS.DD_MM_YYYY}>{DATE_FORMATS.DD_MM_YYYY}</option>
                <option value={DATE_FORMATS.YYYY_MM_DD}>{DATE_FORMATS.YYYY_MM_DD}</option>
              </select>
            </Select>
            <FileOrGoogleSelector
              omitGoogle={!hasGoogleDriveAccess && !isDesktop() && !isBrowserExtension() && !isCanvasApp()}
              hasExternalGoogleDriveAccess={isDesktop() || isBrowserExtension() || isCanvasApp()}
              googleShowUpgradeToPro={googleShowUpgradeToPro}
              fileSelectorProps={{
                id: 'upload-load-template',
                label: 'Data File (Excel File)',
                filename: inputFileType === 'local' ? inputFilename : undefined,
                accept: [INPUT_ACCEPT_FILETYPES.EXCEL],
                disabled: fileProcessingLoading || dataLoadLoading,
                onReadFile: handleFile,
              }}
              googleSelectorProps={{
                apiConfig: googleApiConfig,
                id: 'load-google-drive-file',
                label: 'Google Drive',
                buttonLabel: 'Choose Google Sheet',
                filename: inputFileType === 'google' ? inputFilename : undefined,
                disabled: fileProcessingLoading || dataLoadLoading,
                onReadFile: handleGoogleFile,
              }}
              source="load_records_multi_object"
              trackEvent={trackEvent}
            />
            <div className="slds-form-element__help slds-truncate">
              Choose an Excel file that is in the correct format from the provided template.
            </div>
            {dataHistoryCaptureEnabled && (
              <Checkbox
                id={'skip-data-history'}
                className="slds-m-top_x-small"
                checked={skipDataHistory}
                label={"Don't save this load to Data History"}
                labelHelp="Data History keeps a local copy of your loaded records and results on this device. Check this to skip saving this particular load."
                disabled={loadStarted || dataLoadLoading}
                onChange={setSkipDataHistory}
              />
            )}
          </fieldset>
        </Grid>

        {!data && !fileProcessingErrors?.length && (
          <div>
            <EmptyState headline="Load a file to continue" illustration={<OpenRoadIllustration />}>
              <p>
                Download the{' '}
                <a href={`${templateUrl}`} target="_blank" rel="noreferrer">
                  Excel template
                </a>{' '}
                to get started.
              </p>
            </EmptyState>
            ;
          </div>
        )}
        {/* TODO: what if there are no rows in any of the loaded data? */}
        {fileProcessingErrors?.length > 0 && <LoadRecordsMultiObjectErrors errors={fileProcessingErrors} />}
        {data && data.length > 0 && (
          <LoadRecordsMultiObjectResults
            selectedOrg={selectedOrg}
            orgType={orgType}
            data={data}
            loading={dataLoadLoading}
            loadFinished={!!loadResultsData && !dataLoadLoading}
            onLoadStarted={handleLoadStarted}
          />
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default LoadRecordsMultiObject;
