import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, HTTP, TITLES } from '@jetstream/shared/constants';
import { getCsrfTokenFromCookie, getSubscriptions, getTeam, initCheckoutSession } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { tracker, useTitle } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  JetstreamPricesByLookupKey,
  MAX_TEAM_SEATS,
  Maybe,
  StripePriceKey,
  StripeUserFacingCustomer,
  TEAM_MEMBER_ROLE_ADMIN,
  TEAM_MEMBER_ROLE_BILLING,
  TeamUserFacing,
} from '@jetstream/types';
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
import { useSearchParams } from 'react-router';
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
import { getDefaultTeamName } from './billing.utils';
import { BillingExistingSubscriptions } from './BillingExistingSubscriptions';
import { BillingPeriodToggle } from './BillingPeriodToggle';
import { EnhancedBillingCard } from './EnhancedBillingCard';
import { TeamCheckoutOptions } from './TeamCheckoutOptions';

const HEIGHT_BUFFER = 170;

function isTeamPriceKey(priceKey: StripePriceKey): priceKey is 'TEAM_MONTHLY' | 'TEAM_ANNUAL' {
  return priceKey === TEAM_MONTHLY_KEY || priceKey === TEAM_ANNUAL_KEY;
}

/** A team that already exists must keep every seat it uses or has promised to an invitee. */
function getMinimumCheckoutSeats(team: TeamUserFacing | null): number {
  if (!team) {
    return 1;
  }
  return Math.max(1, team.seats.used + team.seats.reserved);
}

export const Billing = () => {
  useTitle(TITLES.BILLING);
  const { trackEvent } = useAmplitude();
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
  const [team, setTeam] = useState<TeamUserFacing | null>(null);
  const [seats, setSeats] = useState(1);
  const [teamName, setTeamName] = useState(() => getDefaultTeamName(userProfile.email));
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    hasActiveSubscriptions: false,
    hasCanceledSubscriptions: false,
    hasFutureDatedCancellation: false,
    hasPastDueSubscriptions: false,
    hasUnPaidSubscriptions: false,
  });
  const [searchParams] = useSearchParams();
  const [csrfToken] = useState(() => getCsrfTokenFromCookie());

  const teamId = userProfile.teamMembership?.team.id;
  // Reading the team is restricted to these roles, so a plain member would only ever get a 403
  const canReadTeam =
    userProfile.teamMembership?.role === TEAM_MEMBER_ROLE_ADMIN || userProfile.teamMembership?.role === TEAM_MEMBER_ROLE_BILLING;

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      setLoadingError(false);

      const subscribeAction = searchParams.get('subscribeAction');
      if (subscribeAction === 'success') {
        // TODO: should we do something on the server - like ensure server has the subscription?
        // depending on webhook timing, we may want to do this here
      }
      // The team is only needed to size the seat picker and the seat summary, so a failed fetch must
      // not take the billing page down with it
      const teamPromise: Promise<TeamUserFacing | null> =
        teamId && canReadTeam
          ? getTeam(teamId).catch((ex) => {
              logger.warn('Billing: Error fetching team', { message: getErrorMessage(ex) });
              return null;
            })
          : Promise.resolve(null);
      const [{ customer, pricesByLookupKey, hasManualBilling, userProfile }, teamData] = await Promise.all([
        getSubscriptions(),
        teamPromise,
      ]);
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
      setTeam(teamData);
      setSeats((currentSeats) => Math.max(currentSeats, getMinimumCheckoutSeats(teamData)));
    } catch (ex) {
      logger.error('Settings: Error fetching user', { stack: ex.stack, message: ex.message });
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

  const isTeamPlan = isTeamPriceKey(selectedPlan);
  const minSeats = getMinimumCheckoutSeats(team);
  const trimmedTeamName = teamName.trim();

  let seatsError: string | null = null;
  if (isTeamPlan && (!Number.isInteger(seats) || seats < minSeats || seats > MAX_TEAM_SEATS)) {
    seatsError = `Enter between ${minSeats} and ${MAX_TEAM_SEATS} seats.`;
  }
  let teamNameError: string | null = null;
  if (isTeamPlan && !team && (trimmedTeamName.length < 1 || trimmedTeamName.length > 255)) {
    teamNameError = 'Enter a team name between 1 and 255 characters.';
  }
  const hasValidationError = !!seatsError || !!teamNameError;

  const handleCheckoutSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      if (hasValidationError) {
        return;
      }
      setCheckoutSessionLoading(true);
      setCheckoutSessionError(null);

      const { url } = await initCheckoutSession({
        priceLookupKey: selectedPlan,
        quantity: isTeamPlan ? seats : undefined,
        teamName: isTeamPlan && !team ? trimmedTeamName : undefined,
      });
      // Redirect
      window.location.href = url;
      // Track analytics for enterprise contact
      trackEvent(ANALYTICS_KEYS.billing_session, {
        action: 'create_session',
        priceId: selectedPlan,
        seats: isTeamPlan ? seats : undefined,
      });
    } catch (ex) {
      tracker.error('There was an error initiating your checkout session', ex);
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
                  seats={team?.seats ?? null}
                  teamId={team?.id ?? null}
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
                        description={
                          isAnnual ? PLAN_DESCRIPTIONS[PRO_ANNUAL_KEY].description : PLAN_DESCRIPTIONS[PRO_MONTHLY_KEY].description
                        }
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
                        description={
                          isAnnual ? PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].description : PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].description
                        }
                        features={PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].features}
                        pricingTiers={
                          isAnnual ? PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].pricingTiers : PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].pricingTiers
                        }
                        checked={
                          selectedPlan === (isAnnual ? PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].key : PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].key)
                        }
                        value={isAnnual ? PLAN_DESCRIPTIONS[TEAM_ANNUAL_KEY].key : PLAN_DESCRIPTIONS[TEAM_MONTHLY_KEY].key}
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

                  {isTeamPlan && (
                    <TeamCheckoutOptions
                      price={pricesByLookupKey?.[selectedPlan] ?? null}
                      existingTeam={team}
                      seats={seats}
                      minSeats={minSeats}
                      seatsError={seatsError}
                      teamName={teamName}
                      teamNameError={teamNameError}
                      disabled={checkoutSessionLoading}
                      onSeatsChange={setSeats}
                      onTeamNameChange={setTeamName}
                    />
                  )}

                  <div className="slds-text-align_center slds-m-top_large slds-p-horizontal_medium">
                    <button
                      type="submit"
                      disabled={checkoutSessionLoading || hasValidationError}
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
