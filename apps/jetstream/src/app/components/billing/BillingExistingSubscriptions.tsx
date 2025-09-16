import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { JetstreamPricesByLookupKey, StripeUserFacingCustomer } from '@jetstream/types';
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

export const BillingExistingSubscriptions = ({
  customerWithSubscriptions,
  pricesByLookupKey,
  hasManualBilling,
}: BillingExistingSubscriptionsProps) => {
  const { trackEvent } = useAmplitude();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(() => {
    const priceId =
      customerWithSubscriptions.subscriptions.find(({ status }) => ACTIVE_SUBSCRIPTION_STATUSES.has(status))?.items[0].priceId || null;
    if (priceId) {
      return Object.values(pricesByLookupKey || {}).find((price) => price.id === priceId)?.lookupKey || null;
    }
    return null;
  });

  const handleEnterpriseContact = () => {
    trackEvent(ANALYTICS_KEYS.billing_session, { action: 'enterprise_contact' });
    window.open('mailto:support@getjetstream.app?subject=Enterprise Plan Inquiry', '_blank');
  };

  return (
    <div>
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
