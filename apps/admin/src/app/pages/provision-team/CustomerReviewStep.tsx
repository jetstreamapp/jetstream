import { ProvisioningLookupResult } from '@jetstream/admin/types';
import { Badge, StatusBadge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Alert, ErrorAlert } from '../../components/ErrorAlert';
import { StripeIdLink } from '../../components/ExternalLink';
import { KeyValueList } from '../../components/KeyValueList';
import { PageSpinner, Spinner } from '../../components/Spinner';
import { Table } from '../../components/Table';
import { EMPTY_VALUE, formatCurrency, formatDate, formatDateTime, formatNumber, getStripeDashboardUrl } from '../../utils/format';
import { getQuoteLabel } from './provision-team.utils';

export interface CustomerReviewStepProps {
  lookup: ProvisioningLookupResult | null;
  loading: boolean;
  error: Error | null;
  selectedQuoteId: string | null;
  onSelectQuote: (quoteId: string | null) => void;
  onRetry: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export function CustomerReviewStep({
  lookup,
  loading,
  error,
  selectedQuoteId,
  onSelectQuote,
  onRetry,
  onBack,
  onContinue,
}: CustomerReviewStepProps) {
  if (!lookup) {
    if (error) {
      return <ErrorAlert error={error} title="Unable to load the Stripe customer" onRetry={onRetry} />;
    }
    return <PageSpinner />;
  }

  const { customer, quotes, subscriptions, checks } = lookup;
  const blockers = checks.filter(({ severity }) => severity === 'BLOCKER');
  const warnings = checks.filter(({ severity }) => severity === 'WARNING');

  return (
    <div className="space-y-4">
      {error && <ErrorAlert error={error} title="Unable to refresh the Stripe customer" onRetry={onRetry} />}
      <Card title="Customer" actions={loading ? <Spinner size="sm" className="text-slate-500" /> : undefined}>
        <KeyValueList
          items={[
            { label: 'Name', value: customer.name || EMPTY_VALUE },
            { label: 'Email', value: customer.email || EMPTY_VALUE },
            { label: 'Customer', value: <StripeIdLink id={customer.id} href={getStripeDashboardUrl(customer.id)} /> },
            { label: 'Mode', value: customer.livemode ? <Badge tone="green">Live</Badge> : <Badge tone="amber">Test</Badge> },
            { label: 'Created', value: formatDateTime(customer.createdAt) },
            {
              label: 'Metadata',
              value: Object.keys(customer.metadata).length ? (
                <span className="font-mono text-xs">
                  {Object.entries(customer.metadata)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(', ')}
                </span>
              ) : (
                EMPTY_VALUE
              ),
            },
          ]}
        />
      </Card>

      <Card
        title="Quote (optional)"
        description="Pre-fills the seat limit and checks the line items. Nothing is written to the quote: the team is linked through the customer, so any subscription the customer starts syncs to it."
        flush
      >
        <Table
          rows={[null, ...quotes]}
          getRowKey={(quote) => quote?.id ?? 'none'}
          columns={[
            {
              key: 'select',
              header: <span className="sr-only">Select</span>,
              className: 'w-8',
              render: (quote) => (
                <input
                  type="radio"
                  name="quote"
                  aria-label={quote ? `Select quote ${getQuoteLabel(quote)}` : 'No quote'}
                  checked={(quote?.id ?? null) === selectedQuoteId}
                  onChange={() => onSelectQuote(quote?.id ?? null)}
                  className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-600"
                />
              ),
            },
            {
              key: 'quote',
              header: 'Quote',
              render: (quote) =>
                quote ? (
                  <StripeIdLink id={getQuoteLabel(quote)} href={getStripeDashboardUrl(quote.id)} />
                ) : (
                  <span className="text-slate-500">No quote</span>
                ),
            },
            { key: 'status', header: 'Status', render: (quote) => (quote ? <StatusBadge status={quote.status} /> : null) },
            {
              key: 'lineItems',
              header: 'Line items',
              render: (quote) =>
                quote ? (
                  <ul className="space-y-0.5 text-xs">
                    {quote.lineItems.map((lineItem, index) => (
                      <li key={`${lineItem.priceId}-${index}`}>
                        {lineItem.isTeamPrice && (
                          <Badge tone="blue" title="TEAM_ price">
                            Team
                          </Badge>
                        )}{' '}
                        {lineItem.description || lineItem.lookupKey || lineItem.priceId} × {formatNumber(lineItem.quantity)}
                      </li>
                    ))}
                  </ul>
                ) : null,
            },
            {
              key: 'seats',
              header: 'Team seats',
              className: 'text-right tabular-nums',
              render: (quote) => (quote ? formatNumber(quote.teamSeatQuantity) : null),
            },
            {
              key: 'total',
              header: 'Total',
              className: 'text-right whitespace-nowrap tabular-nums',
              render: (quote) => (quote ? formatCurrency(quote.amountTotal, quote.currency) : null),
            },
            {
              key: 'expires',
              header: 'Expires',
              className: 'whitespace-nowrap',
              render: (quote) => (quote ? formatDate(quote.expiresAt) : null),
            },
          ]}
        />
      </Card>

      <Card title="Subscriptions" flush>
        <Table
          rows={subscriptions}
          getRowKey={({ id }) => id}
          emptyMessage="No subscriptions yet. This is expected before the quote is accepted."
          columns={[
            { key: 'id', header: 'Subscription', render: ({ id }) => <StripeIdLink id={id} href={getStripeDashboardUrl(id)} /> },
            { key: 'status', header: 'Status', render: ({ status }) => <StatusBadge status={status} /> },
            {
              key: 'items',
              header: 'Items',
              render: ({ items }) => (
                <ul className="space-y-0.5 text-xs">
                  {items.map((lineItem, index) => (
                    <li key={`${lineItem.priceId}-${index}`}>
                      {lineItem.lookupKey || lineItem.priceId} × {formatNumber(lineItem.quantity)}
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      </Card>

      <Card title="Checks">
        <div className="space-y-2">
          {checks.length === 0 && <Alert tone="success">No conflicts found. This customer can be linked to a new team.</Alert>}
          {blockers.map(({ code, message }) => (
            <Alert key={code} tone="error" title={code}>
              {message}
            </Alert>
          ))}
          {warnings.map(({ code, message }) => (
            <Alert key={code} tone="warning" title={code}>
              {message}
            </Alert>
          ))}
        </div>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack}>Back</Button>
        <Button variant="primary" onClick={onContinue} disabled={loading || blockers.length > 0}>
          Continue
        </Button>
      </div>
    </div>
  );
}
