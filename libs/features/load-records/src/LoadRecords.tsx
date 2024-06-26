import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { clearCacheForOrg } from '@jetstream/shared/data';
import { formatNumber, useTitle } from '@jetstream/shared/ui-utils';
import { FieldWithRelatedEntities, LocalOrGoogle, SalesforceOrgUi, Step } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Grid,
  GridCol,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  Spinner,
} from '@jetstream/ui';
import {
  applicationCookieState,
  autoMapFields,
  fromLoadRecordsState,
  getFieldMetadata,
  getMaxBatchSize,
  getRecommendedApiMode,
  selectedOrgState,
  selectedOrgType,
  useAmplitude,
} from '@jetstream/ui-core';
import startCase from 'lodash/startCase';
import { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue, useResetRecoilState, useSetRecoilState } from 'recoil';
import LoadRecordsDataPreview from './components/LoadRecordsDataPreview';
import LoadRecordsProgress from './components/LoadRecordsProgress';
import LoadRecordsFieldMapping from './steps/FieldMapping';
import LoadRecordsLoadAutomationDeploy from './steps/LoadRecordsAutomationDeploy';
import LoadRecordsLoadAutomationRollback from './steps/LoadRecordsAutomationRollback';
import PerformLoad from './steps/PerformLoad';
import PerformLoadCustomMetadata from './steps/PerformLoadCustomMetadata';
import LoadRecordsSelectObjectAndFile from './steps/SelectObjectAndFile';

const HEIGHT_BUFFER = 170;

const steps: Step[] = [
  { idx: 0, name: 'sobjectAndFile', label: 'Choose Object and Load File', active: true, enabled: true },
  { idx: 1, name: 'fieldMapping', label: 'Map Fields', active: false, enabled: true },
  { idx: 2, name: 'automationDeploy', label: 'Disable Automation (optional)', active: false, enabled: false },
  { idx: 3, name: 'loadRecords', label: 'Load Data', active: false, enabled: true },
  { idx: 4, name: 'automationRollback', label: 'Rollback Automation (optional)', active: false, enabled: false },
];

const enabledSteps: Step[] = steps.filter((step) => step.enabled);
const finalStep: Step = enabledSteps[enabledSteps.length - 1];

export interface LoadRecordsProps {
  featureFlags: Set<string>;
}

