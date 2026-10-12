import { SubscriptionItem } from '@jetstream/admin/types';
import { formatDateTime, getStripeDashboardUrl } from '../utils/format';
import { StatusBadge } from './Badge';
import { StripeIdLink } from './ExternalLink';
import { Table } from './Table';

export function SubscriptionTable({ subscriptions }: { subscriptions: SubscriptionItem[] }) {
  return (
    <Table
      rows={subscriptions}
      getRowKey={({ subscriptionId, priceId }) => `${subscriptionId}-${priceId}`}
      emptyMessage="No subscriptions"
      columns={[
        {
          key: 'subscription',
          header: 'Subscription',
          render: ({ subscriptionId }) => <StripeIdLink id={subscriptionId} href={getStripeDashboardUrl(subscriptionId)} />,
        },
        { key: 'price', header: 'Price', render: ({ priceId }) => <span className="font-mono text-xs">{priceId}</span> },
        { key: 'status', header: 'Status', render: ({ status }) => <StatusBadge status={status} /> },
        { key: 'createdAt', header: 'Created', className: 'whitespace-nowrap', render: ({ createdAt }) => formatDateTime(createdAt) },
      ]}
    />
  );
}
