import { ALL_FEATURE_FLAG_KEYS, DEFAULT_FEATURE_FLAGS, FeatureFlags, serializeFeatureFlagsForSigning } from '@jetstream/types';
import { createPrivateKey, sign } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyAndExtractFeatureFlags } from '../shared-feature-flag-utils';

vi.mock('@jetstream/shared/client-logger', () => ({
  logger: { warn: vi.fn(), log: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Dev fallback private key from feature-flag-signing.service.ts. The verifier falls back to the
// matching DEV public key when NX_PUBLIC_FEATURE_FLAG_PUBLIC_KEY is unset (as it is under test), so a
// signature produced here verifies exactly as a real server signature would in a dev build.
const DEV_PRIVATE_KEY_DER_B64 =
  'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgj95ded+RkY4QkmRbRsZeTmeUthsat/akgFvk52wV8pGhRANCAASme0u+5L5Jb+qj+6As7IT7yk6qvgUcgdFhWyTLdzunDYpHOpiPKsobxih4De/Me9u60ouffcA0itVBqyjF8qcb';

// Driven off the real registry so renaming/retiring the example flag never breaks these tests.
const FLAG = ALL_FEATURE_FLAG_KEYS[0];

/** Mirrors the server's signFeatureFlags (ECDSA P-256, SHA-256, raw P1363, base64url). */
function signFlags(userId: string, flags: FeatureFlags): string {
  const key = createPrivateKey({ key: Buffer.from(DEV_PRIVATE_KEY_DER_B64, 'base64'), format: 'der', type: 'pkcs8' });
  return sign('sha256', Buffer.from(serializeFeatureFlagsForSigning(userId, flags)), { key, dsaEncoding: 'ieee-p1363' }).toString(
    'base64url',
  );
}

describe('verifyAndExtractFeatureFlags', () => {
  const userId = 'user-1';

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the signed flags when the signature is valid', async () => {
    const featureFlags = { [FLAG]: true } as FeatureFlags;
    const result = await verifyAndExtractFeatureFlags({
      id: userId,
      featureFlags,
      featureFlagsSignature: signFlags(userId, featureFlags),
    });
    expect(result[FLAG]).toBe(true);
  });

  it('always returns the full set of known flags', async () => {
    const featureFlags = { [FLAG]: true } as FeatureFlags;
    const result = await verifyAndExtractFeatureFlags({
      id: userId,
      featureFlags,
      featureFlagsSignature: signFlags(userId, featureFlags),
    });
    expect(Object.keys(result).sort()).toEqual([...ALL_FEATURE_FLAG_KEYS].sort());
  });

  it('falls back to code defaults when no signature is present', async () => {
    const result = await verifyAndExtractFeatureFlags({
      id: userId,
      featureFlags: { [FLAG]: true } as FeatureFlags,
      featureFlagsSignature: undefined,
    });
    expect(result).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('falls back to code defaults when the signature does not match the flags (tampered)', async () => {
    const signedFlags = { [FLAG]: false } as FeatureFlags;
    const result = await verifyAndExtractFeatureFlags({
      id: userId,
      // Attacker flipped the flag to true but kept the signature for the false payload.
      featureFlags: { [FLAG]: true } as FeatureFlags,
      featureFlagsSignature: signFlags(userId, signedFlags),
    });
    expect(result).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('falls back to code defaults when the signature was issued for a different user', async () => {
    const featureFlags = { [FLAG]: true } as FeatureFlags;
    const result = await verifyAndExtractFeatureFlags({
      id: userId,
      featureFlags,
      featureFlagsSignature: signFlags('different-user', featureFlags),
    });
    expect(result).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('falls back to code defaults when the signature is malformed', async () => {
    const result = await verifyAndExtractFeatureFlags({
      id: userId,
      featureFlags: { [FLAG]: true } as FeatureFlags,
      featureFlagsSignature: 'not-a-real-signature',
    });
    expect(result).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('falls back to code defaults when WebCrypto is unavailable', async () => {
    const featureFlags = { [FLAG]: true } as FeatureFlags;
    const signature = signFlags(userId, featureFlags);
    vi.stubGlobal('crypto', undefined);
    const result = await verifyAndExtractFeatureFlags({ id: userId, featureFlags, featureFlagsSignature: signature });
    expect(result).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('does not propagate unknown keys even when the signature is valid', async () => {
    // The canonical payload only covers ALL_FEATURE_FLAG_KEYS, so adding an extra key leaves the
    // signature valid — the extracted result must still drop the unknown key.
    const signedFlags = { [FLAG]: true } as FeatureFlags;
    const signature = signFlags(userId, signedFlags);
    const tampered = { ...signedFlags, 'evil-injected-flag': true } as unknown as FeatureFlags;
    const result = await verifyAndExtractFeatureFlags({ id: userId, featureFlags: tampered, featureFlagsSignature: signature });
    expect(result).not.toHaveProperty('evil-injected-flag');
    expect(Object.keys(result).sort()).toEqual([...ALL_FEATURE_FLAG_KEYS].sort());
  });

  it('coerces non-boolean values for known keys to false unless strictly true', async () => {
    // serializeFeatureFlagsForSigning coerces with !!, so a truthy non-boolean signs identically to
    // `true`; extraction uses a strict `=== true` check, so it must surface as false.
    const truthyNonBoolean = { [FLAG]: 'yes' } as unknown as FeatureFlags;
    const signature = signFlags(userId, truthyNonBoolean);
    const result = await verifyAndExtractFeatureFlags({ id: userId, featureFlags: truthyNonBoolean, featureFlagsSignature: signature });
    expect(result[FLAG]).toBe(false);
  });
});
