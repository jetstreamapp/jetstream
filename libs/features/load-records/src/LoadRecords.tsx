import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { clearCacheForOrg } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { formatNumber, useGoBackShortcut, usePrimaryActionShortcut, useTitle } from '@jetstream/shared/ui-utils';
import { FieldWithRelatedEntities, LocalOrGoogle, Maybe, Step } from '@jetstream/types';
import {
  ariaDisabledButtonProps,
  AutoFullHeightContainer,
  fireToast,
  getAriaKeyshortcuts,
  getModifierKey,
  Grid,
  Icon,
  KeyboardShortcut,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  Tooltip,
} from '@jetstream/ui';
import {
  autoMapFields,
  fromLoadRecordsState,
  getFieldMetadata,
  getMaxBatchSize,
  getRecommendedApiMode,
  useAmplitude,
  ViewDataHistoryLink,
} from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState, selectedOrgState, selectedOrgType } from '@jetstream/ui/app-state';
import { recentHistoryItemsDb } from '@jetstream/ui/db';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import startCase from 'lodash/startCase';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import LoadRecordsDataPreview from './components/LoadRecordsDataPreview';
import LoadRecordsNextStepButton from './components/LoadRecordsNextStepButton';
import LoadRecordsProgress from './components/LoadRecordsProgress';
import LoadRecordsFieldMapping from './steps/FieldMapping';
import PerformLoad from './steps/PerformLoad';
import PerformLoadCustomMetadata from './steps/PerformLoadCustomMetadata';
import LoadRecordsSelectObjectAndFile from './steps/SelectObjectAndFile';
import {
  getFieldMappingBlockedReason,
  getSelectObjectAndFileBlockedReason,
  LAST_STEP_BLOCKED_REASON,
} from './utils/continue-blocked-reason';

const HEIGHT_BUFFER = 170;

const steps: Step[] = [
  { name: 'sobjectAndFile', label: 'Choose Object and Load File' },
  { name: 'fieldMapping', label: 'Map Fields' },
  { name: 'loadRecords', label: 'Load Data' },
];

