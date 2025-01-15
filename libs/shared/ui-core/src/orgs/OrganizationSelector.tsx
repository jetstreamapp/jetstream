import { css } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { JetstreamOrganization, Maybe } from '@jetstream/types';
import { Badge, Grid, Popover, PopoverRef } from '@jetstream/ui';
import { ReactNode, useRef } from 'react';
import { Link } from 'react-router-dom';

interface OrganizationSelectorProps {
  organizations: JetstreamOrganization[];
  selectedOrganization?: Maybe<JetstreamOrganization>;
  salesforceOrgsWithoutOrganization: number;
  size?: 'small' | 'medium';
  onSelection: (organization?: Maybe<JetstreamOrganization>) => void;
}

interface OrganizationPopoverProps {
  selectedOrganization?: Maybe<JetstreamOrganization>;
  organizations: JetstreamOrganization[];
  salesforceOrgsWithoutOrganization: number;
  children: ReactNode;
  onSelection: (organization?: Maybe<JetstreamOrganization>) => void;
}

export function OrganizationSelector({
  organizations,
  selectedOrganization,
  salesforceOrgsWithoutOrganization,
  size,
  onSelection,
}: OrganizationSelectorProps) {
  if (!selectedOrganization) {
    return (
      <div className="slds-align_absolute-center">
        <OrganizationPopover
          organizations={organizations}
          salesforceOrgsWithoutOrganization={salesforceOrgsWithoutOrganization}
          onSelection={onSelection}
        >
          Choose Organization
        </OrganizationPopover>
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
        {selectedOrganization?.name}
      </p>
      <OrganizationPopover
        selectedOrganization={selectedOrganization}
        organizations={organizations}
        salesforceOrgsWithoutOrganization={salesforceOrgsWithoutOrganization}
        onSelection={onSelection}
      >
        Switch
      </OrganizationPopover>
    </Grid>
  );
}

const OrganizationPopover = ({
  selectedOrganization,
  organizations,
  salesforceOrgsWithoutOrganization,
  children,
  onSelection,
}: OrganizationPopoverProps) => {
  const popoverRef = useRef<PopoverRef>(null);

  function handleSelection(organization?: Maybe<JetstreamOrganization>) {
    onSelection(organization);
    popoverRef?.current?.close();
  }
  return (
    <Popover
      ref={popoverRef}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" title="Refresh Metadata">
            Select Organization
          </h2>
        </header>
      }
      footer={
        <footer className="slds-popover__footer">
          <Link
            to={{ pathname: APP_ROUTES.ORGANIZATIONS.ROUTE, search: APP_ROUTES.ORGANIZATIONS.SEARCH_PARAM }}
            onClick={() => popoverRef?.current?.close()}
          >
            Manage Organizations
          </Link>
        </footer>
      }
      content={
        <div
          css={css`
            max-height: 50vh;
          `}
        >
          <p>When you choose an organization, only Salesforce Orgs within that organization will be available for selection.</p>
          <ul className="slds-has-dividers_top-space slds-dropdown_length-5">
            {organizations
              .filter((organization) => !selectedOrganization || organization.id !== selectedOrganization.id)
              .map((organization) => (
                <li key={organization.id} className="slds-item" onClick={() => handleSelection(organization)}>
                  <Grid className="slds-truncate" align="spread" verticalAlign="center">
                    <button className="slds-button">{organization.name}</button>
                    <Badge type="light" className="slds-m-left_xx-small">
                      {formatNumber(organization.orgs.length)} {pluralizeFromNumber('Org', organization.orgs.length)}
                    </Badge>
                  </Grid>
                </li>
              ))}
            {!!selectedOrganization && (
              <li className="slds-item" onClick={() => handleSelection(null)}>
                <Grid className="slds-truncate" align="spread" verticalAlign="center">
                  <button className="slds-button">-No Organization-</button>
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
