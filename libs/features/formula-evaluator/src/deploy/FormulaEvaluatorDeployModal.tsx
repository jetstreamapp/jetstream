import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { useFetchPageLayouts, useProfilesAndPermSets } from '@jetstream/shared/ui-utils';
import { Field, Maybe, NullNumberBehavior, SalesforceOrgUi } from '@jetstream/types';
import { FileDownloadModal, Grid, Icon, Modal, ScopedNotification, Spinner, Tabs, Tooltip, fireToast } from '@jetstream/ui';
import {
  ConfirmPageChange,
  FieldValues,
  applicationCookieState,
  fromJetstreamEvents,
  getInitialValues,
  getSecondaryTypeFromType,
  prepareDownloadResultsFile,
  useAmplitude,
  useCreateFields,
} from '@jetstream/ui-core';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import FormulaEvaluatorDeploySummary from './FormulaEvaluatorDeploySummary';
import FormulaEvaluatorFields from './FormulaEvaluatorFields';
import FormulaEvaluatorPageLayouts from './FormulaEvaluatorPageLayouts';
import FormulaEvaluatorPermissions from './FormulaEvaluatorPermissions';

type Tab = 'field' | 'permissions' | 'layouts' | 'results';

export interface FormulaEvaluatorDeployModalProps {
  selectedOrg: SalesforceOrgUi;
  sobject: string;
  selectedField?: Maybe<Field>;
  formula: string;
  numberNullBehaviorState: NullNumberBehavior;
  onClose: () => void;
}

