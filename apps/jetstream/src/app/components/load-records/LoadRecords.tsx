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
import { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';
import { EntityParticleRecordWithRelatedExtIds } from './load-records-types';
import * as fromLoadRecordsState from './load-records.state';
import LoadRecordsProgress from './LoadRecordsProgress';
import LoadRecordsFieldMapping from './steps/LoadRecordsFieldMapping';
import LoadRecordsObjectAndFile from './steps/LoadRecordsObjectAndFile';
import LoadRecordsLoadRecords from './steps/LoadRecordsLoadRecords';
import LoadRecordsLoadAutomationDeploy from './steps/LoadRecordsLoadAutomationDeploy';
import LoadRecordsLoadAutomationRollback from './steps/LoadRecordsLoadAutomationRollback';
import { autoMapFields, getFieldMetadata } from './utils/load-records-utils';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoadRecordsProps {}

export const LoadRecords: FunctionComponent<LoadRecordsProps> = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
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
  const [fieldMapping, setFieldMapping] = useRecoilState(fromLoadRecordsState.fieldMappingState);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingFields, setLoadingFields] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [deployModalActive, setDeployModalActive] = useState<boolean>(false);

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [currentStepText, setCurrentStepText] = useState<string>('');
  const [nextStepDisabled, setNextStepDisabled] = useState<boolean>(true);
  const [loadSummaryText, setLoadSummaryText] = useState<string>('');

  useEffect(() => {
    let isSubscribed = true;
    if (selectedSObject) {
      // fetch all fields
      setLoadingFields(true);
      (async () => {
        const { sobject, fields } = await getFieldMetadata(selectedOrg, selectedSObject.name);
        // ensure object did not change and that component is still mounted
        if (isSubscribed && selectedSObject.name === sobject) {
          setFields(fields);
          setLoadingFields(false);
        }
      })();
    }
    return () => (isSubscribed = false);
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
    switch (currentStep) {
      case 0:
        currStepButtonText = 'Continue to Map Fields';
        isNextStepDisabled =
          !selectedSObject ||
          !inputFileData ||
          !inputFileData.length ||
          !loadType ||
          (loadType === 'UPSERT' && !externalId) ||
          loadingFields;
        break;
      case 1:
        // TODO: Allow skipping this step
        currStepButtonText = 'Continue to Disable Automation';
        isNextStepDisabled = !fieldMapping || Object.keys(fieldMapping).length === 0;
        break;
      case 2:
        currStepButtonText = 'Continue to Load Records';
        isNextStepDisabled = false;
        break;
      case 3:
        // TODO: Only show this if automation was disabled
        currStepButtonText = 'Continue to Rollback Automation';
        isNextStepDisabled = false;
        break;
      case 4:
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

    if (inputFileHeader) {
      const fieldMappingItems = Object.values(fieldMapping);
      const numItemsMapped = fieldMappingItems.filter((item) => item.targetField).length;
      text.push(`${numItemsMapped} of ${inputFileHeader.length} fields mapped`);
    }

    setLoadSummaryText(text.join(' • '));
  }, [selectedSObject, loadType, fieldMapping, inputFileHeader]);

  function handleFileChange(data: any[], headers: string[]) {
    setInputFileData(data);
    setInputFileHeader(headers);
    // TODO: fetch fields (useEffect)
    // set external ids (useEffect)
  }

  return (
    <Page>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'data_streams' }} label="Load Records" />
          <PageHeaderActions colType="actions" buttonType="separate">
            {/* TODO: move to component since there is a bit of logic. */}
            <button
              className="slds-button slds-button_neutral"
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={currentStep === 0 || loading}
            >
              <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" />
              Go Back To Previous Step
            </button>
            <button
              className="slds-button slds-button_brand slds-is-relative"
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={nextStepDisabled}
            >
              {currentStepText}
              <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
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
            {currentStep === 0 && (
              <LoadRecordsObjectAndFile
                selectedOrg={selectedOrg}
                sobjects={sobjects}
                selectedSObject={selectedSObject}
                loadType={loadType}
                externalIdFields={externalIdFields}
                loadingFields={loadingFields}
                externalId={externalId}
                onSobjects={setSobjects}
                onSelectedSobject={setSelectedSObject}
                onFileChange={handleFileChange}
                onLoadTypeChange={setLoadType}
                onExternalIdChange={setExternalId}
              />
            )}
            {currentStep === 1 && (
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
            {currentStep === 2 && (
              <span>
                <LoadRecordsLoadAutomationDeploy />
              </span>
            )}
            {currentStep === 3 && (
              <span>
                <LoadRecordsLoadRecords
                  selectedOrg={selectedOrg}
                  selectedSObject={selectedSObject.name}
                  loadType={loadType}
                  fieldMapping={fieldMapping}
                  inputFileData={inputFileData}
                />
              </span>
            )}
            {currentStep === 4 && (
              <span>
                <LoadRecordsLoadAutomationRollback />
              </span>
            )}
          </GridCol>
          <GridCol size={2}>
            <LoadRecordsProgress
              currentStep={currentStep}
              hasFileData={!!inputFileData?.length}
              hasSelectedObject={!!selectedSObject}
              loadType={loadType}
              hasExternalId={!!externalId}
            />
          </GridCol>
        </Grid>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default LoadRecords;
