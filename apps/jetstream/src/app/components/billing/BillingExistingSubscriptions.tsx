import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { JetstreamPricesByLookupKey, StripeUserFacingCustomer, TeamSeatSummary } from '@jetstream/types';
import { FeedbackLink, ScopedNotification } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { useState } from 'react';
import { Link } from 'react-router';
import { EnhancedBillingCard } from './EnhancedBillingCard';
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  PLAN_DESCRIPTIONS,
  PRO_ANNUAL_KEY,
  PRO_MONTHLY_KEY,
  TEAM_ANNUAL_KEY,
  TEAM_MONTHLY_KEY,
} from './billing.constants';
import { describeSubscriptionItemPricing, formatUsd, getIntervalLabel } from './billing.utils';

interface BillingExistingSubscriptionsProps {
  customerWithSubscriptions: StripeUserFacingCustomer;
  pricesByLookupKey: JetstreamPricesByLookupKey | null;
  hasManualBilling: boolean;
  /** Seat accounting for the user's team; null for individual plans or when the team could not be loaded */
  seats: TeamSeatSummary | null;
  teamId: string | null;
}

/** How a legacy flat-tier plan is billed: a block of included seats plus any purchased beyond it. */
function getSeatsLabel(quantity: number, includedSeats: number): string {
  if (quantity <= includedSeats) {
    return `Your plan includes ${includedSeats} seats.`;
  }
  const additional = quantity - includedSeats;
  return `Your plan includes ${includedSeats} seats plus ${additional} additional ${pluralizeFromNumber('seat', additional)}.`;
}

function getSeatSummaryLabel(seats: TeamSeatSummary): string {
  const parts: string[] = [];
  if (seats.purchased === null) {
    parts.push('Unlimited seats');
  } else {
    parts.push(`${seats.purchased} ${pluralizeFromNumber('seat', seats.purchased)} purchased`);
  }
  parts.push(`${seats.used} in use`);
  if (seats.reserved > 0) {
    parts.push(`${seats.reserved} reserved for invitations`);
  }
  if (seats.available !== null) {
    parts.push(`${seats.available} available`);
  }
  return parts.join(' · ');
}

function formatSeatDate(isoDate: string): string {
  return format(parseISO(isoDate), 'MMMM d, yyyy');
}

