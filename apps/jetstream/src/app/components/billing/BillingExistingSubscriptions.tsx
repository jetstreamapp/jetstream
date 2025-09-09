import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { JetstreamPricesByLookupKey, StripeUserFacingCustomer } from '@jetstream/types';
import { useAmplitude } from '@jetstream/ui-core';
import { useState } from 'react';
import { EnhancedBillingCard } from './EnhancedBillingCard';
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  enterpriseFeatures,
  PRO_ANNUAL_KEY,
  PRO_MONTHLY_KEY,
  professionalFeatures,
  TEAM_ANNUAL_KEY,
  TEAM_MONTHLY_KEY,
  teamFeatures,
  teamFeaturesComingSoon,
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
      customerWithSubscriptions.subscriptions.find(({ status }) => ACTIVE_SUBSCRIPTION_STATUSES.has(status))?.items[0].priceId || null;,
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
          price="$25"
          priceSubtext="/month"
          description="Perfect for individual users"
          features={professionalFeatures}
          checked={!hasManualBilling && selectedPlan === PRO_MONTHLY_KEY}
          disabled={hasManualBilling || selectedPlan !== PRO_MONTHLY_KEY}
          value={PRO_MONTHLY_KEY}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Professional"
          price="$250"
          priceSubtext="/year"
          description="Save 2 months with annual billing"
          features={professionalFeatures}
          checked={!hasManualBilling && selectedPlan === PRO_ANNUAL_KEY}
          disabled={hasManualBilling || selectedPlan !== PRO_ANNUAL_KEY}
          value={PRO_ANNUAL_KEY}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Team"
          price="$110"
          priceSubtext="/month (includes 5 users)"
          description="$22/user/month with 5-user minimum"
          features={teamFeatures}
          comingSoonFeatures={teamFeaturesComingSoon}
          checked={!hasManualBilling && selectedPlan === TEAM_MONTHLY_KEY}
          disabled={hasManualBilling || selectedPlan !== TEAM_MONTHLY_KEY}
          value={TEAM_MONTHLY_KEY}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Team"
          price="$1,100"
          priceSubtext="/year (includes 5 users)"
          description="$22/user/month with 5-user minimum"
          features={teamFeatures}
          comingSoonFeatures={teamFeaturesComingSoon}
          checked={!hasManualBilling && selectedPlan === TEAM_ANNUAL_KEY}
          disabled={hasManualBilling || selectedPlan !== TEAM_ANNUAL_KEY}
          value={TEAM_ANNUAL_KEY}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Enterprise"
          price="Custom"
          priceSubtext="Contact us"
          description="Advanced features for large teams"
          features={enterpriseFeatures}
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
