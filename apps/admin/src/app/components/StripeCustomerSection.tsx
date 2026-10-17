import {
  StripeCustomerSummary,
  UpdateStripeCustomerProductionOrgIdRequest,
  UpdateStripeCustomerProductionOrgIdRequestSchema,
} from '@jetstream/admin/types';
import { FormEvent, useState } from 'react';
import { apiPost, useApiQuery } from '../api/admin-api-client';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { EMPTY_VALUE } from '../utils/format';
import { Badge } from './Badge';
import { Button } from './Button';
import { ErrorAlert } from './ErrorAlert';
import { KeyValueList } from './KeyValueList';
import { Spinner } from './Spinner';

/**
 * Live details read from the Stripe customer record rather than Jetstream's mirror of it, with inline
 * editing of the Salesforce production org id that Checkout stores in the customer metadata.
 */
export function StripeCustomerSection({ customerId }: { customerId: string }) {
  const { data: customer, error, loading, reload } = useApiQuery<StripeCustomerSummary>(`/api/stripe/customers/${customerId}`);

  if (!customer) {
    if (error) {
      return <ErrorAlert error={error} title="Unable to load the Stripe customer" onRetry={reload} />;
    }
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner size="sm" /> Loading Stripe customer…
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <ErrorAlert error={error} title="Unable to refresh the Stripe customer" onRetry={reload} />}
      <KeyValueList
        items={[
          {
            label: 'Stripe name',
            value: (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {customer.name ?? EMPTY_VALUE}
                {!customer.livemode && <Badge tone="amber">Test mode</Badge>}
              </span>
            ),
          },
          { label: 'Stripe email', value: customer.email ?? EMPTY_VALUE },
          {
            label: 'Production org id',
            value: <ProductionOrgIdField customer={customer} onSaved={reload} disabled={loading} />,
          },
        ]}
      />
    </div>
  );
}

function ProductionOrgIdField({
  customer,
  onSaved,
  disabled,
}: {
  customer: StripeCustomerSummary;
  onSaved: () => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const {
    run: save,
    loading: submitting,
    error,
    clearError,
  } = useAsyncAction((request: UpdateStripeCustomerProductionOrgIdRequest) =>
    apiPost<StripeCustomerSummary>(`/api/stripe/customers/${customer.id}/production-org-id`, request),
  );

  function startEditing() {
    setDraft(customer.productionOrgId ?? '');
    setValidationError(null);
    clearError();
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedRequest = UpdateStripeCustomerProductionOrgIdRequestSchema.safeParse({ productionOrgId: draft });
    if (!parsedRequest.success) {
      setValidationError(parsedRequest.error.issues[0]?.message ?? 'Enter a valid Salesforce org id');
      return;
    }
    setValidationError(null);
    const result = await save(parsedRequest.data);
    if (result) {
      setEditing(false);
      onSaved();
    }
  }

  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {customer.productionOrgId ? <span className="font-mono text-xs">{customer.productionOrgId}</span> : <span>{EMPTY_VALUE}</span>}
        <Button size="sm" variant="ghost" onClick={startEditing} disabled={disabled}>
          {customer.productionOrgId ? 'Edit' : 'Set'}
        </Button>
      </span>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          placeholder="00D000000000000AAA"
          aria-label="Production org id"
          className="min-w-0 flex-1 rounded-md border-0 py-1 font-mono text-xs text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-blue-600 focus:ring-inset"
        />
        <Button type="submit" size="sm" variant="primary" loading={submitting}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={submitting}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-slate-500">Saved to the Stripe customer metadata. Leave blank to clear it.</p>
      {validationError && <p className="text-xs text-red-700">{validationError}</p>}
      {error && <ErrorAlert error={error} title="Production org id not saved" />}
    </form>
  );
}
