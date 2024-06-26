import { css } from '@emotion/react';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, CopyToClipboard, Grid, GridCol, Icon, SalesforceLogin, Spinner, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent } from 'react';
import { CalculatedColumn, RenderCellProps } from 'react-data-grid';
import { isTableRow, isTableRowChild, isTableRowItem } from './automation-control-data-utils';
import { DeploymentItemRow, DeploymentItemStatus, MetadataCompositeResponseError, TableRowOrItemOrChild } from './automation-control-types';

export const ExpandingLabelRenderer: FunctionComponent<{
  serverUrl: string;
  selectedOrg: SalesforceOrgUi;
  column: CalculatedColumn<TableRowOrItemOrChild, unknown>;
  row: TableRowOrItemOrChild;
  toggleRowExpand: (row: TableRowOrItemOrChild, value: boolean) => void;
}> = ({ serverUrl, selectedOrg, column, row, toggleRowExpand }) => {
  const value = row[column.key as keyof TableRowOrItemOrChild];
  const leftMargin = isTableRowItem(row) ? 2 : isTableRowChild(row) ? 4.5 : 0;

  const wrappedValue =
    !isTableRow(row) && row.link && serverUrl && selectedOrg ? (
      <SalesforceLogin
        serverUrl={serverUrl}
        org={selectedOrg}
        returnUrl={row.link}
        iconPosition="right"
        title={isString(value) ? value : undefined}
        skipFrontDoorAuth
      >
        {value}
      </SalesforceLogin>
    ) : (
      value
    );

  if (isTableRow(row) || (isTableRowItem(row) && Array.isArray(row.children) && row.children.length)) {
    return (
      <Grid
        verticalAlign="center"
        css={css`
          margin-left: ${leftMargin}rem;
        `}
      >
        <button className="slds-button slds-button_icon slds-button_icon-container" onClick={() => toggleRowExpand(row, !row.isExpanded)}>
          <Icon type="utility" icon={row.isExpanded ? 'chevrondown' : 'chevronright'} className="slds-button__icon" omitContainer />
        </button>

        <div>{wrappedValue}</div>
      </Grid>
    );
  }

  return (
    <div
      css={css`
        margin-left: ${leftMargin}rem;
        display: inline-block;
        line-height: 1.5;
        overflow-wrap: break-word;
        white-space: normal;
        text-align: justify;
      `}
    >
      {wrappedValue}
    </div>
  );
};

export const LoadingAndActiveRenderer: FunctionComponent<{
  row: TableRowOrItemOrChild;
  updateIsActiveFlag: (row: TableRowOrItemOrChild, value: boolean) => void;
}> = ({ row, updateIsActiveFlag }) => {
  if (isTableRow(row)) {
    if (row.loading) {
      return <Spinner size="x-small" />;
    } else if (row.hasError) {
      return (
        <Tooltip
          id={`tooltip-error-${row.key}`}
          content={
            <div>
              <strong>There was an error fetching metadata. {row.errorMessage || 'An unknown error has occured.'}</strong>
            </div>
          }
        >
          <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small slds-m-left_small" />
        </Tooltip>
      );
    }
    return null;
  } else if (isTableRowItem(row)) {
    return (
      <div className="slds-p-left_x-small">
        <Checkbox
          id={row.key}
          label="Active"
          checked={row.isActive}
          disabled={row.readOnly}
          onChange={(value) => updateIsActiveFlag(row, value)}
        />
      </div>
    );
  } else {
    return (
      <div className="slds-p-left_x-small">
        <Checkbox id={row.key} label="Active" checked={row.isActive} onChange={(value) => updateIsActiveFlag(row, value)} />
      </div>
    );
  }
};

export const AdditionalDetailRenderer: FunctionComponent<RenderCellProps<TableRowOrItemOrChild, unknown>> = ({ row }) => {
  if (!isTableRow(row) && Array.isArray(row.additionalData) && row.additionalData.length > 0) {
    return (
      <Grid vertical className="slds-line-height_reset">
        {row.additionalData.map(({ label, value }, i) => {
          // Treat as heading
          if (value === null) {
            return (
              <div key={`${label}-${i}`} className="slds-text-body_regular">
                <span className="slds-text-title_caps">{label}</span>
              </div>
            );
          }
          return (
            <div key={`${label}-${i}`} className="slds-text-body_regular slds-p-vertical_xx-small">
              <span className="slds-m-right_x-small">
                <strong>{label}</strong>
              </span>
              <span title={value}>{value}</span>
            </div>
          );
        })}
      </Grid>
    );
  }
  return null;
};

export const BooleanAndVersionRenderer: FunctionComponent<RenderCellProps<DeploymentItemRow, unknown>> = ({ column, row }) => {
  const metadata = row;
  const type = metadata.type;
  const value = metadata[column.key as keyof TableRowOrItemOrChild];
  const checkbox = (
    <Checkbox className="slds-align_absolute-center" id={`${column.key}-${row.key}`} checked={!!value} label="value" hideLabel readOnly />
  );
  if (type === 'FlowRecordTriggered' || type === 'FlowProcessBuilder') {
    const activeVersionNumberInitialState = metadata.activeVersionNumberInitialState;
    const activeVersionNumber = metadata.activeVersionNumber;
    if (column.key === 'isActiveInitialState') {
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

const loadingStatuses: DeploymentItemStatus[] = ['Preparing', 'Deploying', 'Rolling Back'];

function getErrorMessageContent(deployError: Maybe<MetadataCompositeResponseError[]>) {
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

function getErrorMessageContentString(deployError: Maybe<MetadataCompositeResponseError[]>) {
  if (Array.isArray(deployError) && deployError.length > 0) {
    return deployError.map((item, i) => item.message).join('\n\n');
  }
}

export const AutomationDeployStatusRenderer: FunctionComponent<RenderCellProps<DeploymentItemRow, unknown>> = ({ row }) => {
  const { status, deploy } = row;
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
