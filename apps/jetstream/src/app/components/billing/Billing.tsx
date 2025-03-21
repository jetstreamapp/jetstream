import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { getSubscriptions } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useRollbar, useTitle } from '@jetstream/shared/ui-utils';
import { StripeUserFacingCustomer } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Icon,
  Page,
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { JetstreamProLogo, useAmplitude } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { environment } from '../../../environments/environment';
import { BillingExistingSubscriptions } from './BillingExistingSubscriptions';
import BillingPlanCard from './BillingPlanCard';

const HEIGHT_BUFFER = 170;

export const Billing = () => {
  useTitle(TITLES.SETTINGS);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const setUserProfile = useSetRecoilState(fromAppState.userProfileState);
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(environment.STRIPE_PRO_MONTHLY_PRICE_ID);
  const [customerWithSubscriptions, setCustomerWithSubscriptions] = useState<StripeUserFacingCustomer | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    hasCanceledSubscriptions: false,
    hasFutureDatedCancellation: false,
    hasActiveSubscriptions: false,
  });
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
      const { customer, didUpdate, userProfile } = await getSubscriptions();
      if (userProfile) {
        // this ensures that all entitlements are updated across the application to match what is on the server
        setUserProfile(userProfile);
      }
      const hasCanceledSubscriptions = customer?.subscriptions.some((item) => item.cancelAt || item.endedAt) ?? false;
      const hasFutureDatedCancellation = customer?.subscriptions.some((item) => item.cancelAtPeriodEnd) ?? false;
      const hasActiveSubscriptions = customer?.subscriptions.some((item) => item.status === 'ACTIVE') ?? false;
      setSubscriptionStatus({ hasCanceledSubscriptions, hasFutureDatedCancellation, hasActiveSubscriptions });
      setCustomerWithSubscriptions(customer);
    } catch (ex) {
      logger.error('Settings: Error fetching user', { stack: ex.stack, message: ex.message });
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
          <PageHeaderTitle icon={{ type: 'standard', icon: 'billing' }} label="Billing" docsPath={APP_ROUTES.BILLING.DOCS} />
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-around_small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {loading && <Spinner />}
        {loadingError && (
          <ScopedNotification theme="error" className="slds-m-vertical_medium">
            There was a problem loading your profile. Try again or file a support ticket for assistance.
          </ScopedNotification>
        )}

        {subscriptionStatus.hasFutureDatedCancellation && (
          <ScopedNotification theme="info" className="slds-m-around_medium">
            Your plan is scheduled to be canceled, visit the Billing Portal view more information or to resume service.
          </ScopedNotification>
        )}

        {customerWithSubscriptions && (
          <div className="slds-box slds-box_small slds-m-bottom_small">
            <form
              method="POST"
              action="/api/billing/portal"
              target="_blank"
              onSubmit={() => trackEvent(ANALYTICS_KEYS.billing_portal, { action: 'click', location: 'cta_button' })}
            >
              <p className="slds-text-heading_small">Visit the Billing Portal to manage your billing information</p>
              <ul className="slds-list_dotted slds-m-bottom_small">
                <li>Change plans</li>
                <li>Manage your payment methods</li>
                <li>Update your billing information</li>
                <li>View payment history</li>
                <li>View invoice history</li>
                <li>Cancel</li>
              </ul>
              <button className="slds-button slds-button_brand">
                Billing Portal
                <Icon type="utility" icon="new_window" className="slds-button__icon slds-m-left_x-small" omitContainer />
              </button>
            </form>
          </div>
        )}

        <div className="slds-box slds-box_small slds-m-bottom_small">
          {(!customerWithSubscriptions || !subscriptionStatus.hasActiveSubscriptions) && (
            <JetstreamProLogo width="250px" className="slds-m-bottom_x-small" />
          )}
          <p className="slds-text-heading_medium">Jetstream Professional Includes:</p>
          <ul className="slds-list_dotted slds-m-bottom_small">
            <li>
              Access to the{' '}
              <a
                href={APP_ROUTES.CHROME_EXTENSION.ROUTE}
                target="_blank"
                className="slds-text-heading_x-small"
                rel="noreferrer"
                onClick={() => trackEvent(ANALYTICS_KEYS.chrome_extension_link, { action: 'clicked', source: 'billing_page' })}
              >
                Chrome Extension
              </a>{' '}
              and{' '}
              <a
                href={APP_ROUTES.FIREFOX_EXTENSION.ROUTE}
                target="_blank"
                className="slds-text-heading_x-small"
                rel="noreferrer"
                onClick={() => trackEvent(ANALYTICS_KEYS.firefox_extension_link, { action: 'clicked', source: 'billing_page' })}
              >
                Firefox Extension
              </a>
            </li>
            <li>Save query history across devices</li>
            <li>Save downloads to Google Drive</li>
            <li>Load data from Google Drive</li>
          </ul>
        </div>

        <div className="slds-box slds-box_small">
          {customerWithSubscriptions && subscriptionStatus.hasActiveSubscriptions ? (
            <BillingExistingSubscriptions customerWithSubscriptions={customerWithSubscriptions} />
          ) : (
            <form
              method="POST"
              action="/api/billing/checkout-session"
              onSubmit={() => trackEvent(ANALYTICS_KEYS.billing_session, { action: 'create_session', priceId: selectedPlan })}
            >
              <fieldset className="slds-form-element" role="radiogroup">
                <legend className="slds-form-element__legend slds-form-element__label">Select a plan</legend>
                <div className="slds-form-element__control">
                  <BillingPlanCard
                    descriptionTitle="Professional - Monthly"
                    description="Get started with Professional."
                    checked={selectedPlan === environment.STRIPE_PRO_MONTHLY_PRICE_ID}
                    value={environment.STRIPE_PRO_MONTHLY_PRICE_ID}
                    price="$25"
                    priceDescription="Billed Monthly"
                    onChange={setSelectedPlan}
                  />
                  <BillingPlanCard
                    descriptionTitle="Professional - Annual"
                    description="Get two months free."
                    checked={selectedPlan === environment.STRIPE_PRO_ANNUAL_PRICE_ID}
                    value={environment.STRIPE_PRO_ANNUAL_PRICE_ID}
                    price="$250"
                    priceDescription="Billed Annually"
                    onChange={setSelectedPlan}
                  />
                  {/* <BillingPlanCard descriptionTitle="Team - Annual" price="Coming Soon" priceDescription="Billed Annually" disabled /> */}
                </div>
              </fieldset>
              <button type="submit" className="slds-button slds-button_brand slds-m-top_medium">
                Subscribe
              </button>
            </form>
          )}
        </div>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default Billing;
