/** @jsx jsx */
import { jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { ButtonGroupContainer, Icon, Popover, GridCol, Grid } from '@jetstream/ui';
import startCase from 'lodash/startCase';
import { FunctionComponent, ReactNode, useState, Fragment } from 'react';
import { SalesforceLogin } from '@jetstream/ui';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';
import { addOrg } from '@jetstream/shared/ui-utils';

export interface OrgInfoPopoverProps {
  org: SalesforceOrgUi;
  onAddOrg: (org: SalesforceOrgUi, replaceOrgUniqueId?: string) => void;
  onRemoveOrg: (org: SalesforceOrgUi) => void;
}

function getOrgProp(serverUrl: string, org: SalesforceOrgUi, prop: keyof SalesforceOrgUi, label?: string) {
  label = label || startCase(prop);
  let value: string | number | boolean | ReactNode = org[prop];
  if (!value) {
    return undefined;
  }
  if (prop === 'organizationId') {
    value = (
      <SalesforceLogin serverUrl={serverUrl} org={org} returnUrl="/lightning/setup/CompanyProfileInfo/home" omitIcon>
        {value}
      </SalesforceLogin>
    );
  } else if (prop === 'userId') {
    value = (
      <SalesforceLogin serverUrl={serverUrl} org={org} returnUrl={`/${value}`} omitIcon>
        {value}
      </SalesforceLogin>
    );
  }
  return (
    <tr className="slds-hint-parent">
      <td>
        <div title={label}>{label}</div>
      </td>
      <td>
        <div title={value as string} className="slds-truncate">
          {value}
        </div>
      </td>
    </tr>
  );
}

export const OrgInfoPopover: FunctionComponent<OrgInfoPopoverProps> = ({ org, onAddOrg, onRemoveOrg }) => {
  const [applicationState] = useRecoilState(applicationCookieState);
  const [removeOrgActive, setRemoveOrgActive] = useState(false);
  const hasError = !!org.connectionError;

  function handleFixOrg() {
    addOrg(
      { serverUrl: applicationState.serverUrl, loginUrl: org.instanceUrl, replaceOrgUniqueId: org.uniqueId },
      (addedOrg: SalesforceOrgUi) => {
        let replaceOrgUniqueId = undefined;
        if (addedOrg.uniqueId !== org.uniqueId) {
          replaceOrgUniqueId = org.uniqueId;
        }
        onAddOrg(addedOrg, replaceOrgUniqueId);
      }
    );
  }

  return (
    <Popover
      placement="bottom-end"
      size="full-width"
      bodyClassName="slds-popover__body slds-p-around_none"
      containerClassName={hasError ? 'slds-popover_error' : undefined}
      inverseIcons={hasError}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-truncate slds-text-heading_small" title="Org Info">
            Org Info
            {hasError && ' - Connection Error'}
          </h2>
        </header>
      }
      content={
        <div>
          {hasError && (
            <div className="slds-p-around_xx-small">
              <ButtonGroupContainer className="slds-button_stretch">
                <button className="slds-button slds-button_text-destructive slds-button_stretch">
                  <Icon type="utility" icon="delete" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Remove Org
                </button>
                <button className="slds-button slds-button_success slds-button_stretch" onClick={handleFixOrg}>
                  <Icon type="utility" icon="apex_plugin" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Fix Connection
                </button>
              </ButtonGroupContainer>
            </div>
          )}
          {!hasError && (
            <div className="slds-p-around_xx-small">
              <ButtonGroupContainer className="slds-button_stretch">
                <SalesforceLogin
                  serverUrl={applicationState.serverUrl}
                  className="slds-button slds-button_neutral slds-button_stretch"
                  org={org}
                  title="Login to Salesforce Home"
                  returnUrl="/lightning/page/home"
                >
                  Home Page
                </SalesforceLogin>
                <SalesforceLogin
                  serverUrl={applicationState.serverUrl}
                  className="slds-button slds-button_neutral slds-button_stretch"
                  org={org}
                  title="Login to Salesforce Setup Menu"
                >
                  Setup Menu
                </SalesforceLogin>
              </ButtonGroupContainer>
            </div>
          )}
          <table className="slds-table slds-table_header-hidden">
            <thead className="slds-assistive-text">
              <tr className="slds-line-height_reset">
                <th className="" scope="col">
                  <div className="slds-truncate" title="Org Property">
                    Property
                  </div>
                </th>
                <th className="" scope="col">
                  <div className="slds-truncate" title="Value">
                    Value
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {getOrgProp(applicationState.serverUrl, org, 'orgName', 'Org Name')}
              {getOrgProp(applicationState.serverUrl, org, 'organizationId', 'Org Id')}
              {getOrgProp(applicationState.serverUrl, org, 'orgInstanceName', 'Instance')}
              {getOrgProp(applicationState.serverUrl, org, 'instanceUrl')}
              {getOrgProp(applicationState.serverUrl, org, 'orgOrganizationType', 'Org Type')}
              {getOrgProp(applicationState.serverUrl, org, 'orgTrialExpirationDate', 'Trial Expiration')}
              {getOrgProp(applicationState.serverUrl, org, 'userId')}
              {getOrgProp(applicationState.serverUrl, org, 'username')}
              {getOrgProp(applicationState.serverUrl, org, 'email')}
            </tbody>
          </table>
          <div className="slds-p-around_xx-small">
            {!removeOrgActive && (
              <ButtonGroupContainer className="slds-button_stretch">
                <button className="slds-button slds-button_text-destructive slds-button_stretch" onClick={() => setRemoveOrgActive(true)}>
                  <Icon type="utility" icon="delete" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Remove Org
                </button>
              </ButtonGroupContainer>
            )}
            {removeOrgActive && (
              <Fragment>
                <div className="slds-text-color_destructive slds-m-vertical_x-small">
                  <p className="slds-align_absolute-center">This action will remove this org from jetstream,</p>
                  <p className="slds-align_absolute-center">are you sure you want to continue?</p>
                </div>
                <Grid align="center">
                  <GridCol>
                    <button className="slds-button slds-button_neutral" onClick={() => setRemoveOrgActive(false)}>
                      Keep Org
                    </button>
                    <button className="slds-button slds-button_brand" onClick={() => onRemoveOrg(org)}>
                      Remove Org
                    </button>
                  </GridCol>
                </Grid>
              </Fragment>
            )}
          </div>
        </div>
      }
    >
      <button className="slds-button slds-button_icon">
        <Icon type="utility" icon="info" className="slds-button__icon slds-button__icon_left" omitContainer />
      </button>
    </Popover>
  );
};

export default OrgInfoPopover;
