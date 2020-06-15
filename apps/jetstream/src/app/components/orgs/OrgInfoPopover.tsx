/** @jsx jsx */
import { jsx } from '@emotion/core';
import { SalesforceOrg } from '@jetstream/types';
import { Icon, Popover } from '@jetstream/ui';
import startCase from 'lodash/startCase';
import { FunctionComponent } from 'react';
export interface OrgInfoPopoverProps {
  org: SalesforceOrg;
}

function getOrgProp(org: SalesforceOrg, prop: keyof SalesforceOrg, label?: string) {
  label = label || startCase(prop);
  const value = org[prop];
  if (!value) {
    return undefined;
  }
  return (
    <tr className="slds-hint-parent">
      <td>
        <div title={label}>{label}</div>
      </td>
      <td>
        <div title={value as string}>{value}</div>
      </td>
    </tr>
  );
}

export const OrgInfoPopover: FunctionComponent<OrgInfoPopoverProps> = ({ org }) => {
  return (
    <Popover
      placement="bottom-end"
      bodyClassName="slds-popover__body slds-p-around_none"
      header={
        <header className="slds-popover__header">
          <h2 className="slds-truncate slds-text-heading_small" title="Org Info">
            Org Info
          </h2>
        </header>
      }
      content={
        <div>
          <div className="slds-p-around_xx-small">
            <button className="slds-button slds-button_neutral slds-button_stretch">
              <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_left" omitContainer={true} />
              Login
            </button>
          </div>
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
              {getOrgProp(org, 'orgName', 'Org Name')}
              {getOrgProp(org, 'organizationId', 'Org Id')}
              {getOrgProp(org, 'orgInstanceName', 'Instance')}
              {getOrgProp(org, 'instanceUrl')}
              {getOrgProp(org, 'orgOrganizationType', 'Org Type')}
              {getOrgProp(org, 'orgTrialExpirationDate', 'Trial Expiration')}
              {getOrgProp(org, 'userId')}
              {getOrgProp(org, 'username')}
              {getOrgProp(org, 'email')}
            </tbody>
          </table>
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
