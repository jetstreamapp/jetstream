import { css } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { Maybe, OrgGroup } from '@jetstream/types';
import { Badge, Grid, Popover, PopoverRef } from '@jetstream/ui';
import { ReactNode, useRef } from 'react';
import { Link } from 'react-router-dom';

interface OrganizationGroupSelectorProps {
  groups: OrgGroup[];
  selectedGroup?: Maybe<OrgGroup>;
  salesforceOrgsWithoutGroup: number;
  size?: 'small' | 'medium';
  onSelection: (group?: Maybe<OrgGroup>) => void;
}

interface OrganizationPopoverProps {
  selectedGroup?: Maybe<OrgGroup>;
  groups: OrgGroup[];
  salesforceOrgsWithoutGroup: number;
  children: ReactNode;
  onSelection: (group?: Maybe<OrgGroup>) => void;
}

export function OrganizationGroupSelector({
  groups,
  selectedGroup,
  salesforceOrgsWithoutGroup,
  size,
  onSelection,
}: OrganizationGroupSelectorProps) {
  if (!selectedGroup) {
    return (
      <div className="slds-align_absolute-center">
        <OrganizationGroupPopover groups={groups} salesforceOrgsWithoutGroup={salesforceOrgsWithoutGroup} onSelection={onSelection}>
          Choose Group
        </OrganizationGroupPopover>
      </div>
    );
  }

  return (
    <Grid className="slds-align_absolute-center" verticalAlign="center">
      <p
        css={css`
          font-size: ${size === 'small' ? '10px;' : '14px'}
          margin-bottom: -2px;
        `}
      >
        {selectedGroup?.name}
      </p>
      <OrganizationGroupPopover
        selectedGroup={selectedGroup}
        groups={groups}
        salesforceOrgsWithoutGroup={salesforceOrgsWithoutGroup}
        onSelection={onSelection}
      >
        Switch
      </OrganizationGroupPopover>
    </Grid>
  );
}

const OrganizationGroupPopover = ({
  selectedGroup,
  groups,
  salesforceOrgsWithoutGroup: salesforceOrgsWithoutOrganization,
  children,
  onSelection,
}: OrganizationPopoverProps) => {
  const popoverRef = useRef<PopoverRef>(null);

  function handleSelection(organization?: Maybe<OrgGroup>) {
    onSelection(organization);
    popoverRef?.current?.close();
  }
  return (
    <Popover
      ref={popoverRef}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title="Refresh Metadata">
            Select Group
          </h2>
        </header>
      }
      footer={
        <footer className="slds-popover__footer">
          <Link
            to={{ pathname: APP_ROUTES.SALESFORCE_ORG_GROUPS.ROUTE, search: APP_ROUTES.SALESFORCE_ORG_GROUPS.SEARCH_PARAM }}
            onClick={() => popoverRef?.current?.close()}
          >
            Manage Groups
          </Link>
        </footer>
      }
      content={
        <div
          css={css`
            max-height: 50vh;
          `}
        >
          <p>When you choose a group, only Salesforce Orgs within that group will be available for selection.</p>
          <ul className="slds-has-dividers_top-space slds-dropdown_length-5">
            {groups
              .filter((group) => !selectedGroup || group.id !== selectedGroup.id)
              .map((group) => (
                <li key={group.id} className="slds-item" onClick={() => handleSelection(group)}>
                  <Grid className="slds-truncate" align="spread" verticalAlign="center">
                    <button className="slds-button">{group.name}</button>
                    <Badge type="light" className="slds-m-left_xx-small">
                      {formatNumber(group.orgs.length)} {pluralizeFromNumber('Org', group.orgs.length)}
                    </Badge>
                  </Grid>
                </li>
              ))}
            {!!selectedGroup && (
              <li className="slds-item" onClick={() => handleSelection(null)}>
                <Grid className="slds-truncate" align="spread" verticalAlign="center">
                  <button className="slds-button">-No Group-</button>
                  <Badge type="light" className="slds-m-left_xx-small">
                    {formatNumber(salesforceOrgsWithoutOrganization)} {pluralizeFromNumber('Org', salesforceOrgsWithoutOrganization)}
                  </Badge>
                </Grid>
              </li>
            )}
          </ul>
        </div>
      }
      buttonProps={{
        className: 'slds-button slds-m-left_xx-small',
      }}
      buttonStyle={{
        fontSize: '10px',
        lineHeight: 'unset',
      }}
    >
      {children}
    </Popover>
  );
};
