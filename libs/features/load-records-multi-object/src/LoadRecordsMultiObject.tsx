import { css } from '@emotion/react';
import { ANALYTICS_KEYS, INPUT_ACCEPT_FILETYPES, TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import {
  ensureXlsxCodepageTable,
  formatNumber,
  isBrowserExtension,
  isCanvasApp,
  isDesktop,
  useGoBackShortcut,
  useNonInitialEffect,
  usePrimaryActionShortcut,
  useTitle,
} from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { InputReadFileContent, InputReadGoogleSheet } from '@jetstream/types';
import {
  Accordion,
  AutoFullHeightContainer,
  FileDropTarget,
  FileOrGoogleSelector,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  Spinner,
  ariaDisabledButtonProps,
  fireToast,
} from '@jetstream/ui';
import { SkipDataHistoryCheckbox, useAmplitude } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState, selectedOrgState, selectedOrgType } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import LoadRecordsMultiObjectEmptyState from './LoadRecordsMultiObjectEmptyState';
import {
  allBlockingErrorsState,
  currentStepIdxState,
  datasetsState,
  inputFileTypeState,
  inputFilenameState,
  inputGoogleFileIdState,
  isReadyToLoadState,
  loadIsRunningState,
  loadRunsState,
  previewLayoutVersionState,
  resetLoadRecordsMultiObjectState,
  skipDataHistoryState,
} from './load-records-multi-object.state';
import LoadRecordsMultiObjectLoad from './load/LoadRecordsMultiObjectLoad';
import LoadRecordsMultiObjectReview from './review/LoadRecordsMultiObjectReview';
import useProcessLoadFile from './useProcessLoadFile';

const TEMPLATE_DOWNLOAD_LINK = '/assets/content/Jetstream%20-%20Load%20Records%20to%20Multiple%20Objects%20-%20Template.xlsx';
const HEIGHT_BUFFER = 170;
const UPLOAD_SECTION_ID = 'upload-file';

/** Step 0 = upload and review, step 1 = load data and results */
const STEP_COUNT = 2;