export const BillingExistingSubscriptions = ({
  customerWithSubscriptions,
  pricesByLookupKey,
  hasManualBilling,
  seats,
  teamId,
}: BillingExistingSubscriptionsProps) => {
  const { trackEvent } = useAmplitude();

  const activeSubscription = customerWithSubscriptions.subscriptions.find(({ status }) => ACTIVE_SUBSCRIPTION_STATUSES.has(status));
  const activeItem = activeSubscription?.items[0];

  const teamProductId = pricesByLookupKey?.TEAM_MONTHLY?.product?.id;
  const proProductId = pricesByLookupKey?.PRO_MONTHLY?.product?.id;

  const isTeamSubscription = !!activeItem && (activeItem.lookupKey?.startsWith('TEAM_') || activeItem.product === teamProductId);
  const isProSubscription = !!activeItem && (activeItem.lookupKey?.startsWith('PRO_') || activeItem.product === proProductId);

  const matchesCurrentPrice =
    !!activeItem && !!pricesByLookupKey && Object.values(pricesByLookupKey).some((price) => price.id === activeItem.priceId);
  const isLegacyPlan = !!activeItem && !hasManualBilling && !matchesCurrentPrice && (isTeamSubscription || isProSubscription);

  const [selectedPlan, setSelectedPlan] = useState<string | null>(() => {
    if (!activeItem) {
      return null;
    }
    return Object.values(pricesByLookupKey || {}).find((price) => price.id === activeItem.priceId)?.lookupKey || null;
  });

  const handleEnterpriseContact = () => {
    trackEvent(ANALYTICS_KEYS.billing_session, { action: 'enterprise_contact' });
    window.open('mailto:sales@getjetstream.app?subject=Enterprise Plan Inquiry', '_blank');
  };

  const renderSeatDetails = () => {
    if (!isTeamSubscription || !seats) {
      return null;
    }

    const hasPendingDecrease = seats.pending !== null && seats.purchased !== null && seats.pending < seats.purchased;
    const seatsOver = seats.available !== null && seats.available < 0 ? -seats.available : 0;

    return (
      <div className="slds-m-top_x-small slds-text-align_left">
        {hasPendingDecrease && seats.pendingEffectiveAt && (
          <ScopedNotification theme="info" className="slds-m-top_x-small">
            Your seat count will decrease from {seats.purchased} to {seats.pending} on {formatSeatDate(seats.pendingEffectiveAt)}. Seats are
            not refunded for the current period.
          </ScopedNotification>
        )}
        {seats.isOverAllocated && (
          <ScopedNotification theme="warning" className="slds-m-top_x-small">
            Your team is using more seats than it has purchased ({seatsOver} {pluralizeFromNumber('seat', seatsOver)} over). Buy more seats
            or deactivate members to avoid interruption.
          </ScopedNotification>
        )}
        {teamId && (
          <p className="slds-text-body_small slds-m-top_x-small slds-text-align_center">
            {hasManualBilling ? <>Seat limit set by your agreement. Contact support to change it. </> : <>Manage seats from the </>}
            <Link to={APP_ROUTES.TEAM_DASHBOARD.ROUTE}>Team Dashboard</Link>
            {hasManualBilling ? ' shows who is using them.' : '.'}
          </p>
        )}
      </div>
    );
  };

  const renderCurrentPlanSummary = () => {
    if (!activeItem) {
      return null;
    }

    let planLabel = 'Plan';
    if (isTeamSubscription) {
      planLabel = 'Team';
    } else if (isProSubscription) {
      planLabel = 'Professional';
    }

    let badge: string | null = null;
    if (hasManualBilling) {
      badge = 'Custom plan';
    } else if (isLegacyPlan) {
      badge = 'Legacy plan';
    }

    const { total, includedSeats, perSeatRate } = describeSubscriptionItemPricing(activeItem);
    const interval = getIntervalLabel(activeItem.recurringInterval);
    // Amounts are list prices — qualify them when a coupon means the customer actually pays less
    const discountQualifier = activeSubscription?.hasDiscount ? <span className="slds-text-color_weak"> (before discounts)</span> : null;

    return (
      <div className="slds-box slds-box_x-small slds-m-bottom_medium slds-text-align_center">
        <div className="slds-text-heading_small">
          Your current plan: <strong>{planLabel}</strong>
          {badge && (
            <span
              className="slds-badge slds-m-left_x-small"
              style={{ backgroundColor: hasManualBilling ? '#0176d3' : '#706e6b', color: 'white' }}
            >
              {badge}
            </span>
          )}
        </div>
        {isTeamSubscription && seats && (
          <p data-testid="billing-seat-summary" className="slds-text-body_small slds-m-top_x-small">
            {getSeatSummaryLabel(seats)}
          </p>
        )}
        {isTeamSubscription && isLegacyPlan && includedSeats !== null && (
          <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
            {getSeatsLabel(activeItem.quantity, includedSeats)}
          </p>
        )}
        {total !== null && (
          <p className="slds-text-body_small slds-m-top_x-small">
            {isTeamSubscription && perSeatRate !== null && (
              <>
                {activeItem.quantity} × {formatUsd(perSeatRate)}/seat/{interval} ={' '}
              </>
            )}
            <strong>
              {formatUsd(total)}/{interval}
            </strong>
            {discountQualifier}
          </p>
        )}
        {renderSeatDetails()}
        {isLegacyPlan && (
          <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
            You are on a legacy plan. The plans below show current pricing, and your rate does not change unless you switch plans.
          </p>
        )}
        {hasManualBilling && (
          <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
            You have a custom billing arrangement. Contact support for plan changes.
          </p>
        )}
      </div>
    );
  };

  return (
    <div>
      {renderCurrentPlanSummary()}

      {!hasManualBilling && (
        <div className="slds-text-align_center slds-m-bottom_medium">
          <p className="slds-text-color_weak">
            Visit the billing portal to make changes to your plan.{' '}
            <FeedbackLink type="EMAIL" label="Contact us for assistance" emailLinkParams={{ subject: 'Billing question' }} />.
          </p>
        </div>
      )}

      <div
        className="slds-grid slds-wrap slds-gutters slds-grid_align-center"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem',
          alignItems: 'stretch',
        }}
      >
        <EnhancedBillingCard
          planName="Professional"
          price={PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].price}
          priceSubtext={PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].priceSubtext}
          description={PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].description}
          features={PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].features}
          checked={!hasManualBilling && selectedPlan === PRO_MONTHLY_KEY}
          disabled={hasManualBilling || selectedPlan !== PRO_MONTHLY_KEY}
          value={PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].key}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Professional"
          price={PLAN_DESCRIPTIONS[PRO_ANNUAL_KEY].price}
          priceSubtext={PLAN_DESCRIPTIONS[PRO_ANNUAL_KEY].priceSubtext}
          description={PLAN_DESCRIPTIONS[PRO_ANNUAL_KEY].description}
          features={PLAN_DESCRIPTIONS[PRO_ANNUAL_KEY].features}
          checked={!hasManualBilling && selectedPlan === PRO_ANNUAL_KEY}
          disabled={hasManualBilling || selectedPlan !== PRO_ANNUAL_KEY}
          value={PLAN_DESCRIPTIONS[PRO_ANNUAL_KEY].key}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Team"
          price={PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].price}
          priceSubtext={PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].priceSubtext}
          description={PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].description}
          features={PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].features}
          pricingTiers={PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].pricingTiers}
          checked={!hasManualBilling && selectedPlan === TEAM_MONTHLY_KEY}
          disabled={hasManualBilling || selectedPlan !== TEAM_MONTHLY_KEY}
          value={PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].key}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Team"
          price={PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].price}
          priceSubtext={PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].priceSubtext}
          description={PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].description}
          features={PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].features}
          pricingTiers={PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].pricingTiers}
          checked={!hasManualBilling && selectedPlan === TEAM_ANNUAL_KEY}
          disabled={hasManualBilling || selectedPlan !== TEAM_ANNUAL_KEY}
          value={PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].key}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Enterprise"
          price={PLAN_DESCRIPTIONS.CUSTOM.price}
          priceSubtext={PLAN_DESCRIPTIONS.CUSTOM.priceSubtext}
          description={PLAN_DESCRIPTIONS.CUSTOM.description}
          features={PLAN_DESCRIPTIONS.CUSTOM.features}
          isEnterprise
          disabled
          onEnterpriseContact={handleEnterpriseContact}
        />
      </div>

      <div className="slds-text-align_center slds-m-top_large">
        <div className="slds-box slds-box_small slds-m-top_medium">
          <p className="slds-text-heading_small slds-m-bottom_x-small">Are you a current sponsor through GitHub?</p>
          <p className="slds-text-body_small">
            If you would like to continue your sponsorship through GitHub, send us an email with your GitHub username to get access to the
            pro plan.
          </p>
        </div>
      </div>
    </div>
  );
};
