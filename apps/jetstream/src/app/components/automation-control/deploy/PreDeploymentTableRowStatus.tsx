/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { CopyToClipboard, Grid, GridCol, Icon, Spinner, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import { uniqueId } from 'lodash';
import { FunctionComponent } from 'react';
import { DeploymentItemStatus, MetadataCompositeResponseError } from '../automation-control-types';

const loadingStatuses: DeploymentItemStatus[] = ['Preparing', 'Deploying', 'Rolling Back'];

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlPreDeploymentTableRowStatusProps {
  status: DeploymentItemStatus;
  retrieveError?: MetadataCompositeResponseError[];
  deployError?: MetadataCompositeResponseError[];
}

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

export const AutomationControlPreDeploymentTableRowStatus: FunctionComponent<AutomationControlPreDeploymentTableRowStatusProps> = ({
  status,
  retrieveError,
  deployError,
}) => {
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
          {isLoading && <Spinner size="small" inline className="slds-spinner slds-spinner_small slds-spinner_brand slds-m-top_x-small" />}
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

export default AutomationControlPreDeploymentTableRowStatus;
