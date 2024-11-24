import { TITLES } from '@jetstream/shared/constants';
import { getSubscriptions } from '@jetstream/shared/data';
import { useRollbar, useTitle } from '@jetstream/shared/ui-utils';
import { Subscription } from '@jetstream/types';
import { AutoFullHeightContainer, Page, PageHeader, PageHeaderRow, PageHeaderTitle, ScopedNotification, Spinner } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { environment } from '../../../environments/environment';
import BillingPlanCard from './BillingPlanCard';

const HEIGHT_BUFFER = 170;

export const Billing = () => {
  useTitle(TITLES.SETTINGS);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(environment.STRIPE_MONTHLY_PRICE_ID);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      setLoadingError(false);

      const subscribeAction = searchParams.get('subscribeAction');
      if (subscribeAction === 'success') {
        // TODO: should we do something on the server - like ensure server has the subscription?
        // depending on webhook timing, we may want to do this here
      }

      setSubscriptions(await getSubscriptions());
    } catch (ex) {
      rollbar.error('Settings: Error fetching user', { stack: ex.stack, message: ex.message });
      setLoadingError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  return (
    <Page testId="billing-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'your_account' }} label="Billing" />
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-around_small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {/* Settings */}
        {loading && <Spinner />}
        {loadingError && (
          <ScopedNotification theme="error" className="slds-m-vertical_medium">
            There was a problem loading your profile. Try again or file a support ticket for assistance.
          </ScopedNotification>
        )}
        <form method="POST" action="/api/billing/checkout-session">
          <fieldset className="slds-form-element" role="radiogroup">
            <legend className="slds-form-element__legend slds-form-element__label">Select a plan</legend>
            <div className="slds-form-element__control">
              <BillingPlanCard
                checked={selectedPlan === environment.STRIPE_MONTHLY_PRICE_ID}
                value={environment.STRIPE_MONTHLY_PRICE_ID}
                price="$25"
                priceDescription="Billed Monthly"
                onChange={setSelectedPlan}
              />
              <BillingPlanCard
                checked={selectedPlan === environment.STRIPE_ANNUAL_PRICE_ID}
                value={environment.STRIPE_ANNUAL_PRICE_ID}
                price="$275"
                priceDescription="Billed Annually"
                onChange={setSelectedPlan}
              />
              {/* Coming soon team plan or something? */}
              {/* <BillingPlanCard /> */}
            </div>
          </fieldset>
          <button type="submit" className="slds-button slds-button_brand slds-m-top_medium">
            Subscribe
          </button>
        </form>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default Billing;
