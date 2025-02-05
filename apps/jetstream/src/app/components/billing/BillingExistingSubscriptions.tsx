import { StripeUserFacingCustomer } from '@jetstream/types';
import { FeedbackLink } from '@jetstream/ui';
import { useState } from 'react';
import { environment } from '../../../environments/environment';
import BillingPlanCard from './BillingPlanCard';

interface BillingExistingSubscriptionsProps {
  customerWithSubscriptions: StripeUserFacingCustomer;
}

export const BillingExistingSubscriptions = ({ customerWithSubscriptions }: BillingExistingSubscriptionsProps) => {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(
    () => customerWithSubscriptions.subscriptions.find((sub) => sub.status === 'ACTIVE')?.items[0].priceId || null
  );

  return (
    <div>
      <fieldset className="slds-form-element" role="radiogroup">
        <legend className="slds-form-element__legend slds-form-element__label">Your current plan</legend>
        <div className="slds-form-element__control">
          <BillingPlanCard
            descriptionTitle="Professional - Monthly"
            description="Get started with Jetstream Professional."
            checked={selectedPlan === environment.STRIPE_PRO_MONTHLY_PRICE_ID}
            disabled={selectedPlan !== environment.STRIPE_PRO_MONTHLY_PRICE_ID}
            value={environment.STRIPE_PRO_MONTHLY_PRICE_ID}
            price="$25"
            priceDescription="Billed Monthly"
            onChange={setSelectedPlan}
          />
          <BillingPlanCard
            descriptionTitle="Professional - Annual"
            description="Get two months for free from the monthly plan."
            checked={selectedPlan === environment.STRIPE_PRO_ANNUAL_PRICE_ID}
            disabled={selectedPlan !== environment.STRIPE_PRO_ANNUAL_PRICE_ID}
            value={environment.STRIPE_PRO_ANNUAL_PRICE_ID}
            price="$275"
            priceDescription="Billed Annually"
            onChange={setSelectedPlan}
          />
          {/* <BillingPlanCard descriptionTitle="Team - Annual" price="Coming Soon" priceDescription="Billed Annually" disabled /> */}
        </div>
        <form method="POST" action="/api/billing/portal" target="_blank" className="slds-m-bottom_x-small">
          <p className="slds-text-body_small">
            To change plans, visit the
            <button className="slds-button slds-m-left_xx-small">billing portal</button>.
          </p>
        </form>
        <FeedbackLink type="EMAIL" omitInNewWindowIcon label="Have questions or need help? Send us an email." />
      </fieldset>
    </div>
  );
};
