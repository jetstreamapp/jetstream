/** @jsx jsx */
import { jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
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
import { startCase } from 'lodash';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState, selectedOrgType } from '../../app-state';
import { EntityParticleRecordWithRelatedExtIds, Step } from './load-records-types';
import * as fromLoadRecordsState from './load-records.state';
import LoadRecordsProgress from './components/LoadRecordsProgress';
import LoadRecordsFieldMapping from './steps/FieldMapping';
import LoadRecordsSelectObjectAndFile from './steps/SelectObjectAndFile';
import LoadRecordsPerformLoad from './steps/PerformLoad';
import LoadRecordsLoadAutomationDeploy from './steps/LoadRecordsAutomationDeploy';
import LoadRecordsLoadAutomationRollback from './steps/LoadRecordsAutomationRollback';
import { autoMapFields, getFieldMetadata } from './utils/load-records-utils';
import numeral from 'numeral';

const HEIGHT_BUFFER = 170;

const steps: Step[] = [
  { idx: 0, name: 'sobjectAndFile', label: 'Choose Object and Load File', active: true, enabled: true },
  { idx: 1, name: 'fieldMapping', label: 'Map Fields', active: false, enabled: true },
  { idx: 2, name: 'automationDeploy', label: 'Disable Automation (optional)', active: false, enabled: false },
  { idx: 3, name: 'loadRecords', label: 'Load Data', active: false, enabled: true },
  { idx: 4, name: 'automationRollback', label: 'Rollback Automation (optional)', active: false, enabled: false },
];

const enabledSteps: Step[] = steps.filter((step) => step.enabled);

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoadRecordsProps {}

