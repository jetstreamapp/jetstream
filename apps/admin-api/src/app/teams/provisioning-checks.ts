import { ProvisioningCheck, StripeQuoteSummary, StripeSubscriptionSummary } from '@jetstream/admin/types';

export interface ProvisioningCheckInput {
  customerId: string;
  customerDeleted: boolean;
  customerMetadata: Record<string, string>;
  /** Team whose TeamBillingAccount already uses this customer */
  linkedTeamId: string | null;
  /** User whose personal BillingAccount already uses this customer */
  linkedUserId: string | null;
  subscriptions: StripeSubscriptionSummary[];
  selectedQuote: StripeQuoteSummary | null;
}

/**
 * Rules that decide whether a customer can become a new team's billing customer. BLOCKER checks
 * would either collide with a unique constraint or leave two teams claiming one customer; WARNING
 * checks are worth a look but don't stop provisioning.
 */
export function evaluateProvisioningChecks({
  customerId,
  customerDeleted,
  customerMetadata,
  linkedTeamId,
  linkedUserId,
  subscriptions,
  selectedQuote,
}: ProvisioningCheckInput): ProvisioningCheck[] {
  const checks: ProvisioningCheck[] = [];

  if (customerDeleted) {
    checks.push({ code: 'CUSTOMER_DELETED', severity: 'BLOCKER', message: `Customer ${customerId} has been deleted in Stripe.` });
    return checks;
  }

  if (linkedTeamId) {
    checks.push({
      code: 'CUSTOMER_LINKED_TO_TEAM',
      severity: 'BLOCKER',
      message: 'This customer is already the billing customer of a team.',
      teamId: linkedTeamId,
    });
  }

  if (linkedUserId) {
    checks.push({
      code: 'CUSTOMER_LINKED_TO_USER',
      severity: 'BLOCKER',
      message: "This customer is a user's personal billing customer. Use a separate customer for the team.",
      userId: linkedUserId,
    });
  }

  const { teamId: metadataTeamId, userId: metadataUserId } = customerMetadata;
  if (metadataTeamId && metadataTeamId !== linkedTeamId) {
    checks.push({
      code: 'CUSTOMER_METADATA_HAS_TEAM',
      severity: 'BLOCKER',
      message: `Customer metadata already names team ${metadataTeamId}. Clear it in Stripe first if that team no longer uses this customer.`,
      teamId: metadataTeamId,
    });
  }

  if (metadataUserId && metadataUserId !== linkedUserId) {
    checks.push({
      code: 'CUSTOMER_METADATA_HAS_USER',
      severity: 'WARNING',
      message: `Customer metadata names user ${metadataUserId}. Once the team is linked, the main API treats the customer as the team's.`,
      userId: metadataUserId,
    });
  }

  const hasTeamSubscription = subscriptions.some(({ items }) => items.some(({ isTeamPrice }) => isTeamPrice));
  if (hasTeamSubscription) {
    checks.push({
      code: 'CUSTOMER_HAS_TEAM_SUBSCRIPTION',
      severity: 'WARNING',
      message: 'The customer already has a Team subscription. Linking re-saves it so the main API syncs seats and entitlements right away.',
    });
  }

  if (selectedQuote) {
    if (selectedQuote.customerId !== customerId) {
      checks.push({
        code: 'QUOTE_NOT_FOR_CUSTOMER',
        severity: 'BLOCKER',
        message: `Quote ${selectedQuote.id} belongs to a different customer.`,
      });
    }
    if (selectedQuote.status === 'canceled') {
      checks.push({ code: 'QUOTE_STATUS', severity: 'WARNING', message: `Quote ${selectedQuote.number ?? selectedQuote.id} is canceled.` });
    }
    const teamLineItemCount = selectedQuote.lineItems.filter(({ isTeamPrice }) => isTeamPrice).length;
    if (teamLineItemCount !== 1) {
      checks.push({
        code: 'QUOTE_TEAM_LINE_ITEM_COUNT',
        severity: 'WARNING',
        message: `The quote has ${teamLineItemCount} Team (TEAM_) prices. Seat sync needs exactly one, with seats as its quantity.`,
      });
    }
  }

  return checks;
}

export function hasBlockingCheck(checks: ProvisioningCheck[]) {
  return checks.some(({ severity }) => severity === 'BLOCKER');
}
