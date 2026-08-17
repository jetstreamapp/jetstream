import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_TOS_VERSION } from '../auth.constants';
import { handleSignInOrRegistration } from '../auth.db.service';
import { EmailDomainNotAllowed } from '../auth.errors';

/**
 * Locks in the blocked-domain rejection on credentials registration and, more importantly, that it
 * runs BEFORE the "email already in use" branch.
 *
 * That branch deliberately returns a placeholder verification flow instead of an error so it cannot
 * be used to enumerate accounts. Rejecting blocked domains after it would surface an error only for
 * addresses with no account, turning the pair of responses into exactly the oracle that branch
 * exists to avoid.
 */

const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  blockedEmailDomain: { findMany: vi.fn() },
  teamMemberInvitation: { findFirst: vi.fn() },
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: prismaMock,
  DbCacheProvider: class {
    static cleanupExpired = vi.fn();
    consumeOnceAsync = vi.fn();
  },
}));

const BLOCKED_EMAIL = 'someone@burner.example.com';
const ALLOWED_EMAIL = 'someone@company.example.com';

function registerPayload(email: string): Parameters<typeof handleSignInOrRegistration>[0] {
  return {
    providerType: 'credentials',
    action: 'register',
    email,
    name: 'Test User',
    password: 'a-very-long-password',
    tosVersion: CURRENT_TOS_VERSION,
    teamInvite: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.blockedEmailDomain.findMany.mockResolvedValue([]);
  prismaMock.user.findMany.mockResolvedValue([]);
});

describe('handleSignInOrRegistration - credentials register', () => {
  it('rejects a blocked domain before looking up existing accounts, so the response cannot reveal whether one exists', async () => {
    prismaMock.blockedEmailDomain.findMany.mockResolvedValue([{ domain: 'burner.example.com', blocked: true }]);

    await expect(handleSignInOrRegistration(registerPayload(BLOCKED_EMAIL))).rejects.toBeInstanceOf(EmailDomainNotAllowed);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('allows a domain that is not blocked through to the existing-account check', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
        userId: 'credentials|aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
        name: 'Existing User',
        email: ALLOWED_EMAIL,
        emailVerified: true,
        tosAcceptedVersion: '1',
        authFactors: [],
        teamMembership: null,
      },
    ]);

    const result = await handleSignInOrRegistration(registerPayload(ALLOWED_EMAIL));

    expect(prismaMock.blockedEmailDomain.findMany).toHaveBeenCalledTimes(1);
    // The enumeration-safe branch: a placeholder user routed to email verification, not an error
    expect(result.isNewUser).toBe(false);
    expect(result.user.userId).toBe(`invalid|${ALLOWED_EMAIL}`);
    expect(result.verificationRequired.email).toBe(true);
  });
});
