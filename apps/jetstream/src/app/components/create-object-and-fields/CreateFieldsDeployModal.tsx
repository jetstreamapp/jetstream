import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { useFetchPageLayouts } from '@jetstream/shared/ui-utils';
import { PermissionSetNoProfileRecord, PermissionSetWithProfileRecord, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, ConfirmationModalPromise, FileDownloadModal, Grid, Icon, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
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
import CreateFieldsDeployModalRow from './CreateFieldsDeployModalRow';

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
  const {
    loading: loadingLayouts,
    error: loadingLayoutsError,
    layoutsByObject,
    selectedLayoutIds,
    handleSelectLayout,
  } = useFetchPageLayouts(selectedOrg, sObjects);
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
            <Grid>
              <table
                className="slds-table slds-table_cell-buffer slds-no-row-hover slds-table_bordered slds-table_fixed-layout"
                css={css`
                  min-width: 650px;
                `}
              >
                <thead>
                  <tr className="slds-line-height_reset">
                    <th scope="col">
                      <div className="slds-truncate" title="Field">
                        Field
                      </div>
                    </th>
                    <th
                      scope="col"
                      css={css`
                        width: 150px;
                      `}
                    >
                      <div className="slds-truncate" title="Status">
                        Status
                      </div>
                    </th>
                    <th
                      scope="col"
                      css={css`
                        width: 125px;
                      `}
                    >
                      <div className="slds-truncate" title="Field Creation">
                        Field Creation
                      </div>
                    </th>
                    <th
                      scope="col"
                      css={css`
                        width: 125px;
                      `}
                    >
                      <div className="slds-truncate" title="FLS">
                        FLS
                      </div>
                    </th>
                    <th
                      scope="col"
                      css={css`
                        width: 125px;
                      `}
                    >
                      <div className="slds-truncate" title="Page Layouts">
                        Page Layouts
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <CreateFieldsDeployModalRow key={result.key} selectedOrg={selectedOrg} serverUrl={serverUrl} result={result} />
                  ))}
                </tbody>
              </table>
              <div
                className="slds-is-relative"
                dir="rtl"
                css={css`
                  width: 400px;
                `}
              >
                {loadingLayoutsError && (
                  <div className="slds-m-around-medium">
                    <ScopedNotification theme="error" className="slds-m-top_medium">
                      <p>{loadingLayoutsError}</p>
                    </ScopedNotification>
                  </div>
                )}
                {loadingLayouts && <Spinner />}
                <div className="slds-text-heading_small slds-truncate" title="Add to Page Layouts">
                  Add to Page Layouts
                </div>
                {Object.keys(layoutsByObject).map((objectName) => (
                  <fieldset className="slds-form-element slds-m-top_small slds-p-right_x-small" key={`layout-heading-${objectName}`}>
                    <legend
                      className="slds-form-element__label slds-truncate"
                      title={objectName}
                      css={css`
                        font-weight: 700;
                      `}
                    >
                      {objectName}
                    </legend>
                    {layoutsByObject[objectName].map((layout) => (
                      <Checkbox
                        key={`layout-${layout.Id}`}
                        id={`layout-${layout.Id}`}
                        label={layout.Name}
                        checked={selectedLayoutIds.has(layout.Id)}
                        disabled={loadingLayouts || loading}
                        onChange={(value) => handleSelectLayout(layout.Id)}
                      />
                    ))}
                  </fieldset>
                ))}
              </div>
            </Grid>
          </div>
        </Modal>
      )}
    </Fragment>
  );
};

export default CreateFieldsDeployModal;
