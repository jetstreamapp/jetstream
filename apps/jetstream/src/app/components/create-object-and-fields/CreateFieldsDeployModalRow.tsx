import { SalesforceOrgUi } from '@jetstream/types';
import { Badge, Grid, Icon, SalesforceLogin, Spinner, Tooltip } from '@jetstream/ui';
import { CreateFieldsResults, getFriendlyStatus } from '@jetstream/ui-core';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { FunctionComponent, useEffect, useState } from 'react';

export interface CreateFieldsDeployModalRowProps {
  selectedOrg: SalesforceOrgUi;
  serverUrl: string;
  result: CreateFieldsResults;
}

export const CreateFieldsDeployModalRow: FunctionComponent<CreateFieldsDeployModalRowProps> = ({ selectedOrg, serverUrl, result }) => {
  const [fieldJson] = useState(() => JSON.stringify(result.field));
  const [flsErrors, setFlsErrors] = useState<string | null>(null);
  const [layoutErrors, setLayoutErrors] = useState<string | null>(null);

  useEffect(() => {
    if (Array.isArray(result.flsErrors) && result.flsErrors.length) {
      setFlsErrors(result.flsErrors.join(' ') || 'An unknown error has occurred.');
    } else if (flsErrors) {
      setFlsErrors(null);
    }
  }, [flsErrors, result.flsErrors]);

  useEffect(() => {
    if (Array.isArray(result.layoutErrors) && result.layoutErrors.length) {
      setLayoutErrors(result.layoutErrors.join(' ') || 'An unknown error has occurred.');
    } else if (layoutErrors) {
      setLayoutErrors(null);
    }
  }, [layoutErrors, result.layoutErrors]);

  return (
    <tr key={result.key} className="slds-hint-parent">
      <th scope="row">
        <Grid vertical>
          <div className="slds-truncate" title={result.label}>
            <Tooltip content={fieldJson}>{result.label}</Tooltip>
          </div>
          <div>
            <Badge>
              {result.field.secondaryType ? `${result.field.secondaryType}: ` : ''}
              {result.field.type}
            </Badge>
          </div>
          {isString(result?.fieldId) && (
            <SalesforceLogin
              org={selectedOrg}
              serverUrl={serverUrl}
              skipFrontDoorAuth
              iconPosition="right"
              returnUrl={`/lightning/setup/ObjectManager/${result.sobject}/FieldsAndRelationships/${result.fieldId}/view`}
            >
              View field in Salesforce
            </SalesforceLogin>
          )}
        </Grid>
      </th>
      <td className="slds-is-relative">
        {result.state === 'LOADING' && <Spinner size="x-small" />}
        <div className="slds-truncate" title={getFriendlyStatus(result)}>
          <span
            className={classNames({
              'slds-text-color_error': result.state === 'FAILED',
            })}
          >
            {getFriendlyStatus(result)}
          </span>
        </div>
      </td>
      <td className="slds-cell-wrap">
        <div className="slds-line-clamp" title={result.errorMessage || ''}>
          {result.errorMessage && (
            <Tooltip content={result.errorMessage}>
              <span className="slds-text-color_error">{result.errorMessage}</span>
            </Tooltip>
          )}
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
      {/* FLS */}
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
        {result.state === 'SUCCESS' && result.flsWarning && result.flsResult && flsErrors && (
          <Tooltip content={flsErrors}>
            <Icon
              type="utility"
              icon="warning"
              description="Completed with errors"
              title="Completed with errors"
              className="slds-icon slds-icon_small slds-icon-text-warning"
            />
          </Tooltip>
        )}
        {result.state === 'SUCCESS' && !result.flsResult && <span>N/A</span>}
      </td>
      {/* PAGE LAYOUTS */}
      <td className="slds-cell-wrap">
        {result.state === 'SUCCESS' && result.pageLayoutStatus === 'SUCCESS' && (
          <Icon
            type="utility"
            icon="success"
            description="Page Layouts Updated Successfully"
            title="Page Layouts Updated Successfully"
            className="slds-icon slds-icon_small slds-icon-text-success"
          />
        )}
        {result.state === 'SUCCESS' && result.pageLayoutStatus === 'PARTIAL' && layoutErrors && (
          <Tooltip content={layoutErrors}>
            <Icon
              type="utility"
              icon="warning"
              description="Completed with errors"
              title="Completed with errors"
              className="slds-icon slds-icon_small slds-icon-text-warning"
            />
          </Tooltip>
        )}
        {result.state === 'SUCCESS' && result.pageLayoutStatus === 'FAILED' && layoutErrors && (
          <Tooltip content={layoutErrors}>
            <Icon
              type="utility"
              icon="error"
              description="Failed"
              title="Failed"
              className="slds-icon slds-icon_small slds-icon-text-error"
            />
          </Tooltip>
        )}
        {result.state === 'SUCCESS' && result.pageLayoutStatus === 'SKIPPED' && <span>N/A</span>}
      </td>
    </tr>
  );
};

export default CreateFieldsDeployModalRow;
