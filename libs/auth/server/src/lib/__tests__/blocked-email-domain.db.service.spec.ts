import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBlockedDomainCandidates, isEmailDomainBlocked } from '../blocked-email-domain.db.service';

const prismaMock = vi.hoisted(() => ({
  blockedEmailDomain: { findMany: vi.fn() },
}));

const loggerMock = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('@jetstream/api-config', () => ({
  logger: loggerMock,
  prisma: prismaMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.blockedEmailDomain.findMany.mockResolvedValue([]);
});

describe('getBlockedDomainCandidates', () => {
  it('should return the domain most specific first, excluding the bare TLD', () => {
    expect(getBlockedDomainCandidates('user@mail.burner.example.com')).toEqual([
      'mail.burner.example.com',
      'burner.example.com',
      'example.com',
    ]);
  });

  it('should normalize case, surrounding space and a trailing dot', () => {
    expect(getBlockedDomainCandidates('  User@Burner.Example.  ')).toEqual(['burner.example']);
  });

  it('should take the domain after the last @ so a quoted local part cannot spoof it', () => {
    expect(getBlockedDomainCandidates('"weird@gmail.com"@burner.example')).toEqual(['burner.example']);
  });

  it.each([undefined, null, '', 'not-an-email', 'user@localhost', 'user@', 'user@.example.com', 'user@example..com'])(
    'should return nothing for %s',
    (email) => {
      expect(getBlockedDomainCandidates(email)).toEqual([]);
    },
  );

  it('should cap how many parent suffixes an attacker-controlled address can generate', () => {
    const candidates = getBlockedDomainCandidates(`user@${['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('.')}.com`);
    // Widest candidate is capped at MAX_DOMAIN_LABELS labels, so the leading 'a.b.c' is dropped.
    expect(candidates).toHaveLength(5);
    expect(candidates[0]).toBe('d.e.f.g.h.com');
  });
});

describe('isEmailDomainBlocked', () => {
  it('should allow an address with no matching row', async () => {
    await expect(isEmailDomainBlocked('user@example.com')).resolves.toBe(false);
  });

  it('should block an exact match', async () => {
    prismaMock.blockedEmailDomain.findMany.mockResolvedValue([{ domain: 'burner.example', blocked: true }]);
    await expect(isEmailDomainBlocked('user@burner.example')).resolves.toBe(true);
  });

  it('should block a subdomain of a blocked domain', async () => {
    prismaMock.blockedEmailDomain.findMany.mockResolvedValue([{ domain: 'burner.example', blocked: true }]);
    await expect(isEmailDomainBlocked('user@mail.burner.example')).resolves.toBe(true);
  });

  it('should let a more specific allowlist row win over a blocked parent', async () => {
    prismaMock.blockedEmailDomain.findMany.mockResolvedValue([
      { domain: 'burner.example', blocked: true },
      { domain: 'relay.burner.example', blocked: false },
    ]);
    await expect(isEmailDomainBlocked('user@relay.burner.example')).resolves.toBe(false);
    await expect(isEmailDomainBlocked('user@other.burner.example')).resolves.toBe(true);
  });

  it('should not query the database when the address has no usable domain', async () => {
    await expect(isEmailDomainBlocked('not-an-email')).resolves.toBe(false);
    expect(prismaMock.blockedEmailDomain.findMany).not.toHaveBeenCalled();
  });

  it('should fail open when the lookup throws so a database problem cannot stop signups', async () => {
    prismaMock.blockedEmailDomain.findMany.mockRejectedValue(new Error('connection terminated'));
    await expect(isEmailDomainBlocked('user@burner.example')).resolves.toBe(false);
    expect(loggerMock.error).toHaveBeenCalled();
  });
});
