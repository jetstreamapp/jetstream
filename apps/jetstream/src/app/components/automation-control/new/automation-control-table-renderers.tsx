import { ICellRendererParams } from '@ag-grid-community/core';
import { css } from '@emotion/react';
import { Checkbox, CopyToClipboard, Grid, GridCol, Icon, Spinner, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import { isNumber, uniqueId } from 'lodash';
import { Fragment, FunctionComponent } from 'react';
import { DeploymentItemStatus, DeploymentItem } from '../automation-control-types';
import { isTableRow, isTableRowItem } from './automation-control-data-utils';
import { MetadataCompositeResponseError, TableContext, TableRowOrItemOrChild } from './automation-control-types';

export const LoadingAndActiveRenderer: FunctionComponent<ICellRendererParams> = ({ value, node, context }) => {
  const data = node.data as TableRowOrItemOrChild;
  const tableContext = context as TableContext;

  // you need either field or valueSetter set on colDef for editing to work
  function handleToggle(value: boolean) {
    tableContext.updateIsActiveFlag(data, value);
  }

  if (isTableRow(data)) {
    if (data.loading) {
      return <Spinner size="x-small" />;
    } else if (data.hasError) {
      return (
        <Tooltip
          id={`tooltip-error-${data.key}`}
          content={
            <div>
              <strong>There was an error fetching metadata. {data.errorMessage || 'An unknown error has occured.'}</strong>
            </div>
          }
        >
          <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small slds-m-left_small" />
        </Tooltip>
      );
    }
    return null;
  } else if (isTableRowItem(data)) {
    return (
      <div className="slds-p-left_x-small">
        <Checkbox id={data.key} label="Active" checked={data.isActive} disabled={data.readOnly} onChange={handleToggle} />
      </div>
    );
  } else {
    return (
      <div className="slds-p-left_x-small">
        <Checkbox id={data.key} label="Active" checked={data.isActive} onChange={handleToggle} />
      </div>
    );
  }
};

export const AdditionalDetailRenderer: FunctionComponent<ICellRendererParams> = ({ value, node }) => {
  const data = node.data as TableRowOrItemOrChild;

  if (!isTableRow(data) && Array.isArray(data.additionalData) && data.additionalData.length > 0) {
    return (
      <Fragment>
        {data.additionalData.map(({ label, value }) => (
          <div key={label} className="slds-text-body_regular">
            <span className="slds-m-right_x-small">
              <strong>{label}</strong>
            </span>
            <span title={value}>{value}</span>
          </div>
        ))}
      </Fragment>
    );
  }
  return null;
};

export const BooleanAndVersionRenderer: FunctionComponent<ICellRendererParams> = ({ value, node, data, colDef }) => {
  const metadata = data.metadata;
  const type = metadata.type;
  const checkbox = (
    <Checkbox className="slds-align_absolute-center" id={`${colDef.colId}-${node.id}`} checked={value} label="value" hideLabel readOnly />
  );
  if (type === 'FlowRecordTriggered' || type === 'FlowProcessBuilder') {
    const activeVersionNumberInitialState = metadata.activeVersionNumberInitialState;
    const activeVersionNumber = metadata.activeVersionNumber;
    if (colDef.colId === 'isActiveInitialState') {
      return (
        <Grid>
          {checkbox}
          <span>{isNumber(activeVersionNumberInitialState) ? `Version ${activeVersionNumberInitialState}` : ''}</span>
        </Grid>
      );
    } else {
      return (
        <Grid>
          {checkbox}
          <span>{isNumber(activeVersionNumber) ? `Version ${activeVersionNumber}` : ''}</span>
        </Grid>
      );
    }
  }

  return checkbox;
};

// AutomationDeployStatusRenderer
const loadingStatuses: DeploymentItemStatus[] = ['Preparing', 'Deploying', 'Rolling Back'];

function getErrorMessageContent(deployError?: MetadataCompositeResponseError[]) {
  if (Array.isArray(deployError) && deployError.length > 0) {
    return (
      <ul>
        {deployError.map((item, i) => (
          <li key={i}>{item.message}</li>
        ))}
      </ul>
    );
  }
}

function getErrorMessageContentString(deployError?: MetadataCompositeResponseError[]) {
  if (Array.isArray(deployError) && deployError.length > 0) {
    return deployError.map((item, i) => item.message).join('\n\n');
  }
}

export const AutomationDeployStatusRenderer: FunctionComponent<ICellRendererParams> = ({ value, node, data, colDef }) => {
  const { status, deploy } = data as DeploymentItem;
  const { deployError } = deploy;
  const isLoading = loadingStatuses.includes(status);
  const isSuccess = status === 'Deployed' || status === 'Rolled Back';
  const isError = status === 'Error';
  const readyToDeploy = status === 'Ready for Deploy';
  return (
    <div title={status}>
      <Grid gutters guttersSize="small">
        <GridCol
          className="slds-relative"
          css={css`
            min-width: 30px;
          `}
        >
          {isLoading && <Spinner size="x-small" />}
          {readyToDeploy && (
            <Icon
              type="utility"
              icon="success"
              className="slds-icon slds-icon-text-default slds-icon_x-small"
              containerClassname="slds-icon_container slds-icon-utility-success"
              description="Ready for deploy"
            />
          )}
          {isSuccess && (
            <Icon
              type="utility"
              icon="success"
              className="slds-icon slds-icon-text-success slds-icon_x-small"
              containerClassname="slds-icon_container slds-icon-utility-success"
              description="deployed successfully"
            />
          )}
          {isError && (
            <Tooltip id={`${uniqueId('deploy-error')}`} content={getErrorMessageContent(deployError) || 'An unknown error has occurred'}>
              <CopyToClipboard
                icon={{ type: 'utility', icon: 'error', description: 'deployment error' }}
                content={getErrorMessageContentString(deployError) || 'An unknown error has occurred'}
                className="slds-text-color_error"
              />
            </Tooltip>
          )}
        </GridCol>
        <GridCol>
          <span className={classNames({ 'slds-text-success': isSuccess, 'slds-text-error': isError })}>{status}</span>
        </GridCol>
      </Grid>
    </div>
  );
};
