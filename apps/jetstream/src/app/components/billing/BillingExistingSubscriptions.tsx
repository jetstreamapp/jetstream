import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { JetstreamPricesByLookupKey, StripeUserFacingCustomer, StripeUserFacingSubscriptionItem } from '@jetstream/types';
import { useAmplitude } from '@jetstream/ui-core';
import { useState } from 'react';
import { EnhancedBillingCard } from './EnhancedBillingCard';
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  PLAN_DESCRIPTIONS,
  PRO_ANNUAL_KEY,
  PRO_MONTHLY_KEY,
  TEAM_ANNUAL_KEY,
  TEAM_MONTHLY_KEY,
} from './billing.constants';

interface BillingExistingSubscriptionsProps {
  customerWithSubscriptions: StripeUserFacingCustomer;
  pricesByLookupKey: JetstreamPricesByLookupKey | null;
  hasManualBilling: boolean;
}

const formatUsd = (amountInCents: number) => `$${(amountInCents / 100).toFixed(2).replace(/\.00$/, '')}`;

const intervalLabel = (interval: StripeUserFacingSubscriptionItem['recurringInterval']) => {
  switch (interval) {
    case 'MONTH':
      return 'month';
    case 'YEAR':
      return 'year';
    case 'WEEK':
      return 'week';
    case 'DAY':
      return 'day';
    default:
      return 'period';
  }
};

export const BillingExistingSubscriptions = ({
  customerWithSubscriptions,
  pricesByLookupKey,
  hasManualBilling,
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
    window.open('mailto:support@getjetstream.app?subject=Enterprise Plan Inquiry', '_blank');
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

    const perSeat = formatUsd(activeItem.unitAmount);
    const total = formatUsd(activeItem.unitAmount * activeItem.quantity);
    const interval = intervalLabel(activeItem.recurringInterval);

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
        {isTeamSubscription ? (
          <p className="slds-text-body_small slds-m-top_x-small">
            {activeItem.quantity} {activeItem.quantity === 1 ? 'seat' : 'seats'} × {perSeat}/seat/{interval} ={' '}
            <strong>
              {total}/{interval}
            </strong>
          </p>
        ) : (
          <p className="slds-text-body_small slds-m-top_x-small">
            <strong>
              {perSeat}/{interval}
            </strong>
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
          <p className="slds-text-color_weak">Visit the billing portal to make changes to your plan</p>
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
          comingSoonFeatures={PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].comingSoonFeatures}
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
          comingSoonFeatures={PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].comingSoonFeatures}
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
