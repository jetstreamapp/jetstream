/**
 * Lightweight feature flag system.
 *
 * Flag keys and their defaults live here in code (typed, shared FE/BE). The database only stores
 * *overrides* (deviations from the default) scoped to a user or a team via the `FeatureFlagOverride`
 * table. Resolution is "most permissive wins": for a given flag the result is true if the code
 * default, the team override, or the user override is true (see `resolveFeatureFlagsForUser` on the
 * server). If non-boolean flags are ever introduced, prefer the team value.
 *
 * To add a flag: add an entry below. To gate it to a user/team: insert a `FeatureFlagOverride` row.
 * To GA it: flip `defaultValue` to true. To retire it: remove the entry and delete its override rows.
 */
export const FEATURE_FLAGS = {
  'analysis-tools': {
    defaultValue: true,
    description: 'Data and record analysis tools.',
  },
  'salesforce-canvas': {
    defaultValue: false,
    description: 'Manage Salesforce orgs authorized to use the Canvas app.',
  },
} as const satisfies Record<string, { defaultValue: boolean; description: string }>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

/** Every known flag at its code-defined default. Used as the base for resolution and the client fallback. */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = Object.fromEntries(
  Object.entries(FEATURE_FLAGS).map(([key, { defaultValue }]) => [key, defaultValue]),
) as FeatureFlags;

export const ALL_FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

export function isFeatureFlagKey(key: string): key is FeatureFlagKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, key);
}

/**
 * Canonical, stable serialization of a user's resolved flags. Used by BOTH the server signer and the
 * browser verifier, so the byte sequence must be deterministic regardless of object key order. Keys
 * are sorted and values coerced to booleans.
 *
 * Keys come from `flags` itself, deliberately NOT from `ALL_FEATURE_FLAG_KEYS`. That constant is
 * compiled into each build, and the desktop app and browser extension run builds that can be many
 * versions behind the server, so keying off it made the payload depend on the *verifier's* registry:
 * adding or retiring a single flag changed the byte sequence on the server but not on an older
 * client, so every signature failed to verify there and the client silently fell back to code
 * defaults for ALL flags. Deriving the keys from the transmitted object keeps both sides in
 * agreement in either direction of version skew — a newer server sending an unknown flag, or an
 * older server omitting one the client knows. The verifier still narrows the result to the flags its
 * own build understands (see `verifyAndExtractFeatureFlags`).
 *
 * Trade-off: a payload signed before a flag existed still verifies, so a user can replay an earlier
 * set of their own flags rather than it aging out on the next registry change. Flags are client-side
 * rollout gating with tamper-evidence, not an authorization boundary — server-side `checkFeatureFlag`
 * stays authoritative — and a replay only restores flags that user was genuinely granted, so that is
 * the better trade than silently resetting every out-of-date client.
 */
export function serializeFeatureFlagsForSigning(userId: string, flags: Readonly<Record<string, boolean>>): string {
  const entries = Object.keys(flags)
    .sort()
    .map((key) => [key, !!flags[key]] as const);
  return JSON.stringify({ userId, flags: entries });
}
