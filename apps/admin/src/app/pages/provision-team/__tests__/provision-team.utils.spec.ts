import { describe, expect, it } from 'vitest';
import {
  buildProvisionRequest,
  DEFAULT_ENTITLEMENTS,
  getDefaultRoleForNewMember,
  INITIAL_TEAM_FORM,
  SelectedTeamMember,
} from '../provision-team.utils';

const CUSTOMER_ID = 'cus_TestCustomer123';

function selectedMember(index: number, role: SelectedTeamMember['role']): SelectedTeamMember {
  return { user: { id: `aaaaaaaa-0000-0000-0000-00000000000${index}`, email: `user${index}@example.com`, name: `User ${index}` }, role };
}

describe('buildProvisionRequest', () => {
  it('builds a subscription request without entitlements', () => {
    const { request, errors } = buildProvisionRequest({
      customerId: CUSTOMER_ID,
      quoteId: 'qt_TestQuote123',
      form: { ...INITIAL_TEAM_FORM, name: '  Acme  ', licenseCountLimit: '10' },
    });

    expect(errors).toEqual({});
    expect(request).toMatchObject({
      customerId: CUSTOMER_ID,
      quoteId: 'qt_TestQuote123',
      name: 'Acme',
      seatMode: 'SUBSCRIPTION',
      licenseCountLimit: 10,
      entitlements: null,
      members: [],
    });
  });

  it('treats an empty seat limit as uncapped for subscription seats', () => {
    const { request } = buildProvisionRequest({ customerId: CUSTOMER_ID, quoteId: null, form: { ...INITIAL_TEAM_FORM, name: 'Acme' } });

    expect(request?.licenseCountLimit).toBeNull();
  });

  it('requires a seat limit for fixed seats', () => {
    const { request, errors } = buildProvisionRequest({
      customerId: CUSTOMER_ID,
      quoteId: null,
      form: { ...INITIAL_TEAM_FORM, name: 'Acme', seatMode: 'FIXED' },
    });

    expect(request).toBeNull();
    expect(errors.licenseCountLimit).toBeTruthy();
  });

  it('sends starting entitlements only for fixed seats', () => {
    const entitlements = { ...DEFAULT_ENTITLEMENTS, chromeExtension: true };
    const { request } = buildProvisionRequest({
      customerId: CUSTOMER_ID,
      quoteId: null,
      form: { ...INITIAL_TEAM_FORM, name: 'Acme', seatMode: 'FIXED', licenseCountLimit: '5', entitlements },
    });

    expect(request?.entitlements).toEqual(entitlements);
  });

  it('sends members as user ids and roles', () => {
    const { request } = buildProvisionRequest({
      customerId: CUSTOMER_ID,
      quoteId: null,
      form: { ...INITIAL_TEAM_FORM, name: 'Acme', members: [selectedMember(1, 'ADMIN'), selectedMember(2, 'BILLING')] },
    });

    expect(request?.members).toEqual([
      { userId: 'aaaaaaaa-0000-0000-0000-000000000001', role: 'ADMIN' },
      { userId: 'aaaaaaaa-0000-0000-0000-000000000002', role: 'BILLING' },
    ]);
  });

  it('rejects more seat-taking members than the seat limit, not counting billing members', () => {
    const members = [selectedMember(1, 'ADMIN'), selectedMember(2, 'MEMBER'), selectedMember(3, 'BILLING')];

    const overLimit = buildProvisionRequest({
      customerId: CUSTOMER_ID,
      quoteId: null,
      form: { ...INITIAL_TEAM_FORM, name: 'Acme', licenseCountLimit: '1', members },
    });
    expect(overLimit.request).toBeNull();
    expect(overLimit.errors.members).toBeTruthy();

    const atLimit = buildProvisionRequest({
      customerId: CUSTOMER_ID,
      quoteId: null,
      form: { ...INITIAL_TEAM_FORM, name: 'Acme', licenseCountLimit: '2', members },
    });
    expect(atLimit.errors).toEqual({});
  });

  it('reports a missing team name', () => {
    const { request, errors } = buildProvisionRequest({ customerId: CUSTOMER_ID, quoteId: null, form: INITIAL_TEAM_FORM });

    expect(request).toBeNull();
    expect(errors.name).toBeTruthy();
  });
});

describe('getDefaultRoleForNewMember', () => {
  it('makes the first member an admin and later ones members', () => {
    expect(getDefaultRoleForNewMember([])).toBe('ADMIN');
    expect(getDefaultRoleForNewMember([selectedMember(1, 'ADMIN')])).toBe('MEMBER');
  });
});
