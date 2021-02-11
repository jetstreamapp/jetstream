/** @jsx jsx */
import { jsx } from '@emotion/react';
import { getOrgType, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { BadgeTypes, SalesforceOrgUi, SalesforceOrgUiType } from '@jetstream/types';
import { Badge, Icon } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';

export interface OrgLabelBadgeProps {
  className?: string;
  org: SalesforceOrgUi;
}

export const OrgLabelBadge: FunctionComponent<OrgLabelBadgeProps> = ({ className = 'slds-m-horizontal_xx-small', org }) => {
  const [orgType, setOrgType] = useState<SalesforceOrgUiType>(getOrgType(org));
  const [badgeType, setBadgeType] = useState<BadgeTypes>('light');

  useNonInitialEffect(() => {
    if (orgType !== 'Production') {
      setBadgeType('light');
    } else {
      setBadgeType('warning');
    }
  }, [orgType]);

  useEffect(() => {
    setOrgType(getOrgType(org));
  }, [org]);

  return (
    <Fragment>
      {org && (
        <Badge
          className={className}
          type={badgeType}
          spanProps={{ title: `${org.orgName} - ${org.username} - ${orgType} - ${org.instanceUrl}` }}
        >
          <span className="slds-badge__icon slds-badge__icon_left">
            <Icon
              type="utility"
              icon="salesforce1"
              className="slds-icon slds-icon_xx-small"
              containerClassname="slds-icon_container slds-icon-utility-salesforce1 slds-current-color"
            />
          </span>
          {org.label}
          {orgType === 'Production' && <span className="slds-m-left_x-small">(Production)</span>}
        </Badge>
      )}
    </Fragment>
  );
};

export default OrgLabelBadge;