export const LoadRecords: FunctionComponent<LoadRecordsProps> = ({ featureFlags }) => {
  useTitle(TITLES.LOAD);
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const [{ defaultApiVersion, serverUrl, google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const googleApiConfig = useMemo(
    () => ({ apiKey: google_apiKey, appId: google_appId, clientId: google_clientId }),
    [google_apiKey, google_appId, google_clientId]
  );
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const orgType = useRecoilValue(selectedOrgType);
  // TODO: probably need this to know when to reset state
  const [priorSelectedOrg, setPriorSelectedOrg] = useRecoilState(fromLoadRecordsState.priorSelectedOrg);
  const [sobjects, setSobjects] = useRecoilState(fromLoadRecordsState.sObjectsState);
  const [selectedSObject, setSelectedSObject] = useRecoilState(fromLoadRecordsState.selectedSObjectState);
  const isCustomMetadataObject = useRecoilValue(fromLoadRecordsState.isCustomMetadataObject);
  const [loadType, setLoadType] = useRecoilState(fromLoadRecordsState.loadTypeState);
  const [fields, setFields] = useState<FieldWithRelatedEntities[]>([]);
  const [mappableFields, setMappableFields] = useState<FieldWithRelatedEntities[]>([]);
  const [externalIdFields, setExternalIdFields] = useState<FieldWithRelatedEntities[]>([]);
  const [externalId, setExternalId] = useState<string>('');
  const [inputFileData, setInputFileData] = useRecoilState(fromLoadRecordsState.inputFileDataState);
  const [inputFileHeader, setInputFileHeader] = useRecoilState(fromLoadRecordsState.inputFileHeaderState);
  const [inputFilename, setInputFilename] = useRecoilState(fromLoadRecordsState.inputFilenameState);
  const [inputFilenameType, setInputFilenameType] = useRecoilState(fromLoadRecordsState.inputFilenameTypeState);

  const [inputZipFileData, setInputZipFileData] = useRecoilState(fromLoadRecordsState.inputZipFileDataState);
  const [inputZipFilename, setInputZipFilename] = useRecoilState(fromLoadRecordsState.inputZipFilenameState);
  const allowBinaryAttachment = useRecoilValue(fromLoadRecordsState.selectAllowBinaryAttachment);
  const binaryAttachmentBodyField = useRecoilValue(fromLoadRecordsState.selectBinaryAttachmentBodyField);

  const [fieldMapping, setFieldMapping] = useRecoilState(fromLoadRecordsState.fieldMappingState);

  const setApiMode = useSetRecoilState(fromLoadRecordsState.apiModeState);
  const setBatchSize = useSetRecoilState(fromLoadRecordsState.batchSizeState);
  const setSerialMode = useSetRecoilState(fromLoadRecordsState.serialModeState);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingFields, setLoadingFields] = useState<boolean>(false);
  const [didPerformDataLoad, setDidPerformDataLoad] = useState<boolean>(false);

  const [currentStep, setCurrentStep] = useState<Step>(steps[0]);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [currentStepText, setCurrentStepText] = useState<string>('');
  const [nextStepDisabled, setNextStepDisabled] = useState<boolean>(true);
  const [hasNextStep, setHasNextStep] = useState<boolean>(true);
  const [loadSummaryText, setLoadSummaryText] = useState<string>('');

  const resetLoadExistingRecordCount = useResetRecoilState(fromLoadRecordsState.loadExistingRecordCount);
  const resetSelectedSObjectState = useResetRecoilState(fromLoadRecordsState.selectedSObjectState);
  const resetLoadTypeState = useResetRecoilState(fromLoadRecordsState.loadTypeState);
  const resetInputFileDataState = useResetRecoilState(fromLoadRecordsState.inputFileDataState);
  const resetInputFileHeaderState = useResetRecoilState(fromLoadRecordsState.inputFileHeaderState);
  const resetInputFilenameState = useResetRecoilState(fromLoadRecordsState.inputFilenameState);
  const resetFieldMappingState = useResetRecoilState(fromLoadRecordsState.fieldMappingState);
  const resetFieldMappingTypeState = useResetRecoilState(fromLoadRecordsState.inputFilenameTypeState);
  const resetInputZipFileData = useResetRecoilState(fromLoadRecordsState.inputZipFileDataState);
  const resetInputZipFilename = useResetRecoilState(fromLoadRecordsState.inputZipFilenameState);

  const resetApiModeState = useResetRecoilState(fromLoadRecordsState.apiModeState);
  const resetBatchSizeState = useResetRecoilState(fromLoadRecordsState.batchSizeState);
  const resetInsertNullsState = useResetRecoilState(fromLoadRecordsState.insertNullsState);
  const resetSerialModeState = useResetRecoilState(fromLoadRecordsState.serialModeState);
  const resetTrialRunState = useResetRecoilState(fromLoadRecordsState.trialRunState);
  const resetTrialRunSizeState = useResetRecoilState(fromLoadRecordsState.trialRunSizeState);

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
    resetBatchSizeState,
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
      setCurrentStep(steps[0]);
      resetLoadExistingRecordCount();
    } else {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  useEffect(() => {
    setCurrentStepIdx(enabledSteps.findIndex((step) => step.idx === currentStep.idx));
  }, [currentStep]);

  const fetchFieldMetadata = useCallback(async () => {
    if (!selectedSObject) {
      return;
    }
    setLoadingFields(true);
    const fields = await getFieldMetadata(selectedOrg, selectedSObject.name);
    // ensure object did not change and that component is still mounted
    if (isMounted.current) {
      setFields(fields);
      setLoadingFields(false);
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
      } else if (loadType === 'DELETE') {
        tempFields = fields.filter((field) => field.name === 'Id');
      }
      setMappableFields(tempFields);
    }
  }, [fields, loadType, inputFileHeader]);

  useEffect(() => {
    if (mappableFields && inputFileHeader) {
      setFieldMapping(autoMapFields(inputFileHeader, mappableFields, binaryAttachmentBodyField, loadType, externalId));
    }
  }, [mappableFields, inputFileHeader, loadType, setFieldMapping, binaryAttachmentBodyField, externalId]);

  useEffect(() => {
    setExternalIdFields(fields.filter((field) => field.name === 'Id' || field.externalId));
  }, [fields]);

  useEffect(() => {
    let currStepButtonText = '';
    let isNextStepDisabled = true;
    let hasNextStep = true;
    switch (currentStep.name) {
      case 'sobjectAndFile':
        currStepButtonText = 'Continue to Map Fields';
        isNextStepDisabled =
          !selectedSObject ||
          !inputFileData ||
          !inputFileData.length ||
          !loadType ||
          (loadType === 'UPSERT' && !externalId) ||
          loadingFields;
        hasNextStep = true;
        break;
      case 'fieldMapping':
        // currStepButtonText = 'Continue to Disable Automation';
        currStepButtonText = 'Continue to Load Records';
        // Ensure at least one field is mapped
        isNextStepDisabled = !fieldMapping || Object.values(fieldMapping).filter((field) => field.targetField).length === 0;
        // Ensure related fields are fully configured
        if (!isNextStepDisabled) {
          isNextStepDisabled = Object.values(fieldMapping).some((field) => field.mappedToLookup && !field.targetLookupField);
        }
        // Ensure required fields are mapped for custom metadata objects
        if (!isNextStepDisabled && isCustomMetadataObject) {
          isNextStepDisabled =
            !fieldMapping ||
            Object.values(fieldMapping).filter((field) => field.targetField === 'DeveloperName' || field.targetField === 'Label').length !==
              2;
        }
        if (!isNextStepDisabled && loadType === 'UPSERT') {
          isNextStepDisabled = !fieldMapping || !Object.values(fieldMapping).find((field) => field.targetField === externalId);
        }
        // ensure body field for binary attachments is mapped
        if (!isNextStepDisabled && allowBinaryAttachment && inputZipFilename) {
          isNextStepDisabled = !Object.values(fieldMapping).find((field) => field.targetField === binaryAttachmentBodyField);
        }
        hasNextStep = true;
        break;
      case 'automationDeploy':
        currStepButtonText = 'Continue to Load Records';
        isNextStepDisabled = false;
        hasNextStep = true;
        break;
      case 'loadRecords':
        // TODO: Only show this if automation was disabled
        // currStepButtonText = 'Continue to Rollback Automation';
        currStepButtonText = 'No More Steps';
        isNextStepDisabled = true;
        hasNextStep = false;
        break;
      // TODO: if we decide to add this back in, enable
      // case 'automationRollback':
      //   // TODO: Only show this if automation was disabled
      //   currStepButtonText = 'No More Steps';
      //   isNextStepDisabled = true;
      //   hasNextStep = false;
      //   break;
      default:
        currStepButtonText = currentStepText;
        isNextStepDisabled = nextStepDisabled;
        break;
    }
    setCurrentStepText(currStepButtonText);
    setNextStepDisabled(isNextStepDisabled);
    setHasNextStep(hasNextStep);
  }, [currentStep, selectedSObject, inputFileData, loadType, externalId, fieldMapping, loadingFields]);

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
        const fieldMappingItems = Object.values(fieldMapping);
        const numItemsMapped = fieldMappingItems.filter((item) => item.targetField).length;
        text.push(`${formatNumber(numItemsMapped)} of ${formatNumber(inputFileHeader.length)} fields mapped`);
      }
    }

    setLoadSummaryText(text.join(' • '));
  }, [selectedSObject, loadType, fieldMapping, inputFileHeader, externalId]);

  function handleFileChange(data: any[], headers: string[], filename: string, type: LocalOrGoogle) {
    setInputFileData(data);
    setInputFileHeader(headers);
    setInputFilename(filename);
    setInputFilenameType(type);
  }

  function handleZipFileChange(data: ArrayBuffer, filename: string) {
    setInputZipFileData(data);
    setInputZipFilename(filename);
  }

  function handleGoBackToPrev() {
    changeStep(-1);
    trackEvent(ANALYTICS_KEYS.load_GoBackToPrevStep, { step: currentStepIdx });
  }

  function changeStep(changeBy: number) {
    setCurrentStep(enabledSteps[currentStepIdx + changeBy]);
  }

  const handleIsLoading = useCallback((isLoading: boolean) => {
    setLoading(isLoading);
    setDidPerformDataLoad(true);
  }, []);

  function handleStartOver() {
    setCurrentStep(enabledSteps[0]);
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
          <PageHeaderTitle icon={{ type: 'standard', icon: 'data_streams' }} label="Load Records" docsPath="/load" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <button
              data-testid="start-over-button"
              className="slds-button slds-button_neutral collapsible-button collapsible-button-md"
              disabled={(currentStep.idx === 0 && !inputFileData && !selectedSObject) || loading}
              onClick={() => handleStartOver()}
            >
              <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
              <span>Start Over</span>
            </button>
            <button
              data-testid="prev-step-button"
              className="slds-button slds-button_neutral"
              disabled={currentStep.idx === 0 || loading}
              onClick={() => handleGoBackToPrev()}
            >
              <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" />
              Go Back To Previous Step
            </button>
            <button
              data-testid="next-step-button"
              className="slds-button slds-button_brand slds-is-relative"
              disabled={nextStepDisabled || loading}
              onClick={() => changeStep(1)}
            >
              {currentStepText}
              <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              {loadingFields && <Spinner size="small" />}
            </button>
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <div
            className="slds-page-header__col-meta"
            css={css`
              min-height: 19px;
            `}
          >
            {loadSummaryText}
          </div>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        <Grid gutters>
          <GridCol>
            {currentStep.name === 'sobjectAndFile' && (
              <LoadRecordsSelectObjectAndFile
                googleApiConfig={googleApiConfig}
                featureFlags={featureFlags}
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
            {currentStep.name === 'automationDeploy' && selectedSObject && (
              <span>
                <LoadRecordsLoadAutomationDeploy />
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
                    apiVersion={defaultApiVersion}
                    serverUrl={serverUrl}
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
            {currentStep.name === 'automationRollback' && (
              <span>
                <LoadRecordsLoadAutomationRollback />
              </span>
            )}
          </GridCol>
          <GridCol size={2}>
            <LoadRecordsProgress currentStepIdx={currentStepIdx} enabledSteps={enabledSteps} />
          </GridCol>
        </Grid>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default LoadRecords;
