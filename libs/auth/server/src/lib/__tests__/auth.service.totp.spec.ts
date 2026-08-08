import type { SessionData } from '@jetstream/auth/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpiredVerificationToken, InvalidAction, InvalidVerificationToken } from '../auth.errors';
import { beginTotpEnrollment, consumeTotpEnrollmentOrThrow, verify2faTotpOrThrow, verifyTotpCodeOnceOrThrow } from '../auth.service';
import { decodeBase32IgnorePadding, generateTOTP } from '../totp.util';

const loggerMock = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));

const authDbMock = vi.hoisted(() => ({
  getTotpAuthenticationFactor: vi.fn(),
  findUserById_UNSAFE: vi.fn(),
  handleSignInOrRegistration: vi.fn(),
}));

const replayCacheMock = vi.hoisted(() => ({ consumeOnceAsync: vi.fn() }));

vi.mock('@jetstream/api-config', () => ({
  // 32 random bytes, base64 - the shape encryptString expects for an aes-256 key.
  ENV: { JETSTREAM_AUTH_OTP_SECRET: Buffer.alloc(32, 7).toString('base64') },
  getLogger: () => loggerMock,
  enrichRequestContext: vi.fn(),
  DbCacheProvider: class {
    consumeOnceAsync = replayCacheMock.consumeOnceAsync;
  },
}));

vi.mock('../auth.db.service', () => authDbMock);

const USER_ID = 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa';

type EnrollmentSession = Pick<SessionData, 'pendingTotpEnrollment'>;

/** The code an authenticator app would produce after scanning `secretToken`. */
function codeFor(secretToken: string) {
  return generateTOTP(decodeBase32IgnorePadding(secretToken), 30, 6);
}

beforeEach(() => {
  vi.clearAllMocks();
  replayCacheMock.consumeOnceAsync.mockResolvedValue(true);
});

describe('beginTotpEnrollment', () => {
  it('parks the secret on the session instead of relying on the client to return it', async () => {
    const session: EnrollmentSession = {};
    const { secretToken } = await beginTotpEnrollment(session, USER_ID);

    expect(session.pendingTotpEnrollment).toBeTruthy();
    // Encrypted at rest, so the base32 the user sees must not be recoverable by reading the session.
    expect(session.pendingTotpEnrollment?.secret).not.toContain(secretToken);
    expect(session.pendingTotpEnrollment?.exp).toBeGreaterThan(Date.now());
  });

  it('hands the user a 160-bit secret that matches the one in the otpauth uri', async () => {
    const { secretToken, uri } = await beginTotpEnrollment({}, USER_ID);

    expect(decodeBase32IgnorePadding(secretToken)).toHaveLength(20);
    expect(new URL(uri).searchParams.get('secret')).toBe(secretToken);
  });

  it('mints a distinct secret each time', async () => {
    const first = await beginTotpEnrollment({}, USER_ID);
    const second = await beginTotpEnrollment({}, USER_ID);

    expect(first.secretToken).not.toBe(second.secretToken);
  });

  // Re-scanning replaces the pending secret so the code on screen is always the one that works.
  it('replaces a previous pending secret rather than accumulating them', async () => {
    const session: EnrollmentSession = {};
    await beginTotpEnrollment(session, USER_ID);
    const { secretToken } = await beginTotpEnrollment(session, USER_ID);

    expect(consumeTotpEnrollmentOrThrow(session, codeFor(secretToken))).toBe(
      decodeBase32IgnorePadding(secretToken).toString('hex').toUpperCase(),
    );
  });
});

