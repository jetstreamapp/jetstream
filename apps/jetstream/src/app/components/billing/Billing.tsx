import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, HTTP, TITLES } from '@jetstream/shared/constants';
import { getCsrfTokenFromCookie, getSubscriptions, initCheckoutSession } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useRollbar, useTitle } from '@jetstream/shared/ui-utils';
import { JetstreamPricesByLookupKey, Maybe, StripePriceKey, StripeUserFacingCustomer } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  FeedbackLink,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  PAST_DUE_SUBSCRIPTION_STATUSES,
  PLAN_DESCRIPTIONS,
  PRO_ANNUAL_KEY,
  PRO_MONTHLY_KEY,
  TEAM_ANNUAL_KEY,
  TEAM_MONTHLY_KEY,
  UNPAID_SUBSCRIPTION_STATUSES,
} from './billing.constants';
import { BillingExistingSubscriptions } from './BillingExistingSubscriptions';
import { BillingPeriodToggle } from './BillingPeriodToggle';
import { EnhancedBillingCard } from './EnhancedBillingCard';

const HEIGHT_BUFFER = 170;

export const Billing = () => {
  useTitle(TITLES.BILLING);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const [userProfile, setUserProfile] = useAtom(fromAppState.userProfileState);
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [checkoutSessionLoading, setCheckoutSessionLoading] = useState(false);
  const [checkoutSessionError, setCheckoutSessionError] = useState<Maybe<string>>();
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<StripePriceKey>(
    userProfile.teamMembership?.team.id ? TEAM_MONTHLY_KEY : PRO_MONTHLY_KEY,
  );
  const [customerWithSubscriptions, setCustomerWithSubscriptions] = useState<StripeUserFacingCustomer | null>(null);
  const [pricesByLookupKey, setPricesByLookupKey] = useState<JetstreamPricesByLookupKey | null>(null);
  const [hasManualBilling, setHasManualBilling] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    hasActiveSubscriptions: false,
    hasCanceledSubscriptions: false,
    hasFutureDatedCancellation: false,
    hasPastDueSubscriptions: false,
    hasUnPaidSubscriptions: false,
  });
  const [searchParams] = useSearchParams();
  const [csrfToken] = useState(() => getCsrfTokenFromCookie());

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      setLoadingError(false);

      const subscribeAction = searchParams.get('subscribeAction');
      if (subscribeAction === 'success') {
        // TODO: should we do something on the server - like ensure server has the subscription?
        // depending on webhook timing, we may want to do this here
      }
      const { customer, pricesByLookupKey, hasManualBilling, didUpdate, userProfile } = await getSubscriptions();
      if (userProfile) {
        // this ensures that all entitlements are updated across the application to match what is on the server
        setUserProfile(userProfile);
      }
      const hasActiveSubscriptions = customer?.subscriptions.some((item) => ACTIVE_SUBSCRIPTION_STATUSES.has(item.status)) ?? false;
      const hasCanceledSubscriptions = customer?.subscriptions.some((item) => item.cancelAt || item.endedAt) ?? false;
      const hasFutureDatedCancellation = customer?.subscriptions.some((item) => item.cancelAtPeriodEnd) ?? false;
      const hasPastDueSubscriptions = customer?.subscriptions.some((item) => PAST_DUE_SUBSCRIPTION_STATUSES.has(item.status)) ?? false;
      const hasUnPaidSubscriptions = customer?.subscriptions.some((item) => UNPAID_SUBSCRIPTION_STATUSES.has(item.status)) ?? false;
      setSubscriptionStatus({
        hasActiveSubscriptions,
        hasCanceledSubscriptions,
        hasFutureDatedCancellation,
        hasPastDueSubscriptions,
        hasUnPaidSubscriptions,
      });
      setCustomerWithSubscriptions(customer);
      setPricesByLookupKey(pricesByLookupKey);
      setHasManualBilling(hasManualBilling);
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

  useEffect(() => {
    // Update selected plan when billing period changes
    if (selectedPlan === PRO_MONTHLY_KEY && isAnnual) {
      setSelectedPlan(PRO_ANNUAL_KEY);
    } else if (selectedPlan === PRO_ANNUAL_KEY && !isAnnual) {
      setSelectedPlan(PRO_MONTHLY_KEY);
    } else if (selectedPlan === TEAM_MONTHLY_KEY && isAnnual) {
      setSelectedPlan(TEAM_ANNUAL_KEY);
    } else if (selectedPlan === TEAM_ANNUAL_KEY && !isAnnual) {
      setSelectedPlan(TEAM_MONTHLY_KEY);
    }
  }, [isAnnual, selectedPlan]);

  const handleCheckoutSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      setCheckoutSessionLoading(true);
      setCheckoutSessionError(null);

      const { url } = await initCheckoutSession({ priceLookupKey: selectedPlan });
      // Redirect
      location.href = url;
      // Track analytics for enterprise contact
      trackEvent(ANALYTICS_KEYS.billing_session, { action: 'create_session', priceId: selectedPlan });
    } catch (ex) {
      rollbar.error('There was an error initiating your checkout session', { stack: ex.stack, message: ex.message });
      setCheckoutSessionError('There was an error initiating your checkout session, please contact support for assistance.');
    } finally {
      setCheckoutSessionLoading(false);
    }
  };

  const handleEnterpriseContact = () => {
    // Track analytics for enterprise contact
    trackEvent(ANALYTICS_KEYS.billing_session, { action: 'enterprise_contact' });
    // Open email or contact form
    window.open('mailto:sales@getjetstream.app?subject=Enterprise Plan Inquiry', '_blank');
  };

  const disableProPlan = !!userProfile.teamMembership?.team.id;

  return (
    <Page testId="billing-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'billing' }} label="Billing" docsPath={APP_ROUTES.BILLING.DOCS} />
          {customerWithSubscriptions && (
            <PageHeaderActions colType="actions" buttonType="separate">
              <form method="POST" action="/api/billing/portal" target="_blank">
                {csrfToken && <input type="hidden" name={HTTP.BODY.CSRF_TOKEN} value={csrfToken} />}
                <button className="slds-button slds-button_brand">
                  Billing Portal
                  <Icon type="utility" icon="new_window" className="slds-button__icon slds-m-left_x-small" omitContainer />
                </button>
              </form>
            </PageHeaderActions>
          )}
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-around_small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {loading && <Spinner />}
        {loadingError && (
          <ScopedNotification theme="error" className="slds-m-vertical_medium">
            There was a problem loading your profile. Try again or file a support ticket for assistance.
          </ScopedNotification>
        )}
        {!loading && (
          <>
            {subscriptionStatus.hasFutureDatedCancellation && (
              <ScopedNotification theme="info" className="slds-m-bottom_medium">
                Your plan is scheduled to be canceled, visit the Billing Portal view more information or to resume service.
              </ScopedNotification>
            )}

            {subscriptionStatus.hasPastDueSubscriptions && (
              <ScopedNotification theme="warning" className="slds-m-bottom_medium">
                Your account is past due, visit the Billing Portal to resolve your unpaid invoices or contact support for assistance.
              </ScopedNotification>
            )}

            {subscriptionStatus.hasUnPaidSubscriptions && (
              <ScopedNotification theme="info" className="slds-m-bottom_medium">
                You have unpaid invoices, visit the Billing Portal to view your open invoices and make a payment.
              </ScopedNotification>
            )}

            <div className="slds-box slds-box_small slds-m-bottom_small">
              <p className="slds-text-heading_small slds-m-bottom_x-small">Visit the Billing Portal to manage your billing information</p>
              {customerWithSubscriptions && !hasManualBilling && (
                <ul className="slds-list_horizontal slds-has-dividers_left slds-wrap slds-p-bottom_x-small">
                  <li className="slds-item read-only">Change plans</li>
                  <li className="slds-item read-only">Manage your payment methods</li>
                  <li className="slds-item read-only">Update your billing information</li>
                  <li className="slds-item read-only">View payment history</li>
                  <li className="slds-item read-only">View invoice history</li>
                  <li className="slds-item read-only">Cancel</li>
                </ul>
              )}

              {customerWithSubscriptions && hasManualBilling && (
                <>
                  <ul className="slds-list_horizontal slds-has-dividers_left slds-wrap slds-p-bottom_x-small">
                    <li className="slds-item read-only">Manage your payment methods</li>
                    <li className="slds-item read-only">Update your billing information</li>
                    <li className="slds-item read-only">View payment history</li>
                    <li className="slds-item read-only">View invoice history</li>
                  </ul>
                  <p className="slds-p-bottom_x-small">
                    Because you have a custom billing arrangement, you may need to contact support to make certain changes to your service.
                  </p>
                </>
              )}
              <FeedbackLink label="Have a question or need help? Send us an email." type="EMAIL" omitInNewWindowIcon />
            </div>

            {checkoutSessionError && (
              <ScopedNotification theme="error" className="slds-m-bottom_medium">
                {checkoutSessionError}
              </ScopedNotification>
            )}

            {(!customerWithSubscriptions || !subscriptionStatus.hasActiveSubscriptions) && (
              <div className="slds-text-align_center slds-p-vertical_medium">
                <h2 className="slds-text-heading_medium slds-text-color_weak">Unlock the full potential of your Salesforce workflow</h2>
              </div>
            )}

            <div className="slds-p-horizontal_small">
              {customerWithSubscriptions && subscriptionStatus.hasActiveSubscriptions ? (
                <BillingExistingSubscriptions
                  customerWithSubscriptions={customerWithSubscriptions}
                  pricesByLookupKey={pricesByLookupKey}
                  hasManualBilling={hasManualBilling}
                />
              ) : (
                <form onSubmit={handleCheckoutSubmit}>
                  {csrfToken && <input type="hidden" name={HTTP.BODY.CSRF_TOKEN} value={csrfToken} />}
                  <BillingPeriodToggle isAnnual={isAnnual} onChange={setIsAnnual} />

                  <fieldset className="slds-form-element" role="radiogroup">
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
                        price={isAnnual ? PLAN_DESCRIPTIONS[PRO_ANNUAL_KEY].price : PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].price}
                        priceSubtext={
                          isAnnual ? PLAN_DESCRIPTIONS[PRO_ANNUAL_KEY].priceSubtext : PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].priceSubtext
                        }
                        description={PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].description}
                        features={PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].features}
                        checked={
                          selectedPlan === (isAnnual ? PLAN_DESCRIPTIONS[PRO_ANNUAL_KEY].key : PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].key)
                        }
                        value={isAnnual ? PLAN_DESCRIPTIONS[PRO_ANNUAL_KEY].key : PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].key}
                        disabled={disableProPlan}
                        disabledReason="You are currently part of a team, contact support if you would like to downgrade to an individual plan."
                        onChange={setSelectedPlan}
                      />
                      <EnhancedBillingCard
                        planName="Team"
                        price={isAnnual ? PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].price : PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].price}
                        priceSubtext={
                          isAnnual ? PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].priceSubtext : PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].priceSubtext
                        }
                        description={PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].description}
                        features={PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].features}
                        checked={
                          selectedPlan === (isAnnual ? PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].key : PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].key)
                        }
                        value={isAnnual ? PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].key : PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].key}
                        comingSoonFeatures={PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].comingSoonFeatures}
                        onChange={setSelectedPlan}
                      />
                      <EnhancedBillingCard
                        planName="Enterprise"
                        price={PLAN_DESCRIPTIONS.CUSTOM.price}
                        priceSubtext={PLAN_DESCRIPTIONS.CUSTOM.priceSubtext}
                        description={PLAN_DESCRIPTIONS.CUSTOM.description}
                        features={PLAN_DESCRIPTIONS.CUSTOM.features}
                        isEnterprise={true}
                        onEnterpriseContact={handleEnterpriseContact}
                      />
                    </div>
                  </fieldset>
                  <div className="slds-text-align_center slds-m-top_large slds-p-horizontal_medium">
                    <button
                      type="submit"
                      disabled={checkoutSessionLoading}
                      className="slds-button slds-button_brand"
                      style={{ width: '100%', maxWidth: '400px' }}
                    >
                      Subscribe Now
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default Billing;
