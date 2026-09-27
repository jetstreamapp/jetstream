import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserFacingError } from '../../utils/error-handler';
import { routeDefinition } from '../billing.controller';

const mocks = vi.hoisted(() => ({
  sendJson: vi.fn(),
  findByIdWithSubscriptions: vi.fn(),
  findByUserIdWithSubscriptions: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { JETSTREAM_SERVER_URL: 'https://server.test', JETSTREAM_CLIENT_URL: 'https://client.test' },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  getLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  errorTracker: { error: vi.fn(), warn: vi.fn(), critical: vi.fn(), info: vi.fn() },
  prisma: {},
}));
vi.mock('@jetstream/auth/server', () => ({
  getApiAddressFromReq: vi.fn(() => '127.0.0.1'),
  refreshSessionUser: vi.fn(),
}));
vi.mock('../../db/salesforce-org.db', () => ({ findByUniqueId_UNSAFE: vi.fn(), findProductionOrganizationId: vi.fn(async () => null) }));
vi.mock('../../db/user.db', () => ({ findByIdWithSubscriptions: mocks.findByIdWithSubscriptions }));
vi.mock('../../db/team.db', () => ({ findByUserIdWithSubscriptions: mocks.findByUserIdWithSubscriptions }));
vi.mock('../../services/stripe.service', () => ({
  ensureStripeIsInitialized: vi.fn(),
  fetchPrices: vi.fn(async () => ({ PRO_MONTHLY: { id: 'price_pro' } })),
  createCheckoutSession: mocks.createCheckoutSession,
}));
vi.mock('../../utils/response.handlers', () => ({ sendJson: mocks.sendJson, redirect: vi.fn() }));

const user = { id: 'user-1', email: 'user@example.com', name: 'Test User', billingAccount: null };

async function invokeCreateCheckoutSession(priceLookupKey: string) {
  const next = vi.fn();
  const req = {
    body: { priceLookupKey },
    query: {},
    params: {},
    session: { user: { id: user.id } },
    accepts: () => true,
  };
  const res = { locals: { requestId: 'req-1' } };
  await routeDefinition.createCheckoutSession.controllerFn()(req as never, res as never, next);
  return { next };
}

describe('billing.controller createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findByIdWithSubscriptions.mockResolvedValue(user);
    mocks.createCheckoutSession.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.example/cs_1' });
  });

  // The Stripe customer a team was bought on carries the purchaser's `userId`, so a personal checkout would
  // reuse it and reconcile the personal subscription into the team. The billing page disables the plan too.
  it('rejects a personal plan for an active team member', async () => {
    mocks.findByUserIdWithSubscriptions.mockResolvedValue({
      id: 'team-1',
      members: [{ userId: user.id, role: 'ADMIN', status: 'ACTIVE' }],
    });

    const { next } = await invokeCreateCheckoutSession('PRO_MONTHLY');

    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(UserFacingError));
    expect(next.mock.calls[0][0].message).toContain('You are currently part of a team');
  });

  it('allows a personal plan for a user who is not on a team', async () => {
    mocks.findByUserIdWithSubscriptions.mockResolvedValue(null);

    const { next } = await invokeCreateCheckoutSession('PRO_MONTHLY');

    expect(next).not.toHaveBeenCalled();
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ type: 'USER', priceId: 'price_pro' }));
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), { url: 'https://checkout.example/cs_1' });
  });

  // Mirrors the billing page, which only disables personal plans for an active membership.
  it('allows a personal plan for a user whose team membership is no longer active', async () => {
    mocks.findByUserIdWithSubscriptions.mockResolvedValue({
      id: 'team-1',
      members: [{ userId: user.id, role: 'MEMBER', status: 'INACTIVE' }],
    });

    const { next } = await invokeCreateCheckoutSession('PRO_MONTHLY');

    expect(next).not.toHaveBeenCalled();
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ type: 'USER' }));
  });
});
