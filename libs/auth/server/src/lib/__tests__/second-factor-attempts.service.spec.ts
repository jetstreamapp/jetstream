import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SECOND_FACTOR_ATTEMPTS_PER_ACCOUNT } from '../auth.constants';
import { TooManyVerificationAttempts } from '../auth.errors';
import { clearSecondFactorAttempts, reserveSecondFactorAttemptOrThrow } from '../second-factor-attempts.service';

const cacheMocks = vi.hoisted(() => ({
  incrementAsync: vi.fn(),
  removeAsync: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: {},
  DbCacheProvider: class {
    incrementAsync = cacheMocks.incrementAsync;
    removeAsync = cacheMocks.removeAsync;
  },
}));

const USER_ID = 'user-1';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reserveSecondFactorAttemptOrThrow', () => {
  it('allows a submission while the account is within its budget', async () => {
    cacheMocks.incrementAsync.mockResolvedValue(MAX_SECOND_FACTOR_ATTEMPTS_PER_ACCOUNT);

    await expect(reserveSecondFactorAttemptOrThrow(USER_ID)).resolves.toBeUndefined();
    expect(cacheMocks.incrementAsync).toHaveBeenCalledWith(USER_ID);
  });

  it('refuses the submission that exceeds the budget', async () => {
    cacheMocks.incrementAsync.mockResolvedValue(MAX_SECOND_FACTOR_ATTEMPTS_PER_ACCOUNT + 1);

    await expect(reserveSecondFactorAttemptOrThrow(USER_ID)).rejects.toBeInstanceOf(TooManyVerificationAttempts);
  });
});

describe('clearSecondFactorAttempts', () => {
  it('removes the account entry so a successful verification is never charged', async () => {
    await clearSecondFactorAttempts(USER_ID);

    expect(cacheMocks.removeAsync).toHaveBeenCalledWith(USER_ID);
  });
});
