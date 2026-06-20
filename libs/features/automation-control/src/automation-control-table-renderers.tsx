import { css } from '@emotion/react';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import type { RenderCellProps } from '@jetstream/ui';
import { Checkbox, CopyToClipboard, Grid, GridCol, Icon, SalesforceLogin, Spinner, Tooltip, TreeExpander } from '@jetstream/ui';
import classNames from 'classnames';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, ReactNode } from 'react';
import { isTableRow, isTableRowItem } from './automation-control-data-utils';
import { DeploymentItemRow, DeploymentItemStatus, MetadataCompositeResponseError, TableRowOrItemOrChild } from './automation-control-types';

/**
 * Label cell for the automation-control tree. Indentation + the expand/collapse chevron come from the
 * grid's native tree (`getSubRows`) via the shared `TreeExpander` — see the `depth`/`canExpand`/
 * `isExpanded`/`toggleExpanded` props forwarded from `DataTableCellProps`.
 */
export const ExpandingLabelRenderer: FunctionComponent<{
  serverUrl: string;
  selectedOrg: SalesforceOrgUi;
  row: TableRowOrItemOrChild;
  value: ReactNode;
  depth: number;
  canExpand: boolean;
  isExpanded: boolean;
  toggleExpanded: () => void;
}> = ({ serverUrl, selectedOrg, row, value, depth, canExpand, isExpanded, toggleExpanded }) => {
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

  return (
    <TreeExpander depth={depth} canExpand={canExpand} isExpanded={isExpanded} onToggle={toggleExpanded}>
      <div
        css={css`
          line-height: 1.5;
          overflow-wrap: break-word;
          white-space: normal;
        `}
      >
        {wrappedValue}
      </div>
    </TreeExpander>
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

export const AdditionalDetailRenderer = ({ row }: RenderCellProps<TableRowOrItemOrChild, unknown>): ReactNode => {
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

export const BooleanAndVersionRenderer = ({ column, row }: RenderCellProps<DeploymentItemRow, unknown>): ReactNode => {
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

export const AutomationDeployStatusRenderer = ({ row }: RenderCellProps<DeploymentItemRow, unknown>): ReactNode => {
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
