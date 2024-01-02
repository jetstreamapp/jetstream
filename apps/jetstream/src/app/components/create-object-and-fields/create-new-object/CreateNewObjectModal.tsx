import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { EmptyState, Grid, GridCol, Icon, Modal, PreviewIllustration, SalesforceLogin, Spinner, Tabs, TabsRef } from '@jetstream/ui';
import { FunctionComponent, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { applicationCookieState } from '../../../app-state';
import ConfirmPageChange from '../../core/ConfirmPageChange';
import { useAmplitude } from '../../core/analytics';
import DeployMetadataProgressSummary from '../../deploy/utils/DeployMetadataProgressSummary';
import DeployMetadataResultsTables from '../../deploy/utils/DeployMetadataResultsTables';
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

  const modalRef = useRef();
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<TabsRef>();

  const apiNameWithoutNamespace = useRecoilValue(fromCreateObjectState.apiNameState);
  const createTab = useRecoilValue(fromCreateObjectState.createTabState);
  const selectedTabIcon = useRecoilValue(fromCreateObjectState.selectedTabIconState);
  const objectPermissions = useRecoilValue(fromCreateObjectState.objectPermissionsState);
  const selectedPermissionSets = useRecoilValue(fromCreateObjectState.selectedPermissionSetsState);
  const selectedProfiles = useRecoilValue(fromCreateObjectState.selectedProfilesState);
  const payload = useRecoilValue(fromCreateObjectState.payloadSelector);
  const isValid = useRecoilValue(fromCreateObjectState.isFormValid);

  const apiName = `${selectedOrg.orgNamespacePrefix ? `${selectedOrg.orgNamespacePrefix}__` : ''}${apiNameWithoutNamespace}`;

  const { results, deployMetadata, status, errorMessage, hasError, loading, permissionRecordResults } = useCreateObject({
    apiVersion: defaultApiVersion,
    serverUrl,
    selectedOrg,
  });

  async function handleDeploy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid || !payload) {
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

  return (
    <>
      <ConfirmPageChange actionInProgress={loading} />
      <Modal
        closeOnEsc={false}
        closeOnBackdropClick={false}
        header="Create Object"
        ref={modalRef}
        footer={
          <Grid align="end">
            <div>
              <button className="slds-button slds-button_neutral" onClick={() => handleCloseModal()} disabled={loading}>
                Close
              </button>
              <button className="slds-button slds-button_brand" form="create-object-form" type="submit" disabled={loading || !isValid}>
                Create Object
              </button>
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
              tabs={[
                {
                  id: 'permissions',
                  title: (
                    <Grid verticalAlign="center">
                      <span>Permissions ({formatNumber(selectedProfiles.length + selectedPermissionSets.length)})</span>
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
                    </Grid>
                  ),
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
                          <EmptyState headline="Start your deployment to see results" illustration={<PreviewIllustration />}></EmptyState>
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