export const LoadRecordsMultiObject = () => {
  useTitle(TITLES.LOAD);
  const { trackEvent } = useAmplitude();
  const selectedOrg = useAtomValue(selectedOrgState);
  const orgType = useAtomValue(selectedOrgType);
  const { serverUrl, defaultApiVersion, google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const googleApiConfig = useMemo(
    () => ({ apiKey: google_apiKey, appId: google_appId, clientId: google_clientId }),
    [google_apiKey, google_appId, google_clientId],
  );

  const [inputFilename, setInputFilename] = useAtom(inputFilenameState);
  const [inputFileType, setInputFileType] = useAtom(inputFileTypeState);
  const setInputGoogleFileId = useSetAtom(inputGoogleFileIdState);
  const [currentStepIdx, setCurrentStepIdx] = useAtom(currentStepIdxState);
  const [skipDataHistory, setSkipDataHistory] = useAtom(skipDataHistoryState);
  const datasets = useAtomValue(datasetsState);
  const allBlockingErrors = useAtomValue(allBlockingErrorsState);
  const isReadyToLoad = useAtomValue(isReadyToLoadState);
  const loadIsRunning = useAtomValue(loadIsRunningState);
  const runs = useAtomValue(loadRunsState);
  const setPreviewLayoutVersion = useSetAtom(previewLayoutVersionState);
  const resetAll = useSetAtom(resetLoadRecordsMultiObjectState);

  const { processFile, loading: fileParsing } = useProcessLoadFile(selectedOrg, defaultApiVersion);

  // Served by the API server, so the link must be absolute for desktop/browser-extension/canvas shells
  const templateUrl = `${serverUrl}${TEMPLATE_DOWNLOAD_LINK}`;

  const lastTrackedParseRef = useRef<unknown>(null);
  const lastTrackedRunIdRef = useRef<number | null>(null);

  useNonInitialEffect(() => {
    resetAll();
  }, [selectedOrg, resetAll]);

  // Live progress in the browser tab: loading state, then final success/failure counts
  useEffect(() => {
    try {
      if (loadIsRunning) {
        document.title = `Loading Records ${TITLES.BAR_JETSTREAM}`;
      } else if (runs.length) {
        const { success, failures } = runs
          .flatMap(({ requests }) => requests)
          .flatMap(({ results }) => results || [])
          .reduce(
            (output, result) => {
              const recordCount = result.graphResponse.compositeResponse.length;
              result.isSuccessful ? (output.success += recordCount) : (output.failures += recordCount);
              return output;
            },
            { success: 0, failures: 0 },
          );
        document.title = `${formatNumber(success)} Success - ${formatNumber(failures)} Failed ${TITLES.BAR_JETSTREAM}`;
      } else {
        document.title = TITLES.LOAD;
      }
    } catch {
      // ignore
    }
  }, [loadIsRunning, runs]);

  useEffect(() => {
    if (datasets && datasets !== lastTrackedParseRef.current) {
      lastTrackedParseRef.current = datasets;
      trackEvent(ANALYTICS_KEYS.load_multi_obj_FileProcessed, {
        worksheets: datasets.length,
        records: datasets.reduce((count, { data }) => count + data.length, 0),
        errors: allBlockingErrors.length,
      });
    }
  }, [datasets, allBlockingErrors, trackEvent]);

  useEffect(() => {
    if (!loadIsRunning && runs.length) {
      const latestRun = runs[runs.length - 1];
      if (latestRun.finishedAt && latestRun.runId !== lastTrackedRunIdRef.current) {
        lastTrackedRunIdRef.current = latestRun.runId;
        trackEvent(ANALYTICS_KEYS.load_multi_obj_Finished, {
          type: latestRun.type,
          cancelled: latestRun.cancelled,
          durationMs: latestRun.startedAt && latestRun.finishedAt ? latestRun.finishedAt.getTime() - latestRun.startedAt.getTime() : null,
        });
      }
    }
  }, [loadIsRunning, runs, trackEvent]);

  // Registered on mount so the table is ready by the time a file is chosen.
  useEffect(() => {
    ensureXlsxCodepageTable();
  }, []);

  function handleFile({ content, filename }: InputReadFileContent) {
    try {
      const workbook = XLSX.read(content, { cellText: false, cellDates: true, type: 'array' });
      resetAll({ keepSkipDataHistory: true });
      setInputFilename(filename);
      setInputFileType('local');
      setInputGoogleFileId(null);
      processFile(workbook);
    } catch (ex) {
      fireToast({
        message: `There was an error reading your file. ${getErrorMessage(ex)}`,
        type: 'error',
      });
    }
  }

  function handleGoogleFile({ workbook, selectedFile }: InputReadGoogleSheet) {
    resetAll({ keepSkipDataHistory: true });
    setInputFilename(selectedFile.name);
    setInputFileType('google');
    setInputGoogleFileId(selectedFile.id);
    processFile(workbook);
  }

  function handleStartOver() {
    resetAll();
    trackEvent(ANALYTICS_KEYS.load_StartOver, { page: 'load-multi-object' });
  }

  function changeStep(changeBy: number) {
    setCurrentStepIdx(Math.min(Math.max(currentStepIdx + changeBy, 0), STEP_COUNT - 1));
  }

  const nextStepDisabled = currentStepIdx >= STEP_COUNT - 1 || !isReadyToLoad;
  const prevStepDisabled = currentStepIdx === 0 || loadIsRunning;

  usePrimaryActionShortcut(() => changeStep(1), { disabled: nextStepDisabled || fileParsing });
  useGoBackShortcut(() => changeStep(-1), { disabled: prevStepDisabled });

  const hasData = !!datasets?.length;

  const uploadSection = (
    <div>
      <p className="slds-form-element__label slds-m-bottom_xx-small">
        Upload a file based on the{' '}
        <a
          href={templateUrl}
          target="_blank"
          rel="noreferrer"
          download
          // Underline so the link is distinguishable from surrounding text without relying on color (WCAG 1.4.1)
          css={css`
            text-decoration: underline;
          `}
          onClick={() => trackEvent(ANALYTICS_KEYS.load_multi_obj_TemplateDownloaded)}
        >
          Excel template
        </a>
      </p>
      <FileOrGoogleSelector
        omitGoogle={!hasGoogleDriveAccess && !isDesktop() && !isBrowserExtension() && !isCanvasApp()}
        hasExternalGoogleDriveAccess={isDesktop() || isBrowserExtension() || isCanvasApp()}
        googleShowUpgradeToPro={googleShowUpgradeToPro}
        fileSelectorProps={{
          id: 'upload-load-template',
          label: 'Data File (Excel File)',
          filename: inputFileType === 'local' ? inputFilename : undefined,
          accept: [INPUT_ACCEPT_FILETYPES.EXCEL],
          allowFromClipboard: true,
          disabled: fileParsing,
          onReadFile: handleFile,
        }}
        googleSelectorProps={{
          apiConfig: googleApiConfig,
          id: 'load-google-drive-file',
          label: 'Google Drive',
          buttonLabel: 'Choose Google Sheet',
          filename: inputFileType === 'google' ? inputFilename : undefined,
          disabled: fileParsing,
          onReadFile: handleGoogleFile,
        }}
        source="load_records_multi_object"
        trackEvent={trackEvent}
      />
    </div>
  );

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
              data-testid="start-over-button"
              className="slds-button slds-button_neutral"
              disabled={(!hasData && !inputFilename) || fileParsing || loadIsRunning}
              onClick={() => handleStartOver()}
            >
              <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
              Start Over
            </button>
            <button
              data-testid="prev-step-button"
              className="slds-button slds-button_neutral"
              {...ariaDisabledButtonProps(prevStepDisabled, () => changeStep(-1))}
            >
              <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" />
              Go Back
            </button>
            <button
              data-testid="next-step-button"
              className="slds-button slds-button_brand"
              {...ariaDisabledButtonProps(nextStepDisabled || fileParsing, () => changeStep(1))}
            >
              Continue to Load
            </button>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>
      {/* Not `slds-scrollable_none`: the grids below have a minimum height, so this has to be able to scroll */}
      <AutoFullHeightContainer className="slds-p-horizontal_x-small" bufferIfNotRendered={HEIGHT_BUFFER}>
        {fileParsing && <Spinner />}
        {currentStepIdx === 0 && (
          <div>
            <FileDropTarget
              accept={[INPUT_ACCEPT_FILETYPES.EXCEL]}
              disabled={fileParsing || loadIsRunning}
              label="Drop your Excel file to upload"
              onReadFile={handleFile}
            />
            {hasData ? (
              /* Once there is data to review, the upload controls collapse out of the way to give the preview room */
              <Accordion
                className="slds-m-top_x-small"
                allowMultiple={false}
                initOpenIds={[]}
                sections={[
                  {
                    id: UPLOAD_SECTION_ID,
                    testId: 'upload-section-toggle',
                    title: 'Upload a different file',
                    titleText: 'Upload a different file',
                    titleSummaryIfCollapsed: inputFilename ? (
                      <span className="slds-text-body_small slds-text-color_weak slds-m-left_x-small slds-truncate">{inputFilename}</span>
                    ) : undefined,
                    content: uploadSection,
                  },
                ]}
                onActiveIdsChange={() => setPreviewLayoutVersion((version) => version + 1)}
              />
            ) : (
              <div className="slds-m-top_small">{uploadSection}</div>
            )}
            <SkipDataHistoryCheckbox
              operation="load"
              className="slds-m-top_x-small"
              checked={skipDataHistory}
              disabled={fileParsing || loadIsRunning}
              showViewLink
              onChange={setSkipDataHistory}
            />
            {!hasData && !fileParsing && (
              <LoadRecordsMultiObjectEmptyState
                templateUrl={templateUrl}
                onTemplateDownload={() => trackEvent(ANALYTICS_KEYS.load_multi_obj_TemplateDownloaded)}
              />
            )}
            {hasData && <LoadRecordsMultiObjectReview />}
          </div>
        )}
        {currentStepIdx === 1 && (
          <LoadRecordsMultiObjectLoad selectedOrg={selectedOrg} orgType={orgType} serverUrl={serverUrl} apiVersion={defaultApiVersion} />
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default LoadRecordsMultiObject;
