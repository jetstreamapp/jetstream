import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { StripeUserFacingCustomer } from '@jetstream/types';
import { FeedbackLink } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { useState } from 'react';
import { environment } from '../../../environments/environment';
import { EnhancedBillingCard } from './EnhancedBillingCard';

interface BillingExistingSubscriptionsProps {
  customerWithSubscriptions: StripeUserFacingCustomer;
}

export const BillingExistingSubscriptions = ({ customerWithSubscriptions }: BillingExistingSubscriptionsProps) => {
  const { trackEvent } = useAmplitude();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(
    () => customerWithSubscriptions.subscriptions.find((sub) => sub.status === 'ACTIVE')?.items[0].priceId || null
  );

  const professionalFeatures = [
    'Desktop Application',
    'Browser Extensions (Chrome & Firefox)',
    'Save query history across devices',
    'Save downloads to Google Drive',
    'Load data from Google Drive',
    'Priority support',
  ];

  const teamFeatures = [
    'Everything in Professional',
    'Manage team members',
    'Up to 20 team members',
    'View team member login activity',
    'Share orgs between team members',
    'Role-based access control',
    'SSO via Okta',
  ];

  const enterpriseFeatures = [
    'Everything in Team',
    'Unlimited team members',
    'Single Sign-On (SSO)',
    'Custom agreements and terms',
    'Dedicated account manager',
    'Advanced security controls',
    'White-glove onboarding',
  ];

  const handleEnterpriseContact = () => {
    trackEvent(ANALYTICS_KEYS.billing_session, { action: 'enterprise_contact' });
    window.open('mailto:sales@getjetstream.app?subject=Enterprise Plan Inquiry', '_blank');
  };

  return (
    <div>
      <div className="slds-text-align_center slds-m-bottom_medium">
        <h2 className="slds-text-heading_medium">Your Current Plan</h2>
        <p className="slds-text-color_weak">Visit the billing portal to make changes</p>
      </div>

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
          checked={selectedPlan === environment.STRIPE_PRO_MONTHLY_PRICE_ID}
          disabled={selectedPlan !== environment.STRIPE_PRO_MONTHLY_PRICE_ID}
          value={environment.STRIPE_PRO_MONTHLY_PRICE_ID}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Professional"
          price="$250"
          priceSubtext="/year"
          description="Save 2 months with annual billing"
          features={professionalFeatures}
          checked={selectedPlan === environment.STRIPE_PRO_ANNUAL_PRICE_ID}
          disabled={selectedPlan !== environment.STRIPE_PRO_ANNUAL_PRICE_ID}
          value={environment.STRIPE_PRO_ANNUAL_PRICE_ID}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Team"
          price="$110"
          priceSubtext="/month (includes 5 users)"
          description="$22/user/month with 5-user minimum"
          features={teamFeatures}
          checked={selectedPlan === environment.STRIPE_TEAM_MONTHLY_PRICE_ID}
          disabled={selectedPlan !== environment.STRIPE_TEAM_MONTHLY_PRICE_ID}
          value={environment.STRIPE_TEAM_MONTHLY_PRICE_ID}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Team"
          price="$1,100"
          priceSubtext="/year (includes 5 users)"
          description="$22/user/month with 5-user minimum"
          features={teamFeatures}
          checked={selectedPlan === environment.STRIPE_TEAM_ANNUAL_PRICE_ID}
          disabled={selectedPlan !== environment.STRIPE_TEAM_ANNUAL_PRICE_ID}
          value={environment.STRIPE_TEAM_ANNUAL_PRICE_ID}
          onChange={setSelectedPlan}
        />
        <EnhancedBillingCard
          planName="Enterprise"
          price="Custom"
          priceSubtext="Contact us"
          description="Advanced features for large teams"
          features={enterpriseFeatures}
          isEnterprise={true}
          disabled={true}
          onEnterpriseContact={handleEnterpriseContact}
        />
      </div>

      <div className="slds-text-align_center slds-m-top_large">
        <form method="POST" action="/api/billing/portal" target="_blank" className="slds-m-bottom_medium">
          <button
            type="submit"
            className="slds-button slds-button_brand"
            onClick={() => trackEvent(ANALYTICS_KEYS.billing_portal, { action: 'click', location: 'existing_subscriptions' })}
          >
            Manage Billing
          </button>
        </form>
        
        <FeedbackLink
          onClick={() => trackEvent(ANALYTICS_KEYS.billing_portal, { action: 'click', location: 'cta_button' })}
          type="EMAIL"
          omitInNewWindowIcon
          label="Have questions or need help? Send us an email."
        />
        
        <div className="slds-box slds-box_small slds-m-top_medium">
          <p className="slds-text-heading_small slds-m-bottom_x-small">Are you a current sponsor through GitHub?</p>
          <p className="slds-text-body_small">
            If you would like to continue your sponsorship through GitHub, send us an email with your GitHub username to get access to the pro plan.
          </p>
        </div>
      </div>
    </div>
  );
};
