import { css } from '@emotion/react';
import { SerializedStyles } from '@emotion/utils';
import { getOrgType } from '@jetstream/shared/ui-utils';
import { BadgeTypes, SalesforceOrgUi, SalesforceOrgUiType } from '@jetstream/types';
import { Badge, Icon, Tooltip } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';

function getOrgBorderStyle(org: SalesforceOrgUi): SerializedStyles | undefined {
  if (!org || !org.color) {
    return;
  }
  return css({
    borderColor: org.color,
  });
}

export interface OrgLabelBadgeProps {
  className?: string;
  org: SalesforceOrgUi;
}

export const OrgLabelBadge: FunctionComponent<OrgLabelBadgeProps> = ({ className = 'slds-m-horizontal_xx-small', org }) => {
  const [orgType, setOrgType] = useState<SalesforceOrgUiType | undefined>(getOrgType(org));
  const [badgeType, setBadgeType] = useState<BadgeTypes>('light');

  useEffect(() => {
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
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <Fragment>
      {org && (
        <Tooltip
          content={
            <div>
              <ul>
                <li>
                  <strong>{org.orgName}</strong>
                </li>
                <li>{orgType}</li>
                <li>Org Id {org.organizationId}</li>
                <li>{org.instanceUrl}</li>
              </ul>
            </div>
          }
        >
          <Badge className={className} type={badgeType} css={getOrgBorderStyle(org)}>
            <span
              className="slds-badge__icon slds-badge__icon_left"
              css={css`
                ${org.color ? `color: ${org.color}` : ''}
              `}
            >
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
        </Tooltip>
      )}
    </Fragment>
  );
};
