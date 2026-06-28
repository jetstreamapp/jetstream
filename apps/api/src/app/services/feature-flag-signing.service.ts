import { ENV, logger } from '@jetstream/api-config';
import { FeatureFlags, serializeFeatureFlagsForSigning } from '@jetstream/types';
import { createPrivateKey, KeyObject, sign } from 'crypto';

/**
 * Asymmetric (ECDSA P-256) signing of resolved feature flags.
 *
 * The server signs with a private key; the browser verifies with a pinned public key (it cannot
 * forge a new signature). This is tamper-evidence, not tamper-proofing — a determined user can still
 * edit the JS bundle — so it is intentionally lightweight.
 *
 * Keys are base64-encoded DER (no PEM newlines to wrangle in env). Signatures use IEEE-P1363
 * (raw r||s, 64 bytes) so they verify directly with the browser WebCrypto `crypto.subtle.verify`.
 */

// Dev-only fallback. The matching public key is pinned in the client (DEV fallback for
// NX_PUBLIC_FEATURE_FLAG_PUBLIC_KEY). Set JETSTREAM_FEATURE_FLAG_PRIVATE_KEY in any deployed
// environment so signatures are produced by a key that isn't published in the repo.
const DEV_FALLBACK_PRIVATE_KEY_DER_B64 =
  'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgj95ded+RkY4QkmRbRsZeTmeUthsat/akgFvk52wV8pGhRANCAASme0u+5L5Jb+qj+6As7IT7yk6qvgUcgdFhWyTLdzunDYpHOpiPKsobxih4De/Me9u60ouffcA0itVBqyjF8qcb';

let cachedPrivateKey: KeyObject | null = null;

function getPrivateKey(): KeyObject {
  if (cachedPrivateKey) {
    return cachedPrivateKey;
  }
  const configured = ENV.JETSTREAM_FEATURE_FLAG_PRIVATE_KEY;
  if (!configured && ENV.ENVIRONMENT === 'production') {
    logger.warn('JETSTREAM_FEATURE_FLAG_PRIVATE_KEY is not set — feature flag signatures use an insecure dev fallback key');
  }
  try {
    cachedPrivateKey = createPrivateKey({
      key: Buffer.from(configured || DEV_FALLBACK_PRIVATE_KEY_DER_B64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
  } catch (ex) {
    // A misconfigured key (bad base64 / not PKCS8 DER / wrong curve) must not 500 /api/me for every user.
    // Signatures are tamper-evidence only and checkFeatureFlag is the authoritative gate, so degrade to the
    // dev fallback (loudly): in a real deployment the client pins a different public key, so its verification
    // fails closed to code defaults rather than crashing the request path.
    logger.error(
      { err: ex },
      'JETSTREAM_FEATURE_FLAG_PRIVATE_KEY is invalid — falling back to the insecure dev key for feature flag signing',
    );
    cachedPrivateKey = createPrivateKey({
      key: Buffer.from(DEV_FALLBACK_PRIVATE_KEY_DER_B64, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
  }
  return cachedPrivateKey;
}

/** Returns a base64url ECDSA P-256 signature over the canonical flag payload. */
export function signFeatureFlags(userId: string, flags: FeatureFlags): string {
  const payload = serializeFeatureFlagsForSigning(userId, flags);
  return sign('sha256', Buffer.from(payload), { key: getPrivateKey(), dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
