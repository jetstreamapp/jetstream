/**
 * The signed payload is the contract between the server signer and every client verifier, and those
 * clients ship on their own release cadence — a pinned desktop or browser-extension build can be many
 * versions behind. These tests pin the two properties that make the byte sequence reproducible across
 * that skew: it is derived only from what was transmitted, and it is stable regardless of key order.
 */
import { describe, expect, it } from 'vitest';
import { ALL_FEATURE_FLAG_KEYS, serializeFeatureFlagsForSigning } from '../feature-flags';

describe('serializeFeatureFlagsForSigning', () => {
  const userId = 'user-1';

  it('sorts keys so object insertion order cannot change the signed bytes', () => {
    const ascending = serializeFeatureFlagsForSigning(userId, { 'flag-a': true, 'flag-b': false });
    const descending = serializeFeatureFlagsForSigning(userId, { 'flag-b': false, 'flag-a': true });
    expect(ascending).toBe(descending);
    expect(ascending).toBe(
      JSON.stringify({
        userId,
        flags: [
          ['flag-a', true],
          ['flag-b', false],
        ],
      }),
    );
  });

  it('covers exactly the transmitted keys, so the local flag registry cannot change the payload', () => {
    // Neither key exists in FEATURE_FLAGS. When the payload was keyed off ALL_FEATURE_FLAG_KEYS these
    // would have been dropped and every registry key added at `false`, making the bytes differ between
    // a server and an older client — which is precisely what broke verification on pinned clients.
    const payload = serializeFeatureFlagsForSigning(userId, { 'flag-not-in-registry-b': true, 'flag-not-in-registry-a': false });
    expect(payload).toBe(
      JSON.stringify({
        userId,
        flags: [
          ['flag-not-in-registry-a', false],
          ['flag-not-in-registry-b', true],
        ],
      }),
    );
    for (const registryKey of ALL_FEATURE_FLAG_KEYS) {
      expect(payload).not.toContain(registryKey);
    }
  });

  it('produces an empty flag list when nothing is transmitted', () => {
    expect(serializeFeatureFlagsForSigning(userId, {})).toBe(JSON.stringify({ userId, flags: [] }));
  });

  it('binds the payload to the userId', () => {
    const flags = { 'flag-a': true };
    expect(serializeFeatureFlagsForSigning(userId, flags)).not.toBe(serializeFeatureFlagsForSigning('user-2', flags));
  });

  it('coerces values to booleans so a truthy non-boolean cannot alter the byte sequence', () => {
    const coerced = serializeFeatureFlagsForSigning(userId, { 'flag-a': 'yes' } as unknown as Record<string, boolean>);
    expect(coerced).toBe(serializeFeatureFlagsForSigning(userId, { 'flag-a': true }));
  });
});
