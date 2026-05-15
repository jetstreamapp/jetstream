import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Covers `refreshTokensWithLock` — the cross-worker coordination piece of the refresh-token
 * rotation fix. End-to-end exercise of the actual Postgres advisory lock semantics requires a
 * real test DB and isn't worth the CI plumbing; the lock itself is a thin Postgres call we can
 * trust. What we DO want to lock down here:
 *
 *   1. The optimistic check correctly skips the Salesforce call when the DB has already been
 *      updated by another worker (this is the whole point of the fix).
 *   2. `pg_advisory_xact_lock` is requested with the org id before any reads.
 *   3. The transaction is opened with `timeout: 20_000` so a slow `/services/oauth2/token` call
 *      can't blow Prisma's default 5s budget and leave the lock in a weird state.
 *   4. SF's rotated refresh_token (when present) is persisted; when not present (rotation off),
 *      the existing refresh_token is preserved.
 *   5. Hard failure modes (missing org, undecryptable tokens) surface as clear errors rather than
 *      silent recoveries that would mask real issues.
 */

const txMock = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  salesforceOrg: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

const encServiceMock = vi.hoisted(() => ({
  DUMMY_INVALID_ENCRYPTED_TOKEN: '__dummy_invalid__',
  decryptAccessToken: vi.fn(),
  encryptAccessToken: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  prisma: prismaMock,
}));

vi.mock('@jetstream/audit-logs', () => ({
  AuditLogAction: {},
  AuditLogResource: {},
  createAuditLog: vi.fn(),
}));

vi.mock('../../services/salesforce-org-encryption.service', () => encServiceMock);

const { refreshTokensWithLock } = await import('../salesforce-org.db');

const ORG_ID = 42;
const USER_ID = 'user-abc';
const STALE_ACCESS = 'stale-access-token';
const STALE_REFRESH = 'stale-refresh-token';
const NEW_ACCESS = 'new-access-token';
const ROTATED_REFRESH = 'rotated-refresh-token';

