import { SalesforceOrgUi } from '@jetstream/types';
import { CopyToClipboard } from '@jetstream/ui';
import { Fragment, useMemo } from 'react';
import '../sfdc-styles-shim.scss';

interface StaticItem {
  type: 'static';
  label: string;
  value: string;
  allowCopy?: boolean;
}

interface LinkItem {
  type: 'link';
  label: string;
  value: string;
  link: string;
  allowCopy?: boolean;
}

interface StaticLinkItem {
  type: 'static-link';
  label: string;
  link: string;
}

type Item = StaticItem | LinkItem | StaticLinkItem;

function getLinks(org: SalesforceOrgUi): Item[] {
  return [
    {
      type: 'static-link',
      label: 'Flows',
      link: `${org.instanceUrl}/lightning/setup/Flows/home`,
    },
    {
      type: 'static-link',
      label: 'Permission Sets',
      link: `${org.instanceUrl}/lightning/setup/PermSets/home`,
    },
    {
      type: 'static-link',
      label: 'Profiles',
      link: `${org.instanceUrl}/lightning/setup/EnhancedProfiles/home`,
    },
    {
      type: 'static-link',
      label: 'System Overview',
      link: `${org.instanceUrl}/lightning/setup/SystemOverview/home`,
    },
    {
      type: 'static-link',
      label: 'Users',
      link: `${org.instanceUrl}/lightning/setup/ManageUsers/home`,
    },
    {
      type: 'link',
      label: 'Org Id',
      value: org.organizationId,
      link: `${org.instanceUrl}/lightning/setup/CompanyProfileInfo/home`,
      allowCopy: true,
    },
    {
      type: 'link',
      label: 'User Id',
      value: org.userId,
      link: `${org.instanceUrl}/lightning/settings/personal/AdvancedUserDetails/home`,
      allowCopy: true,
    },
    {
      type: 'static',
      label: 'Instance URL',
      value: org.instanceUrl,
      allowCopy: true,
    },
  ];
}

function renderItem(item: Item) {
  switch (item.type) {
    case 'static':
      return (
        <Fragment>
          <p>
            <strong>{item.label}</strong>
          </p>
          <p>
            {item.allowCopy && <CopyToClipboard content={item.value} />} {item.value}
          </p>
        </Fragment>
      );
    case 'link':
      return (
        <p>
          <strong>{item.label}</strong> {item.allowCopy && <CopyToClipboard content={item.value} />}
          <a href={item.link}>{item.value}</a>
        </p>
      );
    case 'static-link':
      return (
        <p>
          <a href={item.link}>{item.label}</a>
        </p>
      );
    default:
      return null;
  }
}

interface SfdcPageButtonOrgInfoProps {
  org: SalesforceOrgUi;
}

export function SfdcPageButtonOrgInfo({ org }: SfdcPageButtonOrgInfoProps) {
  const items = useMemo(() => getLinks(org), [org]);

  return (
    <div className="slds-is-relative">
      <div>
        {items.map((item) => (
          <div className="slds-m-top_x-small" key={item.label}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
