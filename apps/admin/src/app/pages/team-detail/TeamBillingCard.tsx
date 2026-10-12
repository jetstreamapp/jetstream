import { StripeLinkResult, TeamDetail } from '@jetstream/admin/types';
import { useState } from 'react';
import { apiPost } from '../../api/admin-api-client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorAlert } from '../../components/ErrorAlert';
import { StripeIdLink } from '../../components/ExternalLink';
import { KeyValueList } from '../../components/KeyValueList';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { EMPTY_VALUE, formatDate, formatNumber, getStripeDashboardUrl } from '../../utils/format';
import { StripeLinkResultAlert } from './StripeLinkResultAlert';

export function TeamBillingCard({ team, onChanged }: { team: TeamDetail; onChanged: () => void }) {
  const { billingAccount, seats } = team;
  const [linkResult, setLinkResult] = useState<StripeLinkResult | null>(null);
  const { run: reapplyStripeLink, loading, error } = useAsyncAction(() => apiPost<StripeLinkResult>(`/api/teams/${team.id}/stripe-link`));

  async function handleReapplyStripeLink() {
    const result = await reapplyStripeLink();
    if (result) {
      setLinkResult(result);
      onChanged();
    }
  }

  return (
    <Card
      title="Billing"
      actions={
        billingAccount ? (
          <Button
            size="sm"
            onClick={handleReapplyStripeLink}
            loading={loading}
            title="Re-save the customer metadata and nudge subscriptions to re-sync"
          >
            Re-apply Stripe link
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {error && <ErrorAlert error={error} title="Unable to re-apply the Stripe link" />}
        {linkResult && <StripeLinkResultAlert result={linkResult} />}
        {billingAccount ? (
          <KeyValueList
            items={[
              {
                label: 'Stripe customer',
                value: <StripeIdLink id={billingAccount.customerId} href={getStripeDashboardUrl(billingAccount.customerId)} />,
              },
              {
                label: 'Seat limit',
                value: billingAccount.manualBilling ? (
                  <Badge tone="purple" title="manualBilling: team admins cannot change seats and Stripe sync leaves the limit alone">
                    Fixed by agreement
                  </Badge>
                ) : (
                  <Badge title="Follows the Stripe subscription quantity; team admins can change seats">Follows subscription</Badge>
                ),
              },
              {
                label: 'Seats',
                value: (
                  <span className="tabular-nums">
                    {formatNumber(seats.used)} used of {seats.limit === null ? 'uncapped' : formatNumber(seats.limit)}
                    {seats.reserved > 0 && (
                      <span className="text-slate-500"> · {formatNumber(seats.reserved)} reserved by invitations</span>
                    )}
                  </span>
                ),
              },
              { label: 'Stripe seat quantity', value: formatNumber(billingAccount.seatQuantity) },
              { label: 'Included seats', value: formatNumber(billingAccount.includedSeats) },
              { label: 'Period end', value: formatDate(billingAccount.seatPeriodEnd) },
              {
                label: 'Pending decrease',
                value:
                  billingAccount.pendingSeatQuantity !== null
                    ? `${formatNumber(billingAccount.pendingSeatQuantity)} seats on ${formatDate(billingAccount.pendingSeatEffectiveAt)}`
                    : EMPTY_VALUE,
              },
            ]}
          />
        ) : (
          <p className="text-sm text-slate-500">This team has no billing account.</p>
        )}
      </div>
    </Card>
  );
}
