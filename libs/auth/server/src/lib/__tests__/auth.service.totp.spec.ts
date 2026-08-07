import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidVerificationToken } from '../auth.errors';
import { convertBase32ToHex, generate2faTotpUrl, verify2faTotpOrThrow, verifyTotpCodeOnceOrThrow } from '../auth.service';
import { decodeBase32IgnorePadding, generateTOTP } from '../totp.util';

const loggerMock = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));

const authDbMock = vi.hoisted(() => ({
  getTotpAuthenticationFactor: vi.fn(),
  findUserById_UNSAFE: vi.fn(),
  handleSignInOrRegistration: vi.fn(),
}));

const replayCacheMock = vi.hoisted(() => ({ consumeOnceAsync: vi.fn() }));

vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  getLogger: () => loggerMock,
  enrichRequestContext: vi.fn(),
  DbCacheProvider: class {
    consumeOnceAsync = replayCacheMock.consumeOnceAsync;
  },
}));

vi.mock('../auth.db.service', () => authDbMock);

const USER_ID = 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa';

/** A code valid right now for a hex secret, generated the same way an authenticator app would. */
function currentCodeForHexSecret(hexSecret: string) {
  return generateTOTP(Buffer.from(hexSecret, 'hex'), 30, 6);
}

beforeEach(() => {
  vi.clearAllMocks();
  replayCacheMock.consumeOnceAsync.mockResolvedValue(true);
});

describe('generate2faTotpUrl', () => {
  it('returns a base32 secretToken that decodes to the same key as the hex secret', async () => {
    const { secret, secretToken } = await generate2faTotpUrl(USER_ID);

    expect(decodeBase32IgnorePadding(secretToken).toString('hex').toUpperCase()).toBe(secret);
  });

  it('embeds that same secretToken in the otpauth uri', async () => {
    const { secretToken, uri } = await generate2faTotpUrl(USER_ID);

    expect(new URL(uri).searchParams.get('secret')).toBe(secretToken);
  });

  it('mints a distinct 160-bit secret each time', async () => {
    const first = await generate2faTotpUrl(USER_ID);
    const second = await generate2faTotpUrl(USER_ID);

    expect(Buffer.from(first.secret, 'hex')).toHaveLength(20);
    expect(first.secret).not.toBe(second.secret);
  });
});

describe('convertBase32ToHex', () => {
  // The enrollment round-trip: the client is shown secretToken and echoes it back, and the server
  // must land on exactly the hex secret it originally minted.
  it('recovers the hex secret from the secretToken handed to the client', async () => {
    const { secret, secretToken } = await generate2faTotpUrl(USER_ID);

    expect(convertBase32ToHex(secretToken)).toBe(secret);
  });

  it('rejects a secretToken that is not valid base32', () => {
    expect(() => convertBase32ToHex('NOT-BASE32!')).toThrow(/Invalid base32 character/);
  });
});

describe('verify2faTotpOrThrow', () => {
  it('accepts a current code for a stored secret', async () => {
    const { secret } = await generate2faTotpUrl(USER_ID);

    expect(() => verify2faTotpOrThrow(secret, currentCodeForHexSecret(secret))).not.toThrow();
  });

  it('rejects a code that does not match', async () => {
    const { secret } = await generate2faTotpUrl(USER_ID);

    expect(() => verify2faTotpOrThrow(secret, '000000')).toThrow(InvalidVerificationToken);
  });

  // Buffer.from(value, 'hex') truncates at the first invalid character instead of throwing, so
  // without the round-trip check these would silently verify against the wrong (shorter) key.
  it.each([
    ['a non-hex character mid-string', 'AABBZZCC'],
    ['an odd number of characters', 'AABBC'],
    ['leading whitespace', ' AABBCC'],
  ])('rejects a stored secret with %s and logs it as a data-integrity failure', (_label, storedSecret) => {
    expect(() => verify2faTotpOrThrow(storedSecret, '000000')).toThrow(InvalidVerificationToken);
    expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('not valid hex'));
  });
});

describe('verifyTotpCodeOnceOrThrow', () => {
  it('verifies and burns a valid code', async () => {
    const { secret } = await generate2faTotpUrl(USER_ID);
    authDbMock.getTotpAuthenticationFactor.mockResolvedValue({ type: '2fa-otp', enabled: true, secret });

    const code = currentCodeForHexSecret(secret);
    await expect(verifyTotpCodeOnceOrThrow(USER_ID, code)).resolves.toBeUndefined();
    expect(replayCacheMock.consumeOnceAsync).toHaveBeenCalledWith(`${USER_ID}:${code}`);
  });

  // An empty secret round-trips through the hex check cleanly and HMACs against a zero-length key,
  // so it would otherwise verify codes anyone could compute. Reachable because the factor query
  // filters out NULL secrets but not empty ones.
  it('refuses to verify against an empty stored secret', async () => {
    authDbMock.getTotpAuthenticationFactor.mockResolvedValue({ type: '2fa-otp', enabled: true, secret: '' });

    await expect(verifyTotpCodeOnceOrThrow(USER_ID, generateTOTP(Buffer.alloc(0), 30, 6))).rejects.toThrow(InvalidVerificationToken);
    expect(loggerMock.error).toHaveBeenCalledWith({ userId: USER_ID }, expect.stringContaining('no stored secret'));
    expect(replayCacheMock.consumeOnceAsync).not.toHaveBeenCalled();
  });

  it('rejects a replayed code', async () => {
    const { secret } = await generate2faTotpUrl(USER_ID);
    authDbMock.getTotpAuthenticationFactor.mockResolvedValue({ type: '2fa-otp', enabled: true, secret });
    replayCacheMock.consumeOnceAsync.mockResolvedValue(false);

    await expect(verifyTotpCodeOnceOrThrow(USER_ID, currentCodeForHexSecret(secret))).rejects.toThrow(InvalidVerificationToken);
  });
});