export const LoadRecords = () => {
  useTitle(TITLES.LOAD);
  const isMounted = useRef(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackEvent } = useAmplitude();

  // Capture pre-fill params (e.g. from browser extension popover) once on mount
  const [initialObjectName] = useState(() => searchParams.get('objectName'));
  const [hasAppliedInitialObjectName, setHasAppliedInitialObjectName] = useState(false);
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const googleApiConfig = useMemo(
    () => ({ apiKey: google_apiKey, appId: google_appId, clientId: google_clientId }),
    [google_apiKey, google_appId, google_clientId],
  );
  const selectedOrg = useAtomValue(selectedOrgState);
  const orgType = useAtomValue(selectedOrgType);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);
  const [sobjects, setSobjects] = useAtom(fromLoadRecordsState.sObjectsState);
  const [selectedSObject, setSelectedSObject] = useAtom(fromLoadRecordsState.selectedSObjectState);
  const isCustomMetadataObject = useAtomValue(fromLoadRecordsState.isCustomMetadataObject);
  const [loadType, setLoadType] = useAtom(fromLoadRecordsState.loadTypeState);
  const [fields, setFields] = useState<FieldWithRelatedEntities[]>([]);
  const [mappableFields, setMappableFields] = useState<FieldWithRelatedEntities[]>([]);
  const [externalIdFields, setExternalIdFields] = useState<FieldWithRelatedEntities[]>([]);
  const [externalId, setExternalId] = useState<string>('');
  const [inputFileData, setInputFileData] = useAtom(fromLoadRecordsState.inputFileDataState);
  const [inputFileHeader, setInputFileHeader] = useAtom(fromLoadRecordsState.inputFileHeaderState);
  const [inputFilename, setInputFilename] = useAtom(fromLoadRecordsState.inputFilenameState);
  const [inputFilenameType, setInputFilenameType] = useAtom(fromLoadRecordsState.inputFilenameTypeState);
  const [inputGoogleFile, setInputGoogleFile] = useAtom(fromLoadRecordsState.inputGoogleFileState);

  const [inputZipFileData, setInputZipFileData] = useAtom(fromLoadRecordsState.inputZipFileDataState);
  const [inputZipFilename, setInputZipFilename] = useAtom(fromLoadRecordsState.inputZipFilenameState);
  const allowBinaryAttachment = useAtomValue(fromLoadRecordsState.selectAllowBinaryAttachment);
  const binaryAttachmentBodyField = useAtomValue(fromLoadRecordsState.selectBinaryAttachmentBodyField);

  const [fieldMapping, setFieldMapping] = useAtom(fromLoadRecordsState.fieldMappingState);

  const setApiMode = useSetAtom(fromLoadRecordsState.apiModeState);
  const setBatchSize = useSetAtom(fromLoadRecordsState.batchSizeState);
  const setSerialMode = useSetAtom(fromLoadRecordsState.serialModeState);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingFields, setLoadingFields] = useState<boolean>(false);
  const [didPerformDataLoad, setDidPerformDataLoad] = useState<boolean>(false);

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const currentStep = steps[currentStepIdx];
  const [loadSummaryText, setLoadSummaryText] = useState<string>('');

  const resetLoadExistingRecordCount = useResetAtom(fromLoadRecordsState.loadExistingRecordCount);
  const resetSelectedSObjectState = useResetAtom(fromLoadRecordsState.selectedSObjectState);
  const resetLoadTypeState = useResetAtom(fromLoadRecordsState.loadTypeState);
  const resetInputFileDataState = useResetAtom(fromLoadRecordsState.inputFileDataState);
  const resetInputFileHeaderState = useResetAtom(fromLoadRecordsState.inputFileHeaderState);
  const resetInputFilenameState = useResetAtom(fromLoadRecordsState.inputFilenameState);
  const resetFieldMappingState = useResetAtom(fromLoadRecordsState.fieldMappingState);
  const resetFieldMappingTypeState = useResetAtom(fromLoadRecordsState.inputFilenameTypeState);
  const resetInputGoogleFile = useResetAtom(fromLoadRecordsState.inputGoogleFileState);
  const resetInputZipFileData = useResetAtom(fromLoadRecordsState.inputZipFileDataState);
  const resetInputZipFilename = useResetAtom(fromLoadRecordsState.inputZipFilenameState);

  const resetApiModeState = useResetAtom(fromLoadRecordsState.apiModeState);
  const resetBatchSizeState = useResetAtom(fromLoadRecordsState.batchSizeState);
  const resetInsertNullsState = useResetAtom(fromLoadRecordsState.insertNullsState);
  const resetSerialModeState = useResetAtom(fromLoadRecordsState.serialModeState);
  const resetTrialRunState = useResetAtom(fromLoadRecordsState.trialRunState);
  const resetTrialRunSizeState = useResetAtom(fromLoadRecordsState.trialRunSizeState);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isCustomMetadataObject) {
      setLoadType('UPSERT');
      setExternalId('DeveloperName');
    }
  }, [isCustomMetadataObject, setLoadType]);

  // On file change, reset load option state
  useEffect(() => {
    const apiMode = getRecommendedApiMode(inputFileData?.length || 0, !!inputZipFileData);
    setApiMode(apiMode);
    setBatchSize(getMaxBatchSize(apiMode));
    setSerialMode(apiMode === 'BATCH');

    resetInsertNullsState();
    resetTrialRunState();
    resetTrialRunSizeState();
  }, [
    inputFileData,
    inputZipFileData,
    resetTrialRunSizeState,
    resetTrialRunState,
    resetInsertNullsState,
    setApiMode,
    setBatchSize,
    setSerialMode,
  ]);

  // reset state when user leaves page
  useEffect(() => {
    return () => {
      if (didPerformDataLoad) {
        resetSelectedSObjectState();
        resetLoadTypeState();
        resetInputFileDataState();
        resetInputFileHeaderState();
        resetInputFilenameState();
        resetFieldMappingState();
        resetFieldMappingTypeState();
        resetInputGoogleFile();
        resetInputZipFileData();
        resetInputZipFilename();
        resetApiModeState();
        resetBatchSizeState();
        resetInsertNullsState();
        resetSerialModeState();
        resetTrialRunState();
        resetTrialRunSizeState();
      }
    };
  }, [
    didPerformDataLoad,
    resetFieldMappingState,
    resetInputFileDataState,
    resetInputFileHeaderState,
    resetInputFilenameState,
    resetLoadTypeState,
    resetSelectedSObjectState,
    resetFieldMappingTypeState,
    resetInputGoogleFile,
    resetInputZipFileData,
    resetInputZipFilename,
    resetApiModeState,
    resetBatchSizeState,
    resetInsertNullsState,
    resetSerialModeState,
    resetTrialRunState,
    resetTrialRunSizeState,
  ]);

  useEffect(() => {
    if (priorSelectedOrg && selectedOrg && selectedOrg.uniqueId !== priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      setCurrentStepIdx(0);
      resetLoadExistingRecordCount();
    } else {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  // Pre-select object from URL param (e.g. from browser extension popover) once sobjects are loaded
  useEffect(() => {
    if (!hasAppliedInitialObjectName && initialObjectName && sobjects?.length) {
      const matchedSobject = sobjects.find((sobject) => sobject.name === initialObjectName);
      if (matchedSobject) {
        setSelectedSObject(matchedSobject);
      }
      setHasAppliedInitialObjectName(true);
      setSearchParams(
        (prev) => {
          prev.delete('objectName');
          return prev;
        },
        { replace: true },
      );
    }
  }, [hasAppliedInitialObjectName, initialObjectName, sobjects, setSelectedSObject, setSearchParams]);

  const fetchFieldMetadata = useCallback(async () => {
    if (!selectedSObject) {
      return;
    }
    setLoadingFields(true);
    try {
      const fields = await getFieldMetadata(selectedOrg, selectedSObject.name);
      if (isMounted.current) {
        setFields(fields);
      }
    } catch (ex) {
      logger.warn('[LoadRecords] Failed to fetch field metadata', ex);
      if (isMounted.current) {
        fireToast({ message: 'There was a problem loading fields for this object. Try again or refresh the page.', type: 'error' });
      }
    } finally {
      if (isMounted.current) {
        setLoadingFields(false);
      }
    }
  }, [selectedOrg, selectedSObject]);

  useEffect(() => {
    if (selectedSObject) {
      resetLoadExistingRecordCount();
      fetchFieldMetadata();
    }
  }, [selectedSObject]);

  useEffect(() => {
    if (fields && inputFileHeader) {
      let tempFields = fields;
      if (loadType === 'INSERT') {
        tempFields = fields.filter((field) => field.name !== 'Id');
      } else if (loadType === 'DELETE' || loadType === 'HARD_DELETE') {
        tempFields = fields.filter((field) => field.name === 'Id');
      }
      setMappableFields(tempFields);
    }
  }, [fields, loadType, inputFileHeader]);

  useEffect(() => {
    if (mappableFields && inputFileHeader) {
      autoMapFields(selectedOrg, inputFileHeader, mappableFields, binaryAttachmentBodyField, loadType, externalId).then(setFieldMapping);
    }
  }, [mappableFields, inputFileHeader, loadType, setFieldMapping, binaryAttachmentBodyField, externalId, selectedOrg]);

  useEffect(() => {
    setExternalIdFields(fields.filter((field) => field.name === 'Id' || field.externalId));
  }, [fields]);

  // The reason doubles as the gate: the next-step button is disabled exactly when a reason exists,
  // so the explanation shown to the user can never drift from the conditions that block the step
  const { nextStepLabel, nextStepBlockedReason } = useMemo(() => {
    switch (currentStep.name) {
      case 'sobjectAndFile':
        return {
          nextStepLabel: 'Continue to Map Fields',
          nextStepBlockedReason: getSelectObjectAndFileBlockedReason({
            selectedSObject,
            inputFileData,
            loadType,
            externalId,
            loadingFields,
          }),
        };
      case 'fieldMapping':
        return {
          nextStepLabel: 'Continue to Load Records',
          nextStepBlockedReason: getFieldMappingBlockedReason({
            fieldMapping,
            loadType,
            externalId,
            isCustomMetadataObject: !!isCustomMetadataObject,
            allowBinaryAttachment: !!allowBinaryAttachment,
            inputZipFilename,
            binaryAttachmentBodyField,
          }),
        };
      default:
        return { nextStepLabel: 'No More Steps', nextStepBlockedReason: LAST_STEP_BLOCKED_REASON };
    }
  }, [
    currentStep,
    selectedSObject,
    inputFileData,
    loadType,
    externalId,
    loadingFields,
    fieldMapping,
    isCustomMetadataObject,
    allowBinaryAttachment,
    inputZipFilename,
    binaryAttachmentBodyField,
  ]);
  const nextStepDisabled = nextStepBlockedReason !== null;

  useEffect(() => {
    const text: string[] = [];

    if (selectedSObject) {
      if (loadType) {
        const appendExtId = externalId ? ` (${externalId})` : '';
        text.push(`${startCase(loadType.toLowerCase())}${appendExtId}`);
      }

      text.push(`Object: ${selectedSObject.label}`);

      if (inputFileData?.length) {
        text.push(`${formatNumber(inputFileData.length)} records impacted`);
      }

      if (inputFileHeader) {
        // Counts distinct file columns rather than mapped rows, otherwise static values and additional
        // mappings push the count above the number of columns in the file
        const mappedColumns = new Set(
          Object.values(fieldMapping)
            .filter((item) => item.type === 'CSV' && item.targetField)
            .map(({ csvField }) => csvField),
        );
        text.push(`${formatNumber(mappedColumns.size)} of ${formatNumber(inputFileHeader.length)} fields mapped`);
      }
    }

    setLoadSummaryText(text.join(' • '));
  }, [selectedSObject, loadType, fieldMapping, inputFileHeader, externalId]);

  function handleFileChange(
    data: any[],
    headers: string[],
    filename: string,
    type: LocalOrGoogle,
    googleFile?: Maybe<google.picker.DocumentObject>,
  ) {
    setInputFileData(data);
    setInputFileHeader(headers);
    setInputFilename(filename);
    setInputFilenameType(type);
    setInputGoogleFile(googleFile);
  }

  function handleZipFileChange(data: ArrayBuffer, filename: string) {
    setInputZipFileData(data);
    setInputZipFilename(filename);
  }

  function handleGoBackToPrev() {
    changeStep(-1);
    trackEvent(ANALYTICS_KEYS.load_GoBackToPrevStep, { step: currentStepIdx });
  }

  // Only completed steps are clickable in the progress indicator, so this is always backwards navigation
  function handleJumpToStep(stepIdx: number) {
    setCurrentStepIdx(stepIdx);
    trackEvent(ANALYTICS_KEYS.load_GoBackToPrevStep, { step: currentStepIdx, targetStep: stepIdx });
  }

  function changeStep(changeBy: number) {
    setCurrentStepIdx((priorStepIdx) => Math.min(Math.max(priorStepIdx + changeBy, 0), steps.length - 1));
    if (currentStepIdx === 0 && selectedSObject?.name) {
      recentHistoryItemsDb
        .addItemToRecentHistoryItems(selectedOrg.uniqueId, 'sobject', [selectedSObject.name])
        .catch((err) => logger.error('Error adding item to recent history items', err));
    }
  }

  // Cmd/Ctrl+Enter advances to the next step; mirrors the next-step button's disabled condition
  usePrimaryActionShortcut(() => changeStep(1), { disabled: nextStepDisabled || loading });
  // Cmd/Ctrl+Shift+Enter goes back one step; mirrors the go-back button's disabled condition
  useGoBackShortcut(handleGoBackToPrev, { disabled: currentStepIdx === 0 || loading });

  const handleIsLoading = useCallback((isLoading: boolean) => {
    setLoading(isLoading);
    setDidPerformDataLoad(true);
  }, []);

  function handleStartOver() {
    setCurrentStepIdx(0);
    resetSelectedSObjectState();
    resetLoadTypeState();
    resetInputFileDataState();
    resetInputFileHeaderState();
    resetInputFilenameState();
    resetFieldMappingState();
    setExternalId('');
    resetApiModeState();
    resetBatchSizeState();
    resetInsertNullsState();
    resetSerialModeState();
    resetTrialRunState();
    resetTrialRunSizeState();
    trackEvent(ANALYTICS_KEYS.load_StartOver, { page: currentStep.name });
  }

  async function handleFieldRefresh() {
    try {
      await clearCacheForOrg(selectedOrg);
      await fetchFieldMetadata();
    } catch (ex) {
      logger.warn('Error clearing cache and refreshing fields', ex);
    }
  }

  return (
    <Page testId="load-records-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'record_update' }} label="Load Records" docsPath={APP_ROUTES.LOAD.DOCS} />
          <PageHeaderActions colType="actions" buttonType="separate">
            <button
              data-testid="start-over-button"
              className="slds-button slds-button_neutral collapsible-button collapsible-button-md"
              title="Start Over"
              disabled={(currentStepIdx === 0 && !inputFileData && !selectedSObject) || loading}
              onClick={() => handleStartOver()}
            >
              <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
              <span>Start Over</span>
            </button>
            <Tooltip
              openDelay={500}
              content={
                <div className="slds-p-bottom_small">
                  <KeyboardShortcut inverse keys={[getModifierKey(), 'shift', 'enter']} />
                </div>
              }
            >
              <button
                data-testid="prev-step-button"
                className="slds-button slds-button_neutral"
                aria-keyshortcuts={getAriaKeyshortcuts([getModifierKey(), 'shift', 'enter'])}
                {...ariaDisabledButtonProps(currentStepIdx === 0 || loading, () => handleGoBackToPrev())}
              >
                <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" />
                Go Back To Previous Step
              </button>
            </Tooltip>
            <LoadRecordsNextStepButton
              label={nextStepLabel}
              blockedReason={nextStepBlockedReason}
              disabled={loading}
              loadingFields={loadingFields}
              onClick={() => changeStep(1)}
            />
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <div
            className="slds-page-header__col-meta"
            css={css`
              min-height: 19px;
            `}
          >
            <Grid verticalAlign="center">
              {loadSummaryText && <span className="slds-m-right_xx-small">{loadSummaryText} •</span>}
              <ViewDataHistoryLink />
            </Grid>
          </div>
          <LoadRecordsProgress currentStepIdx={currentStepIdx} steps={steps} disabled={loading} onStepChange={handleJumpToStep} />
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {currentStep.name === 'sobjectAndFile' && (
          <LoadRecordsSelectObjectAndFile
            hasGoogleDriveAccess={hasGoogleDriveAccess}
            googleShowUpgradeToPro={googleShowUpgradeToPro}
            googleApiConfig={googleApiConfig}
            selectedOrg={selectedOrg}
            sobjects={sobjects}
            selectedSObject={selectedSObject}
            isCustomMetadataObject={!!isCustomMetadataObject}
            loadType={loadType}
            externalIdFields={externalIdFields}
            loadingFields={loadingFields}
            externalId={externalId}
            inputFilename={inputFilename}
            inputFileType={inputFilenameType}
            inputGoogleFile={inputGoogleFile}
            allowBinaryAttachment={!!allowBinaryAttachment}
            binaryAttachmentBodyField={binaryAttachmentBodyField}
            inputZipFilename={inputZipFilename}
            onSobjects={setSobjects}
            onSelectedSobject={setSelectedSObject}
            onFileChange={handleFileChange}
            onZipFileChange={handleZipFileChange}
            onLoadTypeChange={setLoadType}
            onExternalIdChange={setExternalId}
          >
            <LoadRecordsDataPreview
              selectedOrg={selectedOrg}
              selectedSObject={selectedSObject}
              loadType={loadType}
              data={inputFileData}
              header={inputFileHeader}
            />
          </LoadRecordsSelectObjectAndFile>
        )}
        {currentStep.name === 'fieldMapping' && selectedSObject && inputFileHeader && inputFileData && (
          <span>
            <LoadRecordsFieldMapping
              org={selectedOrg}
              sobject={selectedSObject?.name}
              isCustomMetadataObject={!!isCustomMetadataObject}
              fields={mappableFields}
              inputHeader={inputFileHeader}
              fieldMapping={fieldMapping}
              fileData={inputFileData}
              loadType={loadType}
              externalId={externalId}
              binaryAttachmentBodyField={binaryAttachmentBodyField}
              onFieldMappingChange={setFieldMapping}
              onRefreshFields={handleFieldRefresh}
            />
          </span>
        )}
        {currentStep.name === 'loadRecords' && selectedSObject && inputFileData && (
          <span>
            {!isCustomMetadataObject ? (
              <PerformLoad
                selectedOrg={selectedOrg}
                orgType={orgType}
                selectedSObject={selectedSObject.name}
                inputFileHeader={inputFileHeader}
                loadType={loadType}
                fieldMapping={fieldMapping}
                inputFileData={inputFileData}
                inputZipFileData={inputZipFileData}
                externalId={externalId}
                onIsLoading={handleIsLoading}
              />
            ) : (
              <PerformLoadCustomMetadata
                selectedOrg={selectedOrg}
                orgType={orgType}
                selectedSObject={selectedSObject.name}
                inputFileHeader={inputFileHeader}
                fields={mappableFields}
                fieldMapping={fieldMapping}
                inputFileData={inputFileData}
                onIsLoading={handleIsLoading}
              />
            )}
          </span>
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default LoadRecords;
