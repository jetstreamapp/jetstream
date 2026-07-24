import { logger } from '@jetstream/shared/client-logger';
import {
  ALL_FEATURE_FLAG_KEYS,
  DEFAULT_FEATURE_FLAGS,
  FeatureFlags,
  serializeFeatureFlagsForSigning,
  type UserProfileUi,
} from '@jetstream/types';

/**
 * Browser-side verification of the feature flag signature produced by the server (ECDSA P-256).
 */

// Dev-only pinned public key matching the server's dev fallback private key. Override in deployed
// builds via NX_PUBLIC_FEATURE_FLAG_PUBLIC_KEY (base64 SPKI DER).
const DEV_FALLBACK_PUBLIC_KEY_DER_B64 =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEpntLvuS+SW/qo/ugLOyE+8pOqr4FHIHRYVsky3c7pw2KRzqYjyrKG8YoeA3vzHvbutKLn33ANIrVQasoxfKnGw==';

// Return types are pinned to `Uint8Array<ArrayBuffer>` so they satisfy WebCrypto's `BufferSource`
// parameter under TypeScript's typed-array generics (a bare `Uint8Array` widens to ArrayBufferLike).
function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getPublicKeyDer(): Uint8Array<ArrayBuffer> {
  return base64ToBytes(import.meta.env.NX_PUBLIC_FEATURE_FLAG_PUBLIC_KEY || DEV_FALLBACK_PUBLIC_KEY_DER_B64);
}

function encodeUtf8(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value) as Uint8Array<ArrayBuffer>;
}

/**
 * Returns a copy of the profile with `featureFlags` replaced by the signature-verified set.
 * Use this anywhere a server-provided profile is written into client state (web fetch, desktop
 * IPC payloads, extension storage) so downstream consumers only ever read trusted flags.
 */
export async function applyVerifiedFeatureFlags<T extends Pick<UserProfileUi, 'id' | 'featureFlags' | 'featureFlagsSignature'>>(
  profile: T,
): Promise<T> {
  const featureFlags = await verifyAndExtractFeatureFlags(profile);
  return { ...profile, featureFlags };
}

/**
 * Returns the trusted feature flags when the signature is valid, otherwise the code defaults.
 * Always returns the full set of known flags.
 */
export async function verifyAndExtractFeatureFlags(
  profile: Pick<UserProfileUi, 'id' | 'featureFlags' | 'featureFlagsSignature'>,
): Promise<FeatureFlags> {
  const received = (profile.featureFlags ?? {}) as FeatureFlags;
  const signature = profile.featureFlagsSignature;
  try {
    if (!signature || !globalThis.crypto?.subtle) {
      logger.warn('[FEATURE FLAGS] Missing signature or WebCrypto unavailable — using code defaults');
      return { ...DEFAULT_FEATURE_FLAGS };
    }
    const key = await globalThis.crypto.subtle.importKey('spki', getPublicKeyDer(), { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify',
    ]);
    const payload = encodeUtf8(serializeFeatureFlagsForSigning(profile.id, received));
    const isValid = await globalThis.crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, base64ToBytes(signature), payload);
    if (!isValid) {
      logger.warn('[FEATURE FLAGS] Signature verification failed — using code defaults');
      return { ...DEFAULT_FEATURE_FLAGS };
    }
    // Trust only known flag keys, coerced to booleans. The signature only covers the canonical
    // known-key payload, so extra or non-boolean values on `received` must not propagate.
    const trusted: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
    for (const flagKey of ALL_FEATURE_FLAG_KEYS) {
      if (Object.prototype.hasOwnProperty.call(received, flagKey)) {
        trusted[flagKey] = received[flagKey] === true;
      }
    }
    return trusted;
  } catch (ex) {
    logger.warn('[FEATURE FLAGS] Error verifying signature — using code defaults', ex);
    return { ...DEFAULT_FEATURE_FLAGS };
  }
}
