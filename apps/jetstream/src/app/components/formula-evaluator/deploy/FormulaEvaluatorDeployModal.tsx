import { css } from '@emotion/react';
import { useFetchPageLayouts, useProfilesAndPermSets } from '@jetstream/shared/ui-utils';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Grid, Icon, Modal, ScopedNotification, Spinner, Tabs, Tooltip } from '@jetstream/ui';
import type { Field } from 'jsforce';
import { useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../app-state';
import { fireToast } from '../../core/AppToast';
import { FieldValues } from '../../shared/create-fields/create-fields-types';
import { getInitialValues, getSecondaryTypeFromType } from '../../shared/create-fields/create-fields-utils';
import useCreateFields from '../../shared/create-fields/useCreateFields';
import { NullNumberBehavior } from '../formula-evaluator.state';
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

  const { deployFields, prepareFields, fatalError, fatalErrorMessage, layoutErrorMessage, loading, results } = useCreateFields({
    apiVersion: defaultApiVersion,
    serverUrl,
    selectedOrg,
    permissionSets: selectedPermissionSets,
    profiles: selectedProfiles,
    sObjects,
  });

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
    } catch (ex) {
      fireToast({ type: 'error', message: 'There was an error preparing your field for deployment.' });
    }
  }

  const actionButtonDisabled = loading || (activeTab === 'results' && !fieldValid);

  return (
    <Modal
      header="Save Field"
      tagline="Field will be upserted based on the Field Name."
      size="md"
      footer={
        <>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" disabled={actionButtonDisabled} onClick={() => handleActionClick()}>
            {activeTab !== 'results' ? 'Next' : 'Deploy'}
          </button>
        </>
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
        {layoutErrorMessage && (
          <ScopedNotification theme="warning">{layoutErrorMessage || 'An unknown error occurred.'}</ScopedNotification>
        )}
        {!loading && results?.[0]?.flsErrorMessage && <ScopedNotification theme="warning">{results[0].flsErrorMessage}</ScopedNotification>}
        {!loading && results && <ScopedNotification theme="success">Your field has been successfully deployed.</ScopedNotification>}

        <Tabs
          initialActiveId={activeTab}
          contentClassname="slds-p-bottom_none"
          onChange={(value: Tab) => setActiveTab(value)}
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
              content: <FormulaEvaluatorFields formula={formula} field={field} loading={loading} onFieldChange={onFieldChange} />,
            },
            {
              id: 'permissions',
              title: (
                <Grid verticalAlign="center">
                  <span>Field Permissions</span>
                  {(!!selectedProfiles.length || !!selectedPermissionSets.length) && (
                    <Tooltip content="Permissions are configured">
                      <Icon
                        type="utility"
                        icon="success"
                        description="Configured successfully"
                        title="Configured successfully"
                        className="slds-icon slds-icon_x-small slds-icon-text-success"
                        containerClassname="slds-icon_container slds-icon-utility-success slds-m-left_x-small"
                      />
                    </Tooltip>
                  )}
                </Grid>
              ),
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
                  <span>Page Layouts</span>
                  {!!layoutData.selectedLayoutIds.size && (
                    <Tooltip content="Layouts are configured">
                      <Icon
                        type="utility"
                        icon="success"
                        description="Configured successfully"
                        title="Configured successfully"
                        className="slds-icon slds-icon_x-small slds-icon-text-success"
                        containerClassname="slds-icon_container slds-icon-utility-success slds-m-left_x-small"
                      />
                    </Tooltip>
                  )}
                </Grid>
              ),
              content: (
                <FormulaEvaluatorPageLayouts
                  sobjectName={sobject}
                  error={layoutData.error}
                  handleSelectLayout={layoutData.handleSelectLayout}
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
                  {results && !fatalError && (
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
                  )}
                </Grid>
              ),
              content: (
                <FormulaEvaluatorDeploySummary
                  field={field}
                  selectedProfiles={selectedProfiles.map((item) => {
                    const record = permissionData.profilesAndPermSetsById[item];
                    return record?.IsOwnedByProfile ? record.Profile.Name : record.Name;
                  })}
                  selectedPermissionSets={selectedPermissionSets.map((item) => {
                    const record = permissionData.profilesAndPermSetsById[item];
                    return record?.IsOwnedByProfile ? record.Profile.Name : record.Name;
                  })}
                  selectedLayouts={Array.from(layoutData.selectedLayoutIds).map((item) => layoutData.layoutsById[item].Name)}
                />
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
};

export default FormulaEvaluatorDeployModal;
