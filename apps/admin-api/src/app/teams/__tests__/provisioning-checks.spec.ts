import { StripeQuoteSummary } from '@jetstream/admin/types';
import { evaluateProvisioningChecks, hasBlockingCheck, ProvisioningCheckInput } from '../provisioning-checks';

const teamLineItem = { description: 'Team', priceId: 'price_team', lookupKey: 'TEAM_ANNUAL', quantity: 12, isTeamPrice: true };

const quote: StripeQuoteSummary = {
  id: 'qt_123',
  number: 'QT-0001',
  status: 'open',
  customerId: 'cus_123',
  amountTotal: 100_00,
  currency: 'usd',
  expiresAt: null,
  lineItems: [teamLineItem],
  teamSeatQuantity: 12,
};

const cleanInput: ProvisioningCheckInput = {
  customerId: 'cus_123',
  customerDeleted: false,
  customerMetadata: {},
  linkedTeamId: null,
  linkedUserId: null,
  subscriptions: [],
  selectedQuote: quote,
};

function checkCodes(input: Partial<ProvisioningCheckInput>) {
  return evaluateProvisioningChecks({ ...cleanInput, ...input }).map(({ code, severity }) => `${severity}:${code}`);
}

describe('evaluateProvisioningChecks', () => {
  it('passes a fresh customer with a single-seat-line quote', () => {
    expect(checkCodes({})).toEqual([]);
  });

  it('blocks a customer that already bills a team or a user', () => {
    expect(checkCodes({ linkedTeamId: 'team-1' })).toEqual(['BLOCKER:CUSTOMER_LINKED_TO_TEAM']);
    expect(checkCodes({ linkedUserId: 'user-1' })).toEqual(['BLOCKER:CUSTOMER_LINKED_TO_USER']);
  });

  it('blocks when the metadata names a different team', () => {
    expect(checkCodes({ customerMetadata: { teamId: 'team-2' } })).toEqual(['BLOCKER:CUSTOMER_METADATA_HAS_TEAM']);
  });

  it('only warns when the metadata names a user', () => {
    const checks = evaluateProvisioningChecks({ ...cleanInput, customerMetadata: { userId: 'user-1' } });
    expect(checks.map(({ code }) => code)).toEqual(['CUSTOMER_METADATA_HAS_USER']);
    expect(hasBlockingCheck(checks)).toBe(false);
  });

  it('warns about an existing Team subscription', () => {
    const subscriptions = [{ id: 'sub_1', status: 'active', items: [teamLineItem] }];
    expect(checkCodes({ subscriptions })).toEqual(['WARNING:CUSTOMER_HAS_TEAM_SUBSCRIPTION']);
  });

  it('checks the selected quote', () => {
    expect(checkCodes({ selectedQuote: { ...quote, customerId: 'cus_other' } })).toEqual(['BLOCKER:QUOTE_NOT_FOR_CUSTOMER']);
    expect(checkCodes({ selectedQuote: { ...quote, status: 'canceled' } })).toEqual(['WARNING:QUOTE_STATUS']);
    expect(checkCodes({ selectedQuote: { ...quote, lineItems: [teamLineItem, teamLineItem], teamSeatQuantity: null } })).toEqual([
      'WARNING:QUOTE_TEAM_LINE_ITEM_COUNT',
    ]);
    expect(checkCodes({ selectedQuote: { ...quote, lineItems: [{ ...teamLineItem, isTeamPrice: false }] } })).toEqual([
      'WARNING:QUOTE_TEAM_LINE_ITEM_COUNT',
    ]);
  });

  it('stops at a deleted customer', () => {
    expect(checkCodes({ customerDeleted: true, linkedTeamId: 'team-1' })).toEqual(['BLOCKER:CUSTOMER_DELETED']);
  });
});