export const FormulaEvaluatorDeployModal = ({
  selectedOrg,
  sobject,
  selectedField,
  formula,
  numberNullBehaviorState,
  onClose,
}: FormulaEvaluatorDeployModalProps) => {
  const { trackEvent } = useAmplitude();
  const [{ defaultApiVersion, serverUrl, google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const [fieldValid, setIsFieldValid] = useState(!!selectedField);
  const [sObjects] = useState([sobject]);

  const [field, setField] = useState<FieldValues>(() => {
    const value = getInitialValues(0);
    value.label.value = selectedField?.label || '';
    value.fullName.value = (selectedField?.name || '').replace('__c', '');
    value.type.value = 'Formula';
    value.inlineHelpText.value = selectedField?.inlineHelpText || '';
    value.description.value = (selectedField as any)?.description || '';
    value.formula.value = formula;
    value.formulaTreatBlanksAs.value = numberNullBehaviorState === 'BLANK' ? 'Blanks' : 'BlankAsZero';
    value.secondaryType.value = selectedField?.type ? getSecondaryTypeFromType(selectedField.type) : 'Text';
    value.precision.value = selectedField?.precision || '18';
    value.scale.value = selectedField?.scale || '0';
    return value;
  });

  const [activeTab, setActiveTab] = useState<Tab>('field');
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [selectedPermissionSets, setSelectedPermissionSets] = useState<string[]>([]);

  const permissionData = useProfilesAndPermSets(selectedOrg);
  const layoutData = useFetchPageLayouts(selectedOrg, sObjects);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportData, setExportModalData] = useState<{
    worksheetData: Record<string, any[]>;
    headerData: Record<string, any[]>;
  } | null>(null);

  const { deployFields, prepareFields, clearResults, deployed, fatalError, fatalErrorMessage, layoutErrorMessage, loading, results } =
    useCreateFields({
      apiVersion: defaultApiVersion,
      serverUrl,
      selectedOrg,
      permissionSets: selectedPermissionSets,
      profiles: selectedProfiles,
      sObjects,
    });

  useEffect(() => {
    clearResults();
  }, [field, selectedProfiles, selectedPermissionSets, layoutData.selectedLayoutIds, clearResults]);

  function onFieldChange(field: FieldValues, isValid: boolean) {
    setField(field);
    setIsFieldValid(isValid);
  }

  async function handleActionClick() {
    switch (activeTab) {
      case 'field':
        setActiveTab('permissions');
        break;
      case 'permissions':
        setActiveTab('layouts');
        break;
      case 'layouts':
        setActiveTab('results');
        break;
      case 'results':
        deploy();
        break;

      default:
        break;
    }
  }

  async function deploy() {
    try {
      const prepareResults = await prepareFields([field]);
      if (!prepareResults) {
        fireToast({ type: 'error', message: 'There was an error preparing your field for deployment.' });
        return;
      }
      await deployFields(prepareResults, Array.from(layoutData.selectedLayoutIds));
      trackEvent(ANALYTICS_KEYS.formula_export_results, {
        success: true,
        permissionCount: selectedProfiles.length + selectedPermissionSets.length,
        layoutCount: layoutData.selectedLayoutIds.size,
      });
    } catch (ex) {
      fireToast({ type: 'error', message: 'There was an error preparing your field for deployment.' });
      trackEvent(ANALYTICS_KEYS.formula_export_results, {
        success: false,
        permissionCount: selectedProfiles.length + selectedPermissionSets.length,
        layoutCount: layoutData.selectedLayoutIds.size,
      });
    }
  }

  function downloadResults() {
    setExportModalData(prepareDownloadResultsFile(results, [field], permissionData.profilesAndPermSetsById));
    setExportModalOpen(true);
    trackEvent(ANALYTICS_KEYS.formula_export_deploy);
  }

  function handleDownloadResultsModalClosed() {
    setExportModalData(null);
    setExportModalOpen(false);
  }

  const actionButtonDisabled = loading || (activeTab === 'results' && !fieldValid);

  let deployLabel = 'Next';
  if (activeTab === 'results' && results?.[0]?.state === 'SUCCESS') {
    deployLabel = 'Deploy Again';
  } else if (activeTab === 'results') {
    deployLabel = 'Deploy';
  }

  return (
    <>
      <ConfirmPageChange actionInProgress={loading} />
      {exportModalOpen && exportData && (
        <FileDownloadModal
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          modalHeader="Download Results"
          data={exportData.worksheetData}
          header={exportData.headerData}
          fileNameParts={['create-fields']}
          allowedTypes={['xlsx']}
          onModalClose={handleDownloadResultsModalClosed}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      {!exportModalOpen && (
        <Modal
          header="Save Field"
          tagline="Field will be upserted based on the Field Name."
          size="md"
          closeOnEsc={false}
          closeDisabled={loading}
          footer={
            <Grid align="spread">
              <div>
                {!loading && results?.[0]?.state === 'SUCCESS' && (
                  <button className="slds-button slds-button_neutral" onClick={() => downloadResults()} disabled={loading || !deployed}>
                    <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Download Results
                  </button>
                )}
              </div>
              <div>
                <button className="slds-button slds-button_neutral" onClick={() => onClose()} disabled={loading}>
                  Close
                </button>
                <button className="slds-button slds-button_brand" disabled={actionButtonDisabled} onClick={() => handleActionClick()}>
                  {deployLabel}
                </button>
              </div>
            </Grid>
          }
          onClose={onClose}
        >
          <div
            className="slds-is-relative"
            css={css`
              min-height: 550px;
            `}
          >
            {loading && <Spinner />}
            {fatalError && <ScopedNotification theme="error">{fatalErrorMessage || 'An unknown error occurred.'}</ScopedNotification>}
            {!loading && results?.[0]?.errorMessage && <ScopedNotification theme="error">{results[0].errorMessage}</ScopedNotification>}
            {layoutErrorMessage && (
              <ScopedNotification theme="warning">{layoutErrorMessage || 'An unknown error occurred.'}</ScopedNotification>
            )}
            {!loading && results?.[0]?.flsErrorMessage && (
              <ScopedNotification theme="warning">{results[0].flsErrorMessage}</ScopedNotification>
            )}
            {!loading && results?.[0]?.state === 'SUCCESS' && (
              <ScopedNotification theme="success">
                Your field has been successfully {results?.[0].operation === 'UPSERT' ? 'updated' : 'created'}.
              </ScopedNotification>
            )}

            <Tabs
              initialActiveId={activeTab}
              contentClassname="slds-p-bottom_none"
              onChange={(value) => {
                setActiveTab(value as Tab);
              }}
              tabs={[
                {
                  id: 'field',
                  title: (
                    <Grid verticalAlign="center">
                      <span>Field</span>
                      {fieldValid ? (
                        <Tooltip content="Field is configured">
                          <Icon
                            type="utility"
                            icon="success"
                            description="Configured successfully"
                            title="Configured successfully"
                            className="slds-icon slds-icon_x-small slds-icon-text-success"
                            containerClassname="slds-icon_container slds-icon-utility-success slds-m-left_x-small"
                          />
                        </Tooltip>
                      ) : (
                        <Tooltip content="Field is not yet configured">
                          <Icon
                            type="utility"
                            icon="error"
                            className="slds-icon slds-icon-text-error slds-icon_xx-small"
                            containerClassname="slds-icon_container slds-icon-utility-error slds-m-left_x-small"
                            description="Field is not yet configured"
                          />
                        </Tooltip>
                      )}
                    </Grid>
                  ),
                  titleText: 'Field',
                  content: <FormulaEvaluatorFields formula={formula} field={field} loading={loading} onFieldChange={onFieldChange} />,
                },
                {
                  id: 'permissions',
                  title: (
                    <Grid verticalAlign="center">
                      <span>Field Permissions ({selectedProfiles.length + selectedPermissionSets.length})</span>
                    </Grid>
                  ),
                  titleText: 'Field Permissions',
                  content: (
                    <FormulaEvaluatorPermissions
                      hasError={permissionData.hasError}
                      lastRefreshed={permissionData.lastRefreshed}
                      loading={permissionData.loading}
                      profiles={permissionData.profiles}
                      permissionSets={permissionData.permissionSets}
                      selectedPermissionSets={selectedPermissionSets}
                      selectedProfiles={selectedProfiles}
                      fetchMetadata={permissionData.fetchMetadata}
                      onSelectedPermissionSetChange={setSelectedPermissionSets}
                      onSelectedProfileChange={setSelectedProfiles}
                    />
                  ),
                },
                {
                  id: 'layouts',
                  title: (
                    <Grid verticalAlign="center">
                      <span>Page Layouts ({layoutData.selectedLayoutIds.size})</span>
                    </Grid>
                  ),
                  titleText: 'Page Layouts',
                  content: (
                    <FormulaEvaluatorPageLayouts
                      sobjectName={sobject}
                      error={layoutData.error}
                      handleSelectLayout={layoutData.handleSelectLayout}
                      handleSelectAll={layoutData.handleSelectAll}
                      layouts={layoutData.layouts}
                      loading={layoutData.loading}
                      selectedLayoutIds={layoutData.selectedLayoutIds}
                      disabled={loading}
                    />
                  ),
                },
                {
                  id: 'results',
                  title: (
                    <Grid verticalAlign="center">
                      <span>Deploy Field</span>
                      {results?.[0]?.state === 'SUCCESS' && (
                        <Icon
                          type="utility"
                          icon="success"
                          description="Configured successfully"
                          title="Configured successfully"
                          className="slds-icon slds-icon_x-small slds-icon-text-success"
                          containerClassname="slds-icon_container slds-icon-utility-success slds-m-left_x-small"
                        />
                      )}
                      {results?.[0]?.state === 'FAILED' && (
                        <Icon
                          type="utility"
                          icon="error"
                          className="slds-icon slds-icon-text-error slds-icon_xx-small"
                          containerClassname="slds-icon_container slds-icon-utility-error slds-m-left_x-small"
                          description="Field is not yet configured"
                        />
                      )}
                    </Grid>
                  ),
                  titleText: 'Deploy Field',
                  content: (
                    <FormulaEvaluatorDeploySummary
                      selectedOrg={selectedOrg}
                      sobject={sobject}
                      field={field}
                      deployed={deployed}
                      results={results?.[0]}
                      selectedProfiles={selectedProfiles.map((item) => {
                        const record = permissionData.profilesAndPermSetsById[item];
                        return {
                          id: record.Id,
                          label: record.IsOwnedByProfile ? record.Profile.Name : record.Name,
                        };
                      })}
                      selectedPermissionSets={selectedPermissionSets.map((item) => {
                        const record = permissionData.profilesAndPermSetsById[item];
                        return {
                          id: record.Id,
                          label: record.IsOwnedByProfile ? record.Profile.Name : record.Name,
                        };
                      })}
                      selectedLayouts={Array.from(layoutData.selectedLayoutIds).map((item) => ({
                        id: layoutData.layoutsById[item].Id,
                        label: layoutData.layoutsById[item].Name,
                      }))}
                    />
                  ),
                },
              ]}
            />
          </div>
        </Modal>
      )}
    </>
  );
};

export default FormulaEvaluatorDeployModal;
