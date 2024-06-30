import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { PermissionSetNoProfileRecord, PermissionSetWithProfileRecord, SalesforceOrgUi } from '@jetstream/types';
import { ConfirmationModalPromise, FileDownloadModal, Grid, Icon, Modal, ScopedNotification, Tabs } from '@jetstream/ui';
import {
  ConfirmPageChange,
  FieldValues,
  applicationCookieState,
  fromJetstreamEvents,
  prepareDownloadResultsFile,
  useAmplitude,
  useCreateFields,
} from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import CreateFieldsDeployModalDeployment from './CreateFieldsDeployModalDeployment';
import CreateFieldsDeployModalPermissions from './CreateFieldsDeployModalPermissions';

export interface CreateFieldsDeployModalProps {
  selectedOrg: SalesforceOrgUi;
  profiles: string[];
  permissionSets: string[];
  profilesAndPermSetsById: Record<string, PermissionSetWithProfileRecord | PermissionSetNoProfileRecord>;
  sObjects: string[];
  rows: FieldValues[];
  onClose: () => void;
}

export const CreateFieldsDeployModal: FunctionComponent<CreateFieldsDeployModalProps> = ({
  selectedOrg,
  profiles,
  permissionSets,
  profilesAndPermSetsById,
  sObjects,
  rows,
  onClose,
}) => {
  const { trackEvent } = useAmplitude();
  const [{ defaultApiVersion, serverUrl, google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const [selectedLayoutIds, setSelectedLayoutIds] = useState(new Set<string>());
  const [selectedPermissions, setSelectedPermissions] = useState<any>({});

  // const {
  //   loading: loadingLayouts,
  //   error: loadingLayoutsError,
  //   layoutsByObject,
  //   selectedLayoutIds,
  //   handleSelectLayout,
  // } = useFetchPageLayouts(selectedOrg, sObjects);

  const { results, loading, deployed, fatalError, fatalErrorMessage, layoutErrorMessage, prepareFields, deployFields } = useCreateFields({
    apiVersion: defaultApiVersion,
    serverUrl,
    selectedOrg,
    profiles,
    permissionSets,
    sObjects,
  });

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportData, setExportModalData] = useState<{
    worksheetData: Record<string, any[]>;
    headerData: Record<string, any[]>;
  } | null>(null);

  useEffect(() => {
    prepareFields(rows);
  }, [prepareFields, rows, sObjects]);

  async function handleDeploy() {
    trackEvent(ANALYTICS_KEYS.sobj_create_field_deploy, {
      numFields: rows.length,
      numLayouts: selectedLayoutIds.size,
      previousDeploy: deployed,
    });
    if (deployed) {
      setConfirmModalOpen(true);
      if (
        await ConfirmationModalPromise({
          content: 'Are you sure you want to re-deploy all the fields?',
        })
      ) {
        deployFields(results, Array.from(selectedLayoutIds));
      }
      setConfirmModalOpen(false);
    } else {
      deployFields(results, Array.from(selectedLayoutIds));
    }
  }

  function handleCloseModal() {
    if (!loading) {
      onClose();
    }
  }

  function downloadResults() {
    setExportModalData(prepareDownloadResultsFile(results, rows, profilesAndPermSetsById));
    setExportModalOpen(true);
    trackEvent(ANALYTICS_KEYS.sobj_create_field_export_results, {
      numFields: rows.length,
      numResults: results.length,
    });
  }

  function handleDownloadResultsModalClosed() {
    setExportModalData(null);
    setExportModalOpen(false);
  }

  return (
    <Fragment>
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
      {!confirmModalOpen && !exportModalOpen && (
        <Modal
          closeOnEsc={false}
          closeOnBackdropClick={false}
          header="Create Fields"
          tagline={
            <Fragment>
              <Icon type="utility" icon="info" className="slds-icon slds-icon-text-default slds-icon_xx-small cursor-pointer" />
              <span className="slds-m-left_xx-small">New fields will be created and existing fields will be updated.</span>
            </Fragment>
          }
          footer={
            <Grid align="spread">
              <div>
                <button className="slds-button slds-button_neutral" onClick={() => downloadResults()} disabled={loading || !deployed}>
                  <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Download Results
                </button>
              </div>
              <div>
                <button className="slds-button slds-button_neutral" onClick={() => handleCloseModal()} disabled={loading}>
                  Close
                </button>
                <button className="slds-button slds-button_brand" onClick={handleDeploy} disabled={loading}>
                  Create Fields
                </button>
              </div>
            </Grid>
          }
          size="lg"
          onClose={handleCloseModal}
        >
          <div
            css={css`
              min-height: 300px;
              overflow-x: auto;
            `}
          >
            <Tabs
              tabs={[
                {
                  id: 'deploy-tab-1',
                  title: 'Configure Permissions and Layouts',
                  content: (
                    <CreateFieldsDeployModalPermissions
                      selectedOrg={selectedOrg}
                      profiles={profiles}
                      permissionSets={permissionSets}
                      profilesAndPermSetsById={profilesAndPermSetsById}
                      sObjects={sObjects}
                      rows={rows}
                      loading={loading}
                      // TODO:
                      onPermissionsChange={setSelectedPermissions}
                      onLayoutsChange={setSelectedLayoutIds}
                    />
                  ),
                },
                {
                  id: 'deploy-tab-2',
                  title: 'Deploy Fields',
                  content: (
                    <div>
                      {fatalError && (
                        <div className="slds-m-around-medium">
                          <ScopedNotification theme="error" className="slds-m-top_medium">
                            <p>{fatalErrorMessage}</p>
                          </ScopedNotification>
                        </div>
                      )}
                      {layoutErrorMessage && (
                        <div className="slds-m-around-medium">
                          <ScopedNotification theme="warning" className="slds-m-top_medium">
                            <strong>Page Layout Errors</strong>
                            <p>{layoutErrorMessage}</p>
                          </ScopedNotification>
                        </div>
                      )}
                      <CreateFieldsDeployModalDeployment selectedOrg={selectedOrg} serverUrl={serverUrl} results={results} />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </Modal>
      )}
    </Fragment>
  );
};

export default CreateFieldsDeployModal;
