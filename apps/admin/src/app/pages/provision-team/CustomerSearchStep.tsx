import { STRIPE_QUOTE_ID_PATTERN, StripeCustomerSummary } from '@jetstream/admin/types';
import { useState } from 'react';
import { useApiQuery } from '../../api/admin-api-client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { SearchInput } from '../../components/SearchInput';
import { Spinner } from '../../components/Spinner';
import { Table } from '../../components/Table';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { EMPTY_VALUE, formatDate } from '../../utils/format';

const MIN_QUERY_LENGTH = 2;

export function CustomerSearchStep({ onSelect }: { onSelect: (customer: StripeCustomerSummary, quoteId: string | null) => void }) {
  const [inputValue, setInputValue] = useState('');
  const query = useDebouncedValue(inputValue.trim(), 400);
  const canSearch = query.length >= MIN_QUERY_LENGTH;
  const {
    data: customers,
    error,
    loading,
    reload,
  } = useApiQuery<StripeCustomerSummary[]>(canSearch ? `/api/stripe/customers?${new URLSearchParams({ query }).toString()}` : null);
  // Searching by quote id resolves to the quote's customer; carry the quote forward so it is preselected
  const searchedQuoteId = STRIPE_QUOTE_ID_PATTERN.test(query) ? query : null;

  return (
    <Card title="Find the Stripe customer" description="Search by email or name, or paste a cus_ or qt_ id.">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <SearchInput
            value={inputValue}
            onChange={setInputValue}
            autoFocus
            label="Search Stripe customers"
            placeholder="jane@acme.com, Acme, cus_… or qt_…"
          />
          {loading && <Spinner size="sm" className="text-slate-500" />}
        </div>
        {error && <ErrorAlert error={error} title="Stripe search failed" onRetry={reload} />}
        {canSearch && customers && (
          <div className="overflow-hidden rounded-md ring-1 ring-slate-200">
            <Table
              rows={customers}
              getRowKey={({ id }) => id}
              emptyMessage="No matching Stripe customers"
              columns={[
                {
                  key: 'name',
                  header: 'Customer',
                  render: ({ name, email }) => (
                    <span>
                      <span className="font-medium text-slate-900">{name || EMPTY_VALUE}</span>
                      <span className="block text-xs text-slate-500">{email || EMPTY_VALUE}</span>
                    </span>
                  ),
                },
                { key: 'id', header: 'Id', render: ({ id }) => <span className="font-mono text-xs">{id}</span> },
                {
                  key: 'linked',
                  header: 'Metadata',
                  render: ({ metadata }) => (
                    <span className="font-mono text-xs text-slate-500">
                      {Object.keys(metadata).length
                        ? Object.entries(metadata)
                            .map(([key, value]) => `${key}=${value}`)
                            .join(', ')
                        : EMPTY_VALUE}
                    </span>
                  ),
                },
                { key: 'createdAt', header: 'Created', className: 'whitespace-nowrap', render: ({ createdAt }) => formatDate(createdAt) },
                {
                  key: 'select',
                  header: <span className="sr-only">Select</span>,
                  className: 'text-right',
                  render: (customer) => (
                    <Button size="sm" variant="primary" onClick={() => onSelect(customer, searchedQuoteId)}>
                      Select
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
