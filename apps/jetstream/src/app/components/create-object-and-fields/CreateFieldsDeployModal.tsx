import { css } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, Grid, Icon, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import React, { Fragment, FunctionComponent } from 'react';
import ConfirmPageChange from '../core/ConfirmPageChange';
import { FieldValues } from './create-fields-types';
import useCreateFields, { getFriendlyStatus } from './useCreateFields';
import { useFetchPageLayouts } from './useFetchPageLayouts';

export interface CreateFieldsDeployModalProps {
  apiVersion: string;
  selectedOrg: SalesforceOrgUi;
  profiles: string[];
  permissionSets: string[];
  sObjects: string[];
  rows: FieldValues[];
  onClose: () => void;
}

export const CreateFieldsDeployModal: FunctionComponent<CreateFieldsDeployModalProps> = ({
  apiVersion,
  selectedOrg,
  profiles,
  permissionSets,
  sObjects,
  rows,
  onClose,
}) => {
  // TODO: handle fatal error
  const {
    loading: loadingLayouts,
    error: loadingLayoutsError,
    layouts,
    selectedLayoutIds,
    handleSelectLayout,
  } = useFetchPageLayouts(selectedOrg, sObjects);
  const { results, loading, deployed, fatalError, fatalErrorMessage, layoutErrorMessage, deployFields } = useCreateFields({
    apiVersion,
    selectedOrg,
    profiles,
    permissionSets,
    sObjects,
    rows,
  });

  function handleDeploy() {
    deployFields(results, Array.from(selectedLayoutIds));
  }

  function handleCloseModal() {
    if (!loading) {
      onClose();
    }
  }

  function downloadResults() {
    // TODO:
  }

  return (
    <Fragment>
      <ConfirmPageChange actionInProgress={loading} />
      <Modal
        header="Create Fields"
        footer={
          <Grid align="spread">
            <div>
              {/* TODO: */}
              <button className="slds-button slds-button_neutral" onClick={() => downloadResults()} disabled={loading || !deployed}>
                Download Results
              </button>
            </div>
            <div>
              <button className="slds-button slds-button_neutral" onClick={() => handleCloseModal()} disabled={loading}>
                Cancel
              </button>
              <button className="slds-button slds-button_brand" onClick={handleDeploy} disabled={loading || deployed}>
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
                <p>{layoutErrorMessage}</p>
              </ScopedNotification>
            </div>
          )}
          <Grid>
            <div
              className="slds-is-relative"
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
              {Object.keys(layouts).map((objectName) => (
                <fieldset className="slds-form-element slds-m-top_small" key={`layout-heading-${objectName}`}>
                  <legend className="slds-form-element__legend slds-form-element__label slds-truncate" title={objectName}>
                    {objectName}
                  </legend>
                  {layouts[objectName].map((layout) => (
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
            <table className="slds-table slds-table_cell-buffer slds-no-row-hover slds-table_bordered slds-table_fixed-layout">
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
                  <th scope="col">
                    <div className="slds-truncate" title="Field Creation">
                      Field Creation
                    </div>
                  </th>
                  <th scope="col">
                    <div className="slds-truncate" title="Field Level Security">
                      Field Level Security
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.key} className="slds-hint-parent">
                    <th scope="row">
                      <div className="slds-truncate" title={result.label}>
                        {result.label}
                      </div>
                    </th>
                    <td className="slds-is-relative">
                      {result.state === 'LOADING' && <Spinner size="x-small" />}
                      <div className="slds-truncate" title={getFriendlyStatus(result.state)}>
                        <span
                          className={classNames({
                            'slds-text-color_error': result.state === 'FAILED',
                          })}
                        >
                          {getFriendlyStatus(result.state)}
                        </span>
                      </div>
                    </td>
                    <td className="slds-cell-wrap">
                      <div className="slds-line-clamp" title={result.errorMessage || ''}>
                        {result.errorMessage && <span className="slds-text-color_error">{result.errorMessage}</span>}
                        {result.state === 'SUCCESS' && (
                          <Icon
                            type="utility"
                            icon="success"
                            description="Completed successfully"
                            title="Completed successfully"
                            className="slds-icon slds-icon_small slds-icon-text-success"
                          />
                        )}
                      </div>
                    </td>
                    <td className="slds-cell-wrap">
                      {result.flsErrorMessage && (
                        <span className="slds-line-clamp slds-text-color_error" title={result.flsErrorMessage}>
                          {result.flsErrorMessage}
                        </span>
                      )}
                      {result.state === 'SUCCESS' && !result.flsWarning && result.flsResult && (
                        <Icon
                          type="utility"
                          icon="success"
                          description="Completed successfully"
                          title="Completed successfully"
                          className="slds-icon slds-icon_small slds-icon-text-success"
                        />
                      )}
                      {result.state === 'SUCCESS' && result.flsWarning && result.flsResult && (
                        <Icon
                          type="utility"
                          icon="warning"
                          description="Completed with errors"
                          title="Completed with errors"
                          className="slds-icon slds-icon_small slds-icon-text-warning"
                        />
                      )}
                      {result.state === 'SUCCESS' && !result.flsResult && <span>N/A</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Grid>
        </div>
      </Modal>
    </Fragment>
  );
};

export default CreateFieldsDeployModal;