export const LoadRecords: FunctionComponent<LoadRecordsProps> = () => {
  const isMounted = useRef(null);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const orgType = useRecoilValue(selectedOrgType);
  // TODO: probably need this to know when to reset state
  const [priorSelectedOrg, setPriorSelectedOrg] = useRecoilState(fromLoadRecordsState.priorSelectedOrg);
  const [sobjects, setSobjects] = useRecoilState(fromLoadRecordsState.sObjectsState);
  const [selectedSObject, setSelectedSObject] = useRecoilState(fromLoadRecordsState.selectedSObjectState);
  const [loadType, setLoadType] = useRecoilState(fromLoadRecordsState.loadTypeState);
  const [fields, setFields] = useState<EntityParticleRecordWithRelatedExtIds[]>([]);
  const [mappableFields, setMappableFields] = useState<EntityParticleRecordWithRelatedExtIds[]>([]);
  const [externalIdFields, setExternalIdFields] = useState<EntityParticleRecordWithRelatedExtIds[]>([]);
  const [externalId, setExternalId] = useState<string>('');
  const [inputFileData, setInputFileData] = useRecoilState(fromLoadRecordsState.inputFileDataState);
  const [inputFileHeader, setInputFileHeader] = useRecoilState(fromLoadRecordsState.inputFileHeaderState);
  const [inputFilename, setInputFilename] = useRecoilState(fromLoadRecordsState.inputFilenameState);
  const [fieldMapping, setFieldMapping] = useRecoilState(fromLoadRecordsState.fieldMappingState);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingFields, setLoadingFields] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [deployModalActive, setDeployModalActive] = useState<boolean>(false);

  const [currentStep, setCurrentStep] = useState<Step>(steps[0]);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [currentStepText, setCurrentStepText] = useState<string>('');
  const [nextStepDisabled, setNextStepDisabled] = useState<boolean>(true);
  const [hasNextStep, setHasNextStep] = useState<boolean>(true);
  const [loadSummaryText, setLoadSummaryText] = useState<string>('');

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    setCurrentStepIdx(enabledSteps.findIndex((step) => step.idx === currentStep.idx));
  }, [currentStep]);

  useEffect(() => {
    if (selectedSObject) {
      // fetch all fields
      setLoadingFields(true);
      (async () => {
        const { sobject, fields } = await getFieldMetadata(selectedOrg, selectedSObject.name);
        // ensure object did not change and that component is still mounted
        if (isMounted.current && selectedSObject.name === sobject) {
          setFields(fields);
          setLoadingFields(false);
        }
      })();
    }
  }, [selectedSObject]);

  useEffect(() => {
    if (fields && inputFileHeader) {
      let tempFields = fields;
      if (loadType === 'INSERT') {
        tempFields = fields.filter((field) => field.QualifiedApiName !== 'Id');
      } else if (loadType === 'DELETE') {
        tempFields = fields.filter((field) => field.QualifiedApiName === 'Id');
      }
      setMappableFields(tempFields);
    }
  }, [fields, loadType, inputFileHeader]);

  useEffect(() => {
    if (mappableFields && inputFileHeader) {
      setFieldMapping(autoMapFields(inputFileHeader, mappableFields));
    }
  }, [mappableFields, inputFileHeader, loadType, setFieldMapping]);

  useEffect(() => {
    setExternalIdFields(fields.filter((field) => field.IsIdLookup));
  }, [fields]);

  useEffect(() => {
    let currStepButtonText = '';
    let isNextStepDisabled = true;
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
        break;
      case 'fieldMapping':
        // currStepButtonText = 'Continue to Disable Automation';
        currStepButtonText = 'Continue to Load Records';
        isNextStepDisabled = !fieldMapping || Object.keys(fieldMapping).length === 0;
        break;
      case 'automationDeploy':
        currStepButtonText = 'Continue to Load Records';
        isNextStepDisabled = false;
        break;
      case 'loadRecords':
        // TODO: Only show this if automation was disabled
        // currStepButtonText = 'Continue to Rollback Automation';
        currStepButtonText = 'Done';
        isNextStepDisabled = true;
        setHasNextStep(false); // FIXME: this is temp solution to remove next arrow
        break;
      case 'automationRollback':
        // TODO: Only show this if automation was disabled
        currStepButtonText = 'Done';
        isNextStepDisabled = true;
        break;
      default:
        currStepButtonText = currentStepText;
        isNextStepDisabled = nextStepDisabled;
        break;
    }
    setCurrentStepText(currStepButtonText);
    setNextStepDisabled(isNextStepDisabled);
  }, [currentStep, selectedSObject, inputFileData, loadType, externalId, loadingFields]);

  useEffect(() => {
    const text: string[] = [];

    if (loadType) {
      text.push(`Load Type: ${startCase(loadType.toLowerCase())}`);
    }

    if (selectedSObject) {
      text.push(`Object: ${selectedSObject.label}`);
    }

    if (inputFileData?.length) {
      text.push(`${numeral(inputFileData.length).format('0,0')} records impacted`);
    }

    if (inputFileHeader) {
      const fieldMappingItems = Object.values(fieldMapping);
      const numItemsMapped = fieldMappingItems.filter((item) => item.targetField).length;
      text.push(`${numeral(numItemsMapped).format('0,0')} of ${numeral(inputFileHeader.length).format('0,0')} fields mapped`);
    }

    setLoadSummaryText(text.join(' • '));
  }, [selectedSObject, loadType, fieldMapping, inputFileHeader]);

  function handleFileChange(data: any[], headers: string[], filename: string) {
    setInputFileData(data);
    setInputFileHeader(headers);
    setInputFilename(filename);
  }

  function changeStep(changeBy: number) {
    setCurrentStep(enabledSteps[currentStepIdx + changeBy]);
  }

  function handleIsLoading(isLoading: boolean) {
    setLoading(isLoading);
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'data_streams' }} label="Load Records" />
          <PageHeaderActions colType="actions" buttonType="separate">
            {/* TODO: move to component since there is a bit of logic. */}
            <button className="slds-button slds-button_neutral" onClick={() => changeStep(-1)} disabled={currentStep.idx === 0 || loading}>
              <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" />
              Go Back To Previous Step
            </button>
            <button className="slds-button slds-button_brand slds-is-relative" onClick={() => changeStep(1)} disabled={nextStepDisabled}>
              {currentStepText}
              {hasNextStep && <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />}
              {loadingFields && <Spinner size="small" />}
            </button>
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <div className="slds-page-header__col-meta">{loadSummaryText}</div>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        <Grid gutters>
          <GridCol>
            {currentStep.name === 'sobjectAndFile' && (
              <LoadRecordsSelectObjectAndFile
                selectedOrg={selectedOrg}
                sobjects={sobjects}
                selectedSObject={selectedSObject}
                loadType={loadType}
                externalIdFields={externalIdFields}
                loadingFields={loadingFields}
                externalId={externalId}
                inputFilename={inputFilename}
                onSobjects={setSobjects}
                onSelectedSobject={setSelectedSObject}
                onFileChange={handleFileChange}
                onLoadTypeChange={setLoadType}
                onExternalIdChange={setExternalId}
              />
            )}
            {currentStep.name === 'fieldMapping' && (
              <span>
                <LoadRecordsFieldMapping
                  fields={mappableFields}
                  inputHeader={inputFileHeader}
                  fieldMapping={fieldMapping}
                  fileData={inputFileData}
                  onFieldMappingChange={setFieldMapping}
                />
              </span>
            )}
            {currentStep.name === 'automationDeploy' && (
              <span>
                <LoadRecordsLoadAutomationDeploy />
              </span>
            )}
            {currentStep.name === 'loadRecords' && (
              <span>
                <LoadRecordsPerformLoad
                  selectedOrg={selectedOrg}
                  orgType={orgType}
                  selectedSObject={selectedSObject.name}
                  loadType={loadType}
                  fieldMapping={fieldMapping}
                  inputFileData={inputFileData}
                  externalId={externalId}
                  onIsLoading={handleIsLoading}
                />
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