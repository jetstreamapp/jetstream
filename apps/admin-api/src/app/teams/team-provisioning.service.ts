import {
  AdminSessionUser,
  ProvisioningLookupResult,
  ProvisionTeamRequest,
  ProvisionTeamResponse,
  StripeLinkResult,
} from '@jetstream/admin/types';
import { getLogger, prisma } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createAuditLog } from '@jetstream/audit-logs';
import { getErrorMessage } from '@jetstream/shared/utils';
import { TEAM_BILLING_STATUS_ACTIVE, TEAM_BILLING_STATUS_MANUAL, TEAM_STATUS_ACTIVE } from '@jetstream/types';
import { getStripeCustomerContext, listCurrentSubscriptions } from '../stripe/stripe-customers.service';
import { summarizeCustomer, summarizeSubscription } from '../stripe/stripe-summaries';
import { getStripe } from '../stripe/stripe.client';
import { ConflictError, NotFoundError, RequestMetadata } from '../utils/route.utils';
import { evaluateProvisioningChecks, hasBlockingCheck } from './provisioning-checks';

export async function getProvisioningLookup(customerId: string, quoteId?: string): Promise<ProvisioningLookupResult> {
  const [{ customer, quotes, subscriptions }, linkedTeam, linkedUser] = await Promise.all([
    getStripeCustomerContext(customerId, quoteId),
    prisma.teamBillingAccount.findUnique({ where: { customerId }, select: { teamId: true } }),
    prisma.billingAccount.findUnique({ where: { customerId }, select: { userId: true } }),
  ]);

  if (customer.deleted) {
    throw new NotFoundError(`Customer ${customerId} has been deleted in Stripe`);
  }

  const subscriptionSummaries = subscriptions.map(summarizeSubscription);
  const selectedQuote = quotes.find(({ id }) => id === quoteId) ?? null;
  const checks = evaluateProvisioningChecks({
    customerId,
    customerDeleted: false,
    customerMetadata: customer.metadata ?? {},
    linkedTeamId: linkedTeam?.teamId ?? null,
    linkedUserId: linkedUser?.userId ?? null,
    subscriptions: subscriptionSummaries,
    selectedQuote,
  });

  return {
    customer: summarizeCustomer(customer),
    quotes,
    selectedQuoteId: selectedQuote?.id ?? null,
    subscriptions: subscriptionSummaries,
    checks,
    suggestedTeamName: customer.name || customer.email || '',
  };
}

/**
 * Creates the team and its billing account, then tags the Stripe customer with the team id. From
 * then on the main API's webhook handler attributes this customer's subscriptions to the team and
 * syncs seats, billing status and entitlements, exactly as for a self-serve team.
 */
export async function provisionTeam(
  request: ProvisionTeamRequest,
  admin: AdminSessionUser,
  requestMetadata: RequestMetadata,
): Promise<ProvisionTeamResponse> {
  const { customerId, quoteId, name, billingMode, licenseCountLimit, entitlements } = request;

  // Re-checked here because Stripe or the database may have changed since the admin looked
  const lookup = await getProvisioningLookup(customerId, quoteId ?? undefined);
  const blockers = lookup.checks.filter(({ severity }) => severity === 'BLOCKER');
  if (hasBlockingCheck(lookup.checks)) {
    throw new ConflictError(blockers.map(({ message }) => message).join(' '));
  }

  const isManualBilling = billingMode === 'MANUAL';

  // TeamBillingAccount.customerId is unique, so a concurrent provision of the same customer fails here (409)
  const team = await prisma.team.create({
    select: { id: true },
    data: {
      name,
      status: TEAM_STATUS_ACTIVE,
      billingStatus: isManualBilling ? TEAM_BILLING_STATUS_MANUAL : TEAM_BILLING_STATUS_ACTIVE,
      loginConfig: { create: {} },
      entitlements: { create: isManualBilling && entitlements ? entitlements : {} },
      billingAccount: {
        create: {
          customerId,
          manualBilling: isManualBilling,
          licenseCountLimit: licenseCountLimit ?? null,
        },
      },
    },
  });

  await createAuditLog({
    action: AuditLogAction.ADMIN_TEAM_PROVISIONED,
    resource: AuditLogResource.TEAM,
    resourceId: team.id,
    metadata: { adminEmail: admin.email, customerId, quoteId: quoteId ?? null, name, billingMode, licenseCountLimit, entitlements },
    ...requestMetadata,
  });

  const stripeLinkResult = await linkTeamToStripe(team.id, admin, requestMetadata);
  return { teamId: team.id, stripe: stripeLinkResult };
}

/**
 * Writes `{ teamId, type: 'TEAM' }` to the customer metadata, which is how the main API's webhook
 * finds the team. Any current subscription is re-saved with the team id so Stripe sends
 * `customer.subscription.updated` and the main API syncs it now rather than on the next change.
 * Safe to repeat; the team page offers it as a retry.
 */
export async function linkTeamToStripe(
  teamId: string,
  admin: AdminSessionUser,
  requestMetadata: RequestMetadata,
): Promise<StripeLinkResult> {
  const billingAccount = await prisma.teamBillingAccount.findUnique({ where: { teamId }, select: { customerId: true } });
  if (!billingAccount) {
    throw new NotFoundError(`Team ${teamId} has no billing account`);
  }
  const { customerId } = billingAccount;

  const result: StripeLinkResult = { customerMetadataUpdated: false, subscriptionsNudged: [], error: null };
  try {
    await getStripe().customers.update(customerId, { metadata: { teamId, type: 'TEAM' } });
    result.customerMetadataUpdated = true;

    const subscriptions = await listCurrentSubscriptions(customerId);
    for (const { id } of subscriptions) {
      await getStripe().subscriptions.update(id, { metadata: { teamId } });
      result.subscriptionsNudged.push(id);
    }
  } catch (ex) {
    result.error = getErrorMessage(ex);
    getLogger().error({ err: ex, teamId, customerId }, '[ADMIN] Failed to link team to Stripe customer');
  }

  await createAuditLog({
    action: AuditLogAction.ADMIN_TEAM_STRIPE_LINKED,
    resource: AuditLogResource.TEAM,
    resourceId: teamId,
    metadata: { adminEmail: admin.email, customerId, ...result },
    ...requestMetadata,
  });

  return result;
}
