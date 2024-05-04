/* eslint-disable react/jsx-no-useless-fragment */
import { css } from '@emotion/react';
import { groupByFlat } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Grid, GridCol, Icon, SalesforceLogin, ScopedNotification, Tooltip } from '@jetstream/ui';
import {
  CreateFieldsResults,
  FieldPermissionRecord,
  FieldValues,
  LayoutResult,
  applicationCookieState,
  selectSkipFrontdoorAuth,
} from '@jetstream/ui-core';
import isString from 'lodash/isString';
import { ReactElement } from 'react';
import { useRecoilValue } from 'recoil';

type DeployedItem = { id: string; label: string };

export interface FormulaEvaluatorDeploySummaryProps {
  selectedOrg: SalesforceOrgUi;
  sobject: string;
  field: FieldValues;
  deployed: boolean;
  results?: CreateFieldsResults;
  selectedProfiles: DeployedItem[];
  selectedPermissionSets: DeployedItem[];
  selectedLayouts: DeployedItem[];
}

export function FormulaEvaluatorDeploySummary({
  selectedOrg,
  sobject,
  field,
  selectedProfiles,
  selectedPermissionSets,
  selectedLayouts,
  deployed,
  results,
}: FormulaEvaluatorDeploySummaryProps) {
  const { serverUrl } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);
  let flsResults: Record<string, FieldPermissionRecord> = {};
  let layoutResults: Record<string, LayoutResult> = {};

  if (results?.flsRecords) {
    flsResults = groupByFlat(results.flsRecords, 'ParentId');
  }

  if (results?.updatedLayouts) {
    layoutResults = groupByFlat(results.updatedLayouts, 'id');
  }

  return (
    <Grid gutters wrap>
      <GridCol className="slds-m-around-medium">
        <fieldset className="slds-form-element slds-m-top_small">
          <legend
            className="slds-form-element__label slds-truncate"
            title="Field"
            css={css`
              font-weight: 700;
            `}
          >
            Field
          </legend>
          <ul>
            <li>
              {field.label.value} ({field.fullName.value})
            </li>
            <li>{field.secondaryType.value}</li>
          </ul>
          {isString(results?.fieldId) && (
            <SalesforceLogin
              org={selectedOrg}
              serverUrl={serverUrl}
              skipFrontDoorAuth={skipFrontDoorAuth}
              iconPosition="right"
              returnUrl={`/lightning/setup/ObjectManager/${sobject}/FieldsAndRelationships/${results?.fieldId}/view`}
            >
              View field in Salesforce
            </SalesforceLogin>
          )}
        </fieldset>
      </GridCol>
      <GridCol className="slds-m-around-medium">
        <fieldset className="slds-form-element slds-m-top_small">
          <legend
            className="slds-form-element__label slds-truncate"
            title="Field"
            css={css`
              font-weight: 700;
            `}
          >
            Permissions
          </legend>
          {selectedProfiles.length === 0 && selectedPermissionSets.length === 0 && <p>No permissions selected</p>}
          <ul>
            {selectedProfiles.map((item) => (
              <FlsItem key={item.id} type="Profile" deployed={deployed} item={item} flsResults={flsResults} />
            ))}
          </ul>
          <ul>
            {selectedPermissionSets.map((item) => (
              <FlsItem key={item.id} type="Permission Set" deployed={deployed} item={item} flsResults={flsResults} />
            ))}
          </ul>
        </fieldset>
      </GridCol>
      <GridCol className="slds-m-around-medium">
        <fieldset className="slds-form-element slds-m-top_small">
          <legend
            className="slds-form-element__label slds-truncate"
            title="Field"
            css={css`
              font-weight: 700;
            `}
          >
            Layouts
          </legend>
          {selectedLayouts.length === 0 && <p>No layouts selected</p>}
          {!!results?.layoutErrors?.length && (
            <>
              <ScopedNotification theme="error">
                <ul className="slds-list_dotted">
                  {results?.layoutErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </ScopedNotification>
            </>
          )}
          <ul>
            {selectedLayouts.map((item) => (
              <LayoutItem key={item.id} deployed={deployed} item={item} layoutResults={layoutResults} />
            ))}
          </ul>
        </fieldset>
      </GridCol>
    </Grid>
  );
}

function FlsItem({
  type,
  deployed,
  item,
  flsResults,
}: {
  type: 'Profile' | 'Permission Set';
  deployed: boolean;
  item: DeployedItem;
  flsResults: Record<string, FieldPermissionRecord>;
}) {
  let icon: ReactElement | undefined;

  if (deployed && flsResults[item.id]) {
    const result = flsResults[item.id];
    if (result.Errors) {
      icon = (
        <Tooltip content={result.Errors}>
          <Icon
            type="utility"
            icon="error"
            className="slds-icon slds-icon-text-error slds-icon_xx-small"
            containerClassname="slds-icon_container slds-icon-utility-error slds-m-right_x-small"
            description="Permissions update error"
          />
        </Tooltip>
      );
    } else {
      icon = (
        <Tooltip content="Updated successfully">
          <Icon
            type="utility"
            icon="success"
            className="slds-icon slds-icon_x-small slds-icon-text-success"
            containerClassname="slds-icon_container slds-icon-utility-success slds-m-right_x-small"
            description="Permission updated successfully"
          />
        </Tooltip>
      );
    }
  } else if (deployed) {
    icon = (
      <Tooltip content="No update required, field already has permissions">
        <Icon
          type="utility"
          icon="ban"
          className="slds-icon slds-icon_x-small slds-icon-text-default"
          containerClassname="slds-icon_container slds-icon-utility-ban slds-m-right_x-small"
          description="No update required"
        />
      </Tooltip>
    );
  }

  return (
    <li>
      {icon}
      {item.label} ({type})
    </li>
  );
}

function LayoutItem({
  deployed,
  item,
  layoutResults,
}: {
  deployed: boolean;
  item: DeployedItem;
  layoutResults: Record<string, LayoutResult>;
}) {
  let icon: ReactElement | undefined;

  if (deployed && layoutResults[item.id]) {
    const result = layoutResults[item.id];
    if (result.error) {
      icon = (
        <Tooltip content={result.error}>
          <Icon
            type="utility"
            icon="error"
            className="slds-icon slds-icon-text-error slds-icon_xx-small"
            containerClassname="slds-icon_container slds-icon-utility-error slds-m-right_x-small"
            description="Layout update error"
          />
        </Tooltip>
      );
    } else if (result.deployed) {
      icon = (
        <Tooltip content="Updated successfully">
          <Icon
            type="utility"
            icon="success"
            className="slds-icon slds-icon_x-small slds-icon-text-success"
            containerClassname="slds-icon_container slds-icon-utility-success slds-m-right_x-small"
            description="Layout updated successfully"
          />
        </Tooltip>
      );
    } else {
      icon = (
        <Tooltip content="No update required, field already exists on layout">
          <Icon
            type="utility"
            icon="ban"
            className="slds-icon slds-icon_x-small slds-icon-text-default"
            containerClassname="slds-icon_container slds-icon-utility-ban slds-m-right_x-small"
            description="No update required"
          />
        </Tooltip>
      );
    }
  }

  return (
    <li>
      {icon}
      {item.label}
    </li>
  );
}

export default FormulaEvaluatorDeploySummary;