describe('consumeTotpEnrollmentOrThrow', () => {
  it('returns the hex secret when the code proves the user holds it', async () => {
    const session: EnrollmentSession = {};
    const { secretToken } = await beginTotpEnrollment(session, USER_ID);

    const secret = consumeTotpEnrollmentOrThrow(session, codeFor(secretToken));

    expect(decodeBase32IgnorePadding(secretToken).toString('hex').toUpperCase()).toBe(secret);
  });

  it('rejects a code the pending secret does not produce', async () => {
    const session: EnrollmentSession = {};
    await beginTotpEnrollment(session, USER_ID);

    expect(() => consumeTotpEnrollmentOrThrow(session, '000000')).toThrow(InvalidVerificationToken);
  });

  // The whole point of the change: a client cannot enroll a secret of its own choosing, because
  // nothing it sends is used as the secret.
  it('rejects a code for a secret the server never issued', async () => {
    const session: EnrollmentSession = {};
    await beginTotpEnrollment(session, USER_ID);
    const attackerChosenSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    expect(() => consumeTotpEnrollmentOrThrow(session, codeFor(attackerChosenSecret))).toThrow(InvalidVerificationToken);
  });

  it('throws when no enrollment is in progress', () => {
    expect(() => consumeTotpEnrollmentOrThrow({}, '000000')).toThrow(InvalidAction);
  });

  it('throws once the pending secret has expired', async () => {
    const session: EnrollmentSession = {};
    const { secretToken } = await beginTotpEnrollment(session, USER_ID);
    if (session.pendingTotpEnrollment) {
      session.pendingTotpEnrollment.exp = Date.now() - 1;
    }

    expect(() => consumeTotpEnrollmentOrThrow(session, codeFor(secretToken))).toThrow(ExpiredVerificationToken);
  });

  it('clears the pending secret once it has been proven', async () => {
    const session: EnrollmentSession = {};
    const { secretToken } = await beginTotpEnrollment(session, USER_ID);

    consumeTotpEnrollmentOrThrow(session, codeFor(secretToken));

    expect(session.pendingTotpEnrollment).toBeNull();
  });

  // A typo should not force the user back to the QR code.
  it('keeps the pending secret after a wrong code so the user can retry', async () => {
    const session: EnrollmentSession = {};
    const { secretToken } = await beginTotpEnrollment(session, USER_ID);

    expect(() => consumeTotpEnrollmentOrThrow(session, '000000')).toThrow(InvalidVerificationToken);
    expect(consumeTotpEnrollmentOrThrow(session, codeFor(secretToken))).toBeTruthy();
  });

  it('cannot be replayed with the same code', async () => {
    const session: EnrollmentSession = {};
    const { secretToken } = await beginTotpEnrollment(session, USER_ID);
    const code = codeFor(secretToken);

    consumeTotpEnrollmentOrThrow(session, code);

    expect(() => consumeTotpEnrollmentOrThrow(session, code)).toThrow(InvalidAction);
  });
});

describe('verify2faTotpOrThrow', () => {
  // Buffer.from(value, 'hex') truncates at the first invalid character instead of throwing, so
  // without the round-trip check these would silently verify against the wrong (shorter) key.
  it.each([
    ['a non-hex character mid-string', 'AABBZZCC'],
    ['an odd number of characters', 'AABBC'],
    ['leading whitespace', ' AABBCC'],
  ])('rejects a secret with %s and logs it as a data-integrity failure', (_label, storedSecret) => {
    expect(() => verify2faTotpOrThrow(storedSecret, '000000')).toThrow(InvalidVerificationToken);
    expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('not valid hex'));
  });
});

describe('verifyTotpCodeOnceOrThrow', () => {
  it('verifies and burns a valid code', async () => {
    const { secretToken } = await beginTotpEnrollment({}, USER_ID);
    const secret = decodeBase32IgnorePadding(secretToken).toString('hex').toUpperCase();
    authDbMock.getTotpAuthenticationFactor.mockResolvedValue({ type: '2fa-otp', enabled: true, secret });

    const code = codeFor(secretToken);
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
    const { secretToken } = await beginTotpEnrollment({}, USER_ID);
    const secret = decodeBase32IgnorePadding(secretToken).toString('hex').toUpperCase();
    authDbMock.getTotpAuthenticationFactor.mockResolvedValue({ type: '2fa-otp', enabled: true, secret });
    replayCacheMock.consumeOnceAsync.mockResolvedValue(false);

    await expect(verifyTotpCodeOnceOrThrow(USER_ID, codeFor(secretToken))).rejects.toThrow(InvalidVerificationToken);
  });
});