describe('refreshTokensWithLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
    txMock.$executeRaw.mockResolvedValue(1);
    txMock.salesforceOrg.findUnique.mockResolvedValue({ id: ORG_ID, accessToken: 'encrypted-blob' });
    txMock.salesforceOrg.update.mockResolvedValue({ id: ORG_ID });
    encServiceMock.decryptAccessToken.mockResolvedValue([STALE_ACCESS, STALE_REFRESH]);
    encServiceMock.encryptAccessToken.mockResolvedValue('encrypted-new-blob');
  });

  it('opens a transaction with a 20s timeout so a slow Salesforce call cannot blow the default 5s budget', async () => {
    const callSalesforce = vi.fn().mockResolvedValue({ access_token: NEW_ACCESS, refresh_token: ROTATED_REFRESH });

    await refreshTokensWithLock({ orgId: ORG_ID, userId: USER_ID, currentAccessToken: STALE_ACCESS, callSalesforce });

    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 20_000 });
  });

  it('acquires the per-org advisory lock before reading the row', async () => {
    const callSalesforce = vi.fn().mockResolvedValue({ access_token: NEW_ACCESS, refresh_token: ROTATED_REFRESH });

    await refreshTokensWithLock({ orgId: ORG_ID, userId: USER_ID, currentAccessToken: STALE_ACCESS, callSalesforce });

    expect(txMock.$executeRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = txMock.$executeRaw.mock.calls[0];
    // Prisma tagged-template captures the SQL fragments and interpolated values separately.
    expect(strings.join('')).toContain('pg_advisory_xact_lock');
    expect(values).toEqual([ORG_ID]);

    // Lock must come before the SELECT — otherwise two workers could both read stale tokens
    // before either acquires the lock.
    const lockOrder = txMock.$executeRaw.mock.invocationCallOrder[0];
    const findOrder = txMock.salesforceOrg.findUnique.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(findOrder);
  });

  it('refreshes via Salesforce when the DB still matches the caller-supplied stale token', async () => {
    const callSalesforce = vi.fn().mockResolvedValue({ access_token: NEW_ACCESS, refresh_token: ROTATED_REFRESH });

    const result = await refreshTokensWithLock({ orgId: ORG_ID, userId: USER_ID, currentAccessToken: STALE_ACCESS, callSalesforce });

    expect(callSalesforce).toHaveBeenCalledWith(STALE_REFRESH);
    expect(encServiceMock.encryptAccessToken).toHaveBeenCalledWith({
      userId: USER_ID,
      accessToken: NEW_ACCESS,
      refreshToken: ROTATED_REFRESH,
    });
    expect(txMock.salesforceOrg.update).toHaveBeenCalledWith({ where: { id: ORG_ID }, data: { accessToken: 'encrypted-new-blob' } });
    expect(result).toEqual({ accessToken: NEW_ACCESS, refreshToken: ROTATED_REFRESH, refreshed: true });
  });

  it('skips the Salesforce call and returns the canonical tokens when another worker already rotated', async () => {
    // DB shows different tokens than what the caller had — the other worker won the race.
    encServiceMock.decryptAccessToken.mockResolvedValue(['someone-elses-new-access', 'someone-elses-new-refresh']);
    const callSalesforce = vi.fn();

    const result = await refreshTokensWithLock({
      orgId: ORG_ID,
      userId: USER_ID,
      currentAccessToken: STALE_ACCESS,
      callSalesforce,
    });

    expect(callSalesforce).not.toHaveBeenCalled();
    expect(txMock.salesforceOrg.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      accessToken: 'someone-elses-new-access',
      refreshToken: 'someone-elses-new-refresh',
      refreshed: false,
    });
  });

  it('keeps the existing refresh_token when Salesforce does not rotate (rotation disabled on the Connected App)', async () => {
    const callSalesforce = vi.fn().mockResolvedValue({ access_token: NEW_ACCESS }); // no refresh_token returned

    const result = await refreshTokensWithLock({ orgId: ORG_ID, userId: USER_ID, currentAccessToken: STALE_ACCESS, callSalesforce });

    expect(encServiceMock.encryptAccessToken).toHaveBeenCalledWith({
      userId: USER_ID,
      accessToken: NEW_ACCESS,
      refreshToken: STALE_REFRESH,
    });
    expect(result.refreshToken).toBe(STALE_REFRESH);
    expect(result.refreshed).toBe(true);
  });

  it('throws NotFoundError if the org row vanished between request init and lock acquisition', async () => {
    txMock.salesforceOrg.findUnique.mockResolvedValue(null);
    const callSalesforce = vi.fn();

    await expect(
      refreshTokensWithLock({ orgId: ORG_ID, userId: USER_ID, currentAccessToken: STALE_ACCESS, callSalesforce }),
    ).rejects.toThrow('An org with the provided id does not exist');
    expect(callSalesforce).not.toHaveBeenCalled();
  });

  it('throws (rather than silently retrying with the sentinel) when the stored tokens are undecryptable', async () => {
    encServiceMock.decryptAccessToken.mockResolvedValue([
      encServiceMock.DUMMY_INVALID_ENCRYPTED_TOKEN,
      encServiceMock.DUMMY_INVALID_ENCRYPTED_TOKEN,
    ]);
    const callSalesforce = vi.fn();

    await expect(
      refreshTokensWithLock({ orgId: ORG_ID, userId: USER_ID, currentAccessToken: STALE_ACCESS, callSalesforce }),
    ).rejects.toThrow(/Stored Salesforce tokens are not decryptable/);
    expect(callSalesforce).not.toHaveBeenCalled();
  });

  it('propagates Salesforce errors and does NOT persist anything on failure', async () => {
    const callSalesforce = vi.fn().mockRejectedValue(new Error('invalid_grant'));

    await expect(
      refreshTokensWithLock({ orgId: ORG_ID, userId: USER_ID, currentAccessToken: STALE_ACCESS, callSalesforce }),
    ).rejects.toThrow('invalid_grant');
    expect(encServiceMock.encryptAccessToken).not.toHaveBeenCalled();
    expect(txMock.salesforceOrg.update).not.toHaveBeenCalled();
  });
});
