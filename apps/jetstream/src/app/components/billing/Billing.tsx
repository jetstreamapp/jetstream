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
import { useAmplitude } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { environment } from '../../../environments/environment';
import { BillingExistingSubscriptions } from './BillingExistingSubscriptions';
import { BillingPeriodToggle } from './BillingPeriodToggle';
import { EnhancedBillingCard } from './EnhancedBillingCard';

const HEIGHT_BUFFER = 170;

export const Billing = () => {
  useTitle(TITLES.BILLING);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const setUserProfile = useSetAtom(fromAppState.userProfileState);
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
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

  useEffect(() => {
    // Update selected plan when billing period changes
    if (selectedPlan === environment.STRIPE_PRO_MONTHLY_PRICE_ID && isAnnual) {
      setSelectedPlan(environment.STRIPE_PRO_ANNUAL_PRICE_ID);
    } else if (selectedPlan === environment.STRIPE_PRO_ANNUAL_PRICE_ID && !isAnnual) {
      setSelectedPlan(environment.STRIPE_PRO_MONTHLY_PRICE_ID);
    } else if (selectedPlan === environment.STRIPE_TEAM_MONTHLY_PRICE_ID && isAnnual) {
      setSelectedPlan(environment.STRIPE_TEAM_ANNUAL_PRICE_ID);
    } else if (selectedPlan === environment.STRIPE_TEAM_ANNUAL_PRICE_ID && !isAnnual) {
      setSelectedPlan(environment.STRIPE_TEAM_MONTHLY_PRICE_ID);
    }
  }, [isAnnual, selectedPlan]);

  const handleEnterpriseContact = () => {
    // Track analytics for enterprise contact
    trackEvent(ANALYTICS_KEYS.billing_session, { action: 'enterprise_contact' });
    // Open email or contact form
    window.open('mailto:sales@getjetstream.app?subject=Enterprise Plan Inquiry', '_blank');
  };

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

        {/* <div className="slds-box slds-box_small slds-m-bottom_small">
          {(!customerWithSubscriptions || !subscriptionStatus.hasActiveSubscriptions) && (
            <JetstreamProLogo width="250px" className="slds-m-bottom_x-small" />
          )}
          <Grid wrap>
            <div className="slds-m-right_medium">
              <p className="slds-text-heading_medium">Jetstream Professional Includes:</p>
              <ul className="slds-list_dotted slds-m-bottom_small">
                <li>
                  <a
                    href={APP_ROUTES.DESKTOP_APPLICATION.ROUTE}
                    target="_blank"
                    className="slds-text-heading_x-small"
                    rel="noreferrer"
                    onClick={() => trackEvent(ANALYTICS_KEYS.desktop_app_download_link, { action: 'clicked', source: 'billing_page' })}
                  >
                    Desktop Application
                  </a>
                </li>
                <li>
                  <a
                    href={APP_ROUTES.BROWSER_EXTENSION.ROUTE}
                    target="_blank"
                    className="slds-text-heading_x-small"
                    rel="noreferrer"
                    onClick={() => trackEvent(ANALYTICS_KEYS.browser_extension_link, { action: 'clicked', source: 'billing_page' })}
                  >
                    Chrome and Firefox Extensions
                  </a>
                </li>
                <li>Save query history across devices</li>
                <li>Save downloads to Google Drive</li>
                <li>Load data from Google Drive</li>
              </ul>
            </div>
            <div>
              <p className="slds-text-heading_medium">Jetstream For Teams Includes:</p>
              <ul className="slds-list_dotted slds-m-bottom_small">
                <li>Everything in Professional</li>
                <li>Manage multiple team members</li>
                <ul className="slds-list_dotted">
                  <li>View team member activity</li>
                </ul>
                <li>Share orgs between team members</li>
                <li>Role-based access control</li>
                <li>Option to save load and deploy files</li>
                <li>Audit logs</li>
              </ul>
            </div>
          </Grid>
        </div> */}

        {(!customerWithSubscriptions || !subscriptionStatus.hasActiveSubscriptions) && (
          <div className="slds-text-align_center slds-p-vertical_medium">
            <h2 className="slds-text-heading_medium slds-text-color_weak">Unlock the full potential of your Salesforce workflow</h2>
          </div>
        )}

        <div className="slds-p-horizontal_small">
          {customerWithSubscriptions && subscriptionStatus.hasActiveSubscriptions ? (
            <BillingExistingSubscriptions customerWithSubscriptions={customerWithSubscriptions} />
          ) : (
            <form
              method="POST"
              action="/api/billing/checkout-session"
              onSubmit={() => trackEvent(ANALYTICS_KEYS.billing_session, { action: 'create_session', priceId: selectedPlan })}
            >
              <BillingPeriodToggle isAnnual={isAnnual} onChange={setIsAnnual} />

              <fieldset className="slds-form-element" role="radiogroup">
                {/* <legend className="slds-form-element__legend slds-form-element__label slds-text-heading_medium slds-text-align_center slds-m-bottom_large">
                  Choose your plan
                </legend> */}
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
                    price={isAnnual ? '$250' : '$25'}
                    priceSubtext={isAnnual ? '/year' : '/month'}
                    description="Perfect for individual users"
                    features={professionalFeatures}
                    checked={selectedPlan === (isAnnual ? environment.STRIPE_PRO_ANNUAL_PRICE_ID : environment.STRIPE_PRO_MONTHLY_PRICE_ID)}
                    value={isAnnual ? environment.STRIPE_PRO_ANNUAL_PRICE_ID : environment.STRIPE_PRO_MONTHLY_PRICE_ID}
                    onChange={setSelectedPlan}
                  />
                  <EnhancedBillingCard
                    planName="Team"
                    price={isAnnual ? '$1,100' : '$110'}
                    priceSubtext={isAnnual ? '/year (includes 5 users)' : '/month (includes 5 users)'}
                    description="$22/user/month with 5-user minimum"
                    features={teamFeatures}
                    isPopular={true}
                    checked={
                      selectedPlan === (isAnnual ? environment.STRIPE_TEAM_ANNUAL_PRICE_ID : environment.STRIPE_TEAM_MONTHLY_PRICE_ID)
                    }
                    value={isAnnual ? environment.STRIPE_TEAM_ANNUAL_PRICE_ID : environment.STRIPE_TEAM_MONTHLY_PRICE_ID}
                    onChange={setSelectedPlan}
                  />
                  <EnhancedBillingCard
                    planName="Enterprise"
                    price="Custom"
                    priceSubtext="Contact us"
                    description="Advanced features for large teams"
                    features={enterpriseFeatures}
                    isEnterprise={true}
                    onEnterpriseContact={handleEnterpriseContact}
                  />
                </div>
              </fieldset>
              <div className="slds-text-align_center slds-m-top_large slds-p-horizontal_medium">
                <button type="submit" className="slds-button slds-button_brand" style={{ width: '100%', maxWidth: '400px' }}>
                  Subscribe Now
                </button>
              </div>
            </form>
          )}
        </div>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default Billing;
