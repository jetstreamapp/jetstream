import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { getNameOrNameAndLabel, pluralizeIfMultiple } from '@jetstream/shared/utils';
import {
  Accordion,
  AutoFullHeightContainer,
  Badge,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  RadioButton,
  RadioGroup,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DeploymentModal } from './deployment/DeploymentModal';
import { EditorAccordion } from './editor/EditorAccordion';
import { DeployButton } from './misc/DeployButton';
import { ViewMode } from './types/record-types.types';
import { useLoadRecordTypeData } from './utils/useLoadRecordTypeData';

const HEIGHT_BUFFER = 170;

export function RecordTypeManagerEditor() {
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const [viewMode, setViewMode] = useState<ViewMode>('RECORD_TYPE');
  const [deployModalOpen, setDeployModalOpen] = useState(false);

  const {
    loading,
    hasLoaded,
    hasLoadError,
    configurationErrorsByField,
    configurationErrorsByRecordType,
    recordTypeMetadataByFullName,
    objectMetadata,
    modifiedValues,
    resetData,
    dispatch,
  } = useLoadRecordTypeData();

  const configurationErrors = useMemo(() => {
    if (viewMode === 'FIELD') {
      return configurationErrorsByField;
    }
    return configurationErrorsByRecordType;
  }, [viewMode, configurationErrorsByField, configurationErrorsByRecordType]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleDeploy() {
    setDeployModalOpen(true);
  }

  function handleModalClose(didDeploy: boolean) {
    setDeployModalOpen(false);
    if (didDeploy) {
      resetData();
    }
  }

  function handleViewModeChange(value: ViewMode) {
    setViewMode(value);
    trackEvent(ANALYTICS_KEYS.record_type_picklist_toggle_view_mode, { viewMode: value });
  }

  return (
    <>
      {deployModalOpen && (
        <DeploymentModal
          modifiedValues={modifiedValues}
          recordTypeMetadataByFullName={recordTypeMetadataByFullName}
          viewMode={viewMode}
          onClose={handleModalClose}
        />
      )}
      <Page testId="record-type-manager-page">
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle
              icon={{ type: 'standard', icon: 'picklist_choice' }}
              label="Record Type Picklist Manager"
              docsPath={APP_ROUTES.RECORD_TYPE_MANAGER.DOCS}
            />
            <PageHeaderActions colType="actions" buttonType="separate">
              <Link className="slds-button slds-button_neutral" to="..">
                <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
                Go Back
              </Link>
              <DeployButton modifiedValues={modifiedValues} configurationErrors={configurationErrors} handleDeploy={handleDeploy} />
            </PageHeaderActions>
          </PageHeaderRow>
        </PageHeader>
        <AutoFullHeightContainer
          bottomBuffer={10}
          className="slds-p-around_x-small slds-scrollable_none"
          bufferIfNotRendered={HEIGHT_BUFFER}
        >
          {loading && <Spinner />}
          {hasLoadError && (
            <ScopedNotification theme="error">There was a problem loading the required data from Salesforce.</ScopedNotification>
          )}
          {hasLoaded && objectMetadata && (
            <div className="">
              <Accordion
                allowMultiple
                showExpandCollapseAll
                expandAllContainerClassName="slds-grid slds-grid_align-spread"
                expandAllExtraContent={
                  <RadioGroup isButtonGroup>
                    <RadioButton
                      id="view-mode-field"
                      name="view-mode-toggle"
                      label="View by Field"
                      value="FIELD"
                      checked={viewMode === 'FIELD'}
                      onChange={(value) => handleViewModeChange(value as ViewMode)}
                      disabled={loading}
                    />
                    <RadioButton
                      id="view-mode-record-type"
                      name="view-mode-toggle"
                      label="View by Record Type"
                      value="RECORD_TYPE"
                      checked={viewMode === 'RECORD_TYPE'}
                      onChange={(value) => handleViewModeChange(value as ViewMode)}
                      disabled={loading}
                    />
                  </RadioGroup>
                }
                expandAllClassName="slds-m-left_small"
                initOpenIds={[]}
                sections={Object.values(objectMetadata).map(({ sobjectName, sobjectLabel, picklistValues, recordTypeValues }) => ({
                  id: sobjectName,
                  title: getNameOrNameAndLabel(sobjectName, sobjectLabel),
                  titleSummaryIfCollapsed: (
                    <Badge className="slds-m-left_x-small slds-truncate">
                      {formatNumber(Object.keys(picklistValues).length)} {pluralizeIfMultiple('Field', Object.keys(picklistValues))}
                    </Badge>
                  ),
                  content: (
                    <EditorAccordion
                      picklistValues={picklistValues}
                      recordTypeValues={recordTypeValues}
                      errors={configurationErrors?.[sobjectName]}
                      viewMode={viewMode}
                      onSelectAll={(fieldName, recordType, value) => {
                        dispatch({
                          type: 'TOGGLE_SELECT_ALL',
                          payload: { sobjectName, fieldName, recordType, value },
                        });
                      }}
                      onSelect={(fieldName, recordType, picklistValue, value) => {
                        dispatch({
                          type: 'CHANGE_FIELD',
                          payload: {
                            sobjectName,
                            fieldName,
                            recordType,
                            picklistValue,
                            value,
                          },
                        });
                      }}
                      onChangeDefaultValue={(fieldName, recordType, value) => {
                        dispatch({
                          type: 'UPDATE_DEFAULT_VALUE',
                          payload: {
                            sobjectName,
                            fieldName,
                            recordType,
                            value,
                          },
                        });
                      }}
                    />
                  ),
                }))}
              />
            </div>
          )}
        </AutoFullHeightContainer>
      </Page>
    </>
  );
}
