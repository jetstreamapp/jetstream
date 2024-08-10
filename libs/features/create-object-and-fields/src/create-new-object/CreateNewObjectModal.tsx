import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  EmptyState,
  Grid,
  GridCol,
  Icon,
  Modal,
  NoPreviewIllustration,
  PreviewIllustration,
  SalesforceLogin,
  Spinner,
  Tabs,
  TabsRef,
  Tooltip,
} from '@jetstream/ui';
import {
  ConfirmPageChange,
  DeployMetadataProgressSummary,
  DeployMetadataResultsTables,
  applicationCookieState,
  selectSkipFrontdoorAuth,
  useAmplitude,
} from '@jetstream/ui-core';
import { FunctionComponent, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { CreateNewObjectForm } from './CreateNewObjectForm';
import CreateNewObjectPermissions from './CreateNewObjectPermissions';
import CreateNewObjectPermissionsResult from './CreateNewObjectPermissionsResult';
import * as fromCreateObjectState from './create-object-state';
import useCreateObject, { getFriendlyStatus } from './useCreateObject';

export interface CreateNewObjectModalProps {
  selectedOrg: SalesforceOrgUi;
  initialSelectedProfiles?: string[];
  initialSelectedPermissionSets?: string[];
  onClose: (createdNewObject?: boolean) => void;
}

export const CreateNewObjectModal: FunctionComponent<CreateNewObjectModalProps> = ({ selectedOrg, onClose }) => {
  const { trackEvent } = useAmplitude();
  const [{ defaultApiVersion, serverUrl }] = useRecoilState(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);

  const modalRef = useRef();
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<TabsRef>();
  const [activeTab, setActiveTab] = useState('permissions');

  const apiNameWithoutNamespace = useRecoilValue(fromCreateObjectState.apiNameState);
  const createTab = useRecoilValue(fromCreateObjectState.createTabState);
  const selectedTabIcon = useRecoilValue(fromCreateObjectState.selectedTabIconState);
  const objectPermissions = useRecoilValue(fromCreateObjectState.objectPermissionsState);
  const selectedPermissionSets = useRecoilValue(fromCreateObjectState.selectedPermissionSetsState);
  const selectedProfiles = useRecoilValue(fromCreateObjectState.selectedProfilesState);
  const payload = useRecoilValue(fromCreateObjectState.payloadSelector);
  const { objectConfigIsValid, permissionsAreValid, allValid } = useRecoilValue(fromCreateObjectState.isFormValidSelector);

  const apiName = `${selectedOrg.orgNamespacePrefix ? `${selectedOrg.orgNamespacePrefix}__` : ''}${apiNameWithoutNamespace}`;

  const { results, deployMetadata, status, errorMessage, hasError, loading, permissionRecordResults } = useCreateObject({
    apiVersion: defaultApiVersion,
    serverUrl,
    selectedOrg,
  });

  async function handleDeploy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allValid || !payload) {
      return;
    }

    trackEvent(ANALYTICS_KEYS.sobj_create_object, {
      allowReports: payload.enableReports,
      allowActivities: payload.enableActivities,
      trackFieldHistory: payload.enableHistory,
      allowInChatterGroups: payload.allowInChatterGroups,
      allowSharingBulkStreaming: payload.enableBulkApi,
      allowSearch: payload.enableSearch,
      createTab: createTab,
      selectedProfiles: selectedProfiles.length,
      selectedPermissionSets: selectedPermissionSets.length,
    });

    tabsRef.current?.changeTab('results');
    await deployMetadata({
      apiName,
      createTab,
      tabMotif: selectedTabIcon,
      payload,
      objectPermissions,
      permissionSets: selectedPermissionSets,
      profiles: selectedProfiles,
    });
  }

  function handleCloseModal() {
    if (!loading) {
      onClose(!!results);
    }
  }

  function advanceTab() {
    let newTab = 'permissions';
    switch (activeTab) {
      case 'permissions':
        newTab = 'field';
        break;
      case 'field':
        newTab = 'results';
        break;
      default:
        break;
    }
    tabsRef?.current?.changeTab(newTab);
  }

  return (
    <>
      <ConfirmPageChange actionInProgress={loading} />
      <Modal
        closeOnEsc={false}
        closeOnBackdropClick={false}
        closeDisabled={loading}
        header="Create Object"
        ref={modalRef}
        footer={
          <Grid align="end">
            <div>
              <button className="slds-button slds-button_neutral" onClick={() => handleCloseModal()} disabled={loading}>
                Close
              </button>
              {activeTab !== 'results' && (
                <button className="slds-button slds-button_brand" onClick={advanceTab}>
                  Continue
                </button>
              )}
              {activeTab === 'results' && (
                <button className="slds-button slds-button_brand" form="create-object-form" type="submit" disabled={loading || !allValid}>
                  Create Object
                </button>
              )}
            </div>
          </Grid>
        }
        size="lg"
        onClose={handleCloseModal}
      >
        <div
          ref={modalBodyRef}
          css={css`
            height: 75vh;
          `}
        >
          <form id="create-object-form" onSubmit={handleDeploy}>
            <Tabs
              ref={tabsRef}
              onChange={(newTab) => setActiveTab(newTab)}
              tabs={[
                {
                  id: 'permissions',
                  title: (
                    <Grid verticalAlign="center">
                      <span>Permissions ({formatNumber(selectedProfiles.length + selectedPermissionSets.length)})</span>
                      {!permissionsAreValid && (
                        <Tooltip content="Permissions are not configured">
                          <Icon
                            className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-left_x-small"
                            type="utility"
                            icon="info"
                            description="Permissions are not configured"
                          />
                        </Tooltip>
                      )}
                    </Grid>
                  ),
                  titleText: 'Permissions',
                  content: <CreateNewObjectPermissions selectedOrg={selectedOrg} loading={loading} portalRef={modalRef.current} />,
                },
                {
                  id: 'field',
                  title: (
                    <Grid verticalAlign="center">
                      <span>Object Configuration</span>
                      {!objectConfigIsValid && (
                        <Tooltip content="Object is not configured">
                          <Icon
                            className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-left_x-small"
                            type="utility"
                            icon="info"
                            description="Object is not configured"
                          />
                        </Tooltip>
                      )}
                    </Grid>
                  ),
                  titleText: 'Object Configuration',
                  content: <CreateNewObjectForm loading={loading} />,
                },
                {
                  id: 'results',
                  title: (
                    <Grid verticalAlign="center">
                      <span>Results {getFriendlyStatus(status)}</span>
                      {loading && (
                        <div
                          css={css`
                            min-width: 1.5rem;
                          `}
                        >
                          <Spinner size="x-small" inline />
                        </div>
                      )}
                    </Grid>
                  ),
                  titleText: 'Results',
                  content: (
                    <Grid className="slds-is-relative h-100" wrap>
                      {loading && !results && <Spinner />}

                      {status === 'NOT_STARTED' && (
                        <GridCol size={12}>
                          {!allValid && (
                            <EmptyState headline="Go back and correct your configuration" illustration={<NoPreviewIllustration />} />
                          )}
                          {allValid && (
                            <EmptyState headline="Start your deployment to see results" illustration={<PreviewIllustration />} />
                          )}
                        </GridCol>
                      )}

                      {!results && hasError && (
                        <GridCol size={12}>
                          <div className="slds-text-color_error">
                            {errorMessage || 'Unknown error'}
                            <Icon
                              type="utility"
                              icon="error"
                              className="slds-icon slds-icon-text-error slds-icon_x-small slds-m-left_xx-small"
                              containerClassname="slds-icon_container slds-icon-utility-error"
                              description="There was an error with the deployment"
                            />
                          </div>
                        </GridCol>
                      )}

                      {status !== 'NOT_STARTED' && (
                        <GridCol size={12}>
                          <h2 className="slds-text-heading_medium slds-grow slds-m-bottom_xx-small">Object and Tab Results</h2>
                          {results?.success && (
                            <SalesforceLogin
                              serverUrl={serverUrl}
                              org={selectedOrg}
                              skipFrontDoorAuth={skipFrontDoorAuth}
                              returnUrl={`/lightning/setup/ObjectManager/${apiName}/Details/view`}
                              title={`View object in Salesforce setup`}
                              iconPosition="right"
                            >
                              View object in Salesforce setup
                            </SalesforceLogin>
                          )}
                        </GridCol>
                      )}

                      {results && (
                        <>
                          <GridCol size={2}>
                            <DeployMetadataProgressSummary
                              className="slds-m-right_large"
                              title="Deploy Results"
                              status={results.status}
                              totalProcessed={results.numberComponentsDeployed}
                              totalErrors={results.numberComponentErrors || results.details?.componentFailures.length || 0}
                              totalItems={results.numberComponentsTotal}
                            />
                          </GridCol>

                          <GridCol className="slds-scrollable_x">
                            <DeployMetadataResultsTables results={results} />
                          </GridCol>
                        </>
                      )}
                      {(permissionRecordResults || status === 'LOADING_PERMISSIONS') && (
                        <GridCol size={12} className="slds-is-relative slds-m-top_medium">
                          <h2 className="slds-text-heading_medium slds-grow slds-m-bottom_xx-small">Permission Results</h2>
                          {status === 'LOADING_PERMISSIONS' && <Spinner />}
                          {permissionRecordResults && <CreateNewObjectPermissionsResult recordResults={permissionRecordResults} />}
                        </GridCol>
                      )}
                    </Grid>
                  ),
                },
              ]}
            ></Tabs>
          </form>
        </div>
      </Modal>
    </>
  );
};

export default CreateNewObjectModal;
