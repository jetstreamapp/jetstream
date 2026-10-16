import { StripeLinkResult } from '@jetstream/admin/types';
import { ReactNode } from 'react';
import { Alert } from '../../components/ErrorAlert';

export function StripeLinkResultAlert({ result, actions }: { result: StripeLinkResult; actions?: ReactNode }) {
  if (result.error) {
    return (
      <Alert tone="error" title="The Stripe customer was not fully linked" actions={actions}>
        <p>{result.error}</p>
        <p className="mt-1">
          The team exists in Jetstream. Until the customer metadata is set, Stripe webhooks cannot match subscriptions to this team.
          Re-apply the Stripe link to retry.
        </p>
      </Alert>
    );
  }
  return (
    <Alert tone="success" title="Stripe customer linked">
      <p>Customer metadata {result.customerMetadataUpdated ? 'updated' : 'already up to date'}.</p>
      {result.subscriptionsNudged.length > 0 ? (
        <>
          <p className="mt-1">
            Re-saved {result.subscriptionsNudged.length} subscription(s) in Stripe:{' '}
            <span className="font-mono text-xs">{result.subscriptionsNudged.join(', ')}</span>
          </p>
          <p className="mt-1">
            That makes Stripe send a <span className="font-mono text-xs">customer.subscription.updated</span> webhook; the main API syncs
            seats and entitlements when it receives it, usually within seconds. Refresh the team to confirm. If the Seats row still says
            "Awaiting Stripe sync", check the webhook delivery for this event in the Stripe dashboard.
          </p>
        </>
      ) : (
        <p className="mt-1">No subscriptions yet. Seats and entitlements sync automatically once the quote is accepted.</p>
      )}
    </Alert>
  );
}
