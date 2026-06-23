import { ALL_FEATURE_FLAG_KEYS, FeatureFlags, serializeFeatureFlagsForSigning } from '@jetstream/types';
import { createPublicKey, verify } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@jetstream/api-config', () => ({
  logger: { warn: vi.fn() },
  ENV: { JETSTREAM_FEATURE_FLAG_PRIVATE_KEY: null, ENVIRONMENT: 'test' },
}));

// Public key matching the signing service's dev fallback private key (base64 SPKI DER).
const DEV_PUBLIC_KEY_DER_B64 =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEpntLvuS+SW/qo/ugLOyE+8pOqr4FHIHRYVsky3c7pw2KRzqYjyrKG8YoeA3vzHvbutKLn33ANIrVQasoxfKnGw==';

// Driven off the real registry so renaming/retiring the example flag never breaks these tests.
const FLAG = ALL_FEATURE_FLAG_KEYS[0];

function verifySignature(userId: string, flags: FeatureFlags, signature: string): boolean {
  const publicKey = createPublicKey({ key: Buffer.from(DEV_PUBLIC_KEY_DER_B64, 'base64'), format: 'der', type: 'spki' });
  return verify(
    'sha256',
    Buffer.from(serializeFeatureFlagsForSigning(userId, flags)),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(signature, 'base64url'),
  );
}

// Mirrors the browser-side verification in shared-feature-flag-utils.ts (SPKI import, ECDSA P-256,
// SHA-256, raw P1363 signature) so a server signature format that Node accepts but WebCrypto rejects
// is caught here instead of silently downgrading every client to code defaults.
async function verifyWithWebCrypto(userId: string, flags: FeatureFlags, signature: string): Promise<boolean> {
  const key = await globalThis.crypto.subtle.importKey(
    'spki',
    Buffer.from(DEV_PUBLIC_KEY_DER_B64, 'base64'),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  return globalThis.crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    Buffer.from(signature, 'base64url'),
    new TextEncoder().encode(serializeFeatureFlagsForSigning(userId, flags)),
  );
}

describe('signFeatureFlags', () => {
  const userId = 'user-1';
  const flags = { [FLAG]: true } as FeatureFlags;

  it('produces a signature that verifies with the matching public key', async () => {
    const { signFeatureFlags } = await import('../feature-flag-signing.service');
    const signature = signFeatureFlags(userId, flags);
    expect(verifySignature(userId, flags, signature)).toBe(true);
  });

  it('produces a signature that verifies with browser WebCrypto (subtle.verify)', async () => {
    const { signFeatureFlags } = await import('../feature-flag-signing.service');
    const signature = signFeatureFlags(userId, flags);
    await expect(verifyWithWebCrypto(userId, flags, signature)).resolves.toBe(true);
  });

  it('fails verification when the flags are tampered with', async () => {
    const { signFeatureFlags } = await import('../feature-flag-signing.service');
    const signature = signFeatureFlags(userId, flags);
    const tamperedFlags = { [FLAG]: false } as FeatureFlags;
    expect(verifySignature(userId, tamperedFlags, signature)).toBe(false);
  });

  it('fails verification when the userId is tampered with', async () => {
    const { signFeatureFlags } = await import('../feature-flag-signing.service');
    const signature = signFeatureFlags(userId, flags);
    expect(verifySignature('different-user', flags, signature)).toBe(false);
  });
});
